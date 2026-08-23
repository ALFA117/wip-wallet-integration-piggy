import { z } from 'zod'
import type { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { canVote } from '@/lib/rules'
import {
  approvalStatus,
  executePayment,
  revalidateBeforeExecution,
} from '@/lib/treasury'

export const dynamic = 'force-dynamic'

const ApprovePayload = z.object({
  approverId: z.string().min(1),
  approved: z.boolean(),
})

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params

    const parsed = ApprovePayload.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json(
        { error: 'Voto inválido', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const { approverId, approved } = parsed.data

    const [approver, payment] = await Promise.all([
      prisma.user.findUnique({ where: { id: approverId } }),
      prisma.payment.findUnique({
        where: { id },
        include: {
          requestedBy: { select: { email: true } },
          approvals: { include: { approver: { select: { email: true } } } },
        },
      }),
    ])

    if (!approver) return Response.json({ error: 'Usuario no encontrado' }, { status: 404 })
    if (!payment) return Response.json({ error: 'Pago no encontrado' }, { status: 404 })

    if (payment.status !== 'PENDING_APPROVAL') {
      return Response.json(
        { error: `Este pago ya está en ${payment.status}` },
        { status: 409 },
      )
    }

    // Quien pide un pago no puede aprobarlo, y nadie vota dos veces.
    // La UI esconde el botón; esto lo rechaza aunque llamen a la API directo.
    const permission = canVote(
      approver.email,
      payment.requestedBy.email,
      payment.approvals.map((approval) => approval.approver.email),
    )
    if (!permission.allowed) {
      return Response.json({ error: permission.reason }, { status: 403 })
    }

    await prisma.approval.create({
      data: { paymentId: payment.id, approverId: approver.id, approved },
    })

    const { outcome } = await approvalStatus(payment.id)

    // Un solo veto manda el pago a REJECTED de inmediato.
    if (outcome.status === 'REJECTED') {
      const rejected = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'REJECTED', rejectReason: outcome.reason },
      })
      return Response.json({ status: rejected.status, rejectReason: rejected.rejectReason })
    }

    if (outcome.status === 'PENDING_APPROVAL') {
      return Response.json({ status: 'PENDING_APPROVAL', remaining: outcome.remaining })
    }

    // Se juntaron las aprobaciones: re-evaluamos los chequeos 5 a 8 antes de
    // ejecutar. Entre que se pidió y que se aprobó, el balance pudo cambiar.
    const recheck = await revalidateBeforeExecution(payment.id)
    if (!recheck.ok) {
      const rejected = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'REJECTED',
          rejectReason: `Al ejecutar: ${recheck.reason}`,
        },
      })
      return Response.json({
        status: rejected.status,
        rejectReason: rejected.rejectReason,
        revalidation: recheck.steps,
      })
    }

    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'APPROVED' } })
    const executed = await executePayment(payment.id)

    return Response.json({
      status: executed.status,
      txHash: executed.txHash,
      errorMessage: executed.errorMessage,
      revalidation: recheck.steps,
    })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
