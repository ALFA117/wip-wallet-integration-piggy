import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { parseIntent, ParseError } from '@/lib/parse'
import { evaluate, type RuleSet } from '@/lib/rules'
import { buildState, executePayment } from '@/lib/treasury'
import { errorResponse, requireWorkspace } from '@/lib/session'

export const dynamic = 'force-dynamic'

const RequestPayload = z
  .object({
    requesterId: z.string().min(1),
    rawText: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    toEmail: z.email().optional(),
    reason: z.string().min(1).optional(),
  })
  .refine((data) => data.rawText || (data.amount && data.toEmail && data.reason), {
    message: 'Manda `rawText`, o bien `amount`, `toEmail` y `reason`',
  })

export async function POST(request: Request) {
  try {
    const { treasury, rules, walletIndex } = await requireWorkspace()

    const parsed = RequestPayload.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json(
        { error: 'Solicitud inválida', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const body = parsed.data

    // El solicitante tiene que ser de esta alcancía, no de otra.
    const requester = await prisma.member.findFirst({
      where: { id: body.requesterId, treasuryId: treasury.id },
    })
    if (!requester) {
      return Response.json({ error: 'Integrante no encontrado' }, { status: 404 })
    }

    // 1 — Traducir texto a intención. El parser no decide nada.
    let intent: { amount: number; toEmail: string; reason: string }
    if (body.rawText) {
      const members = await prisma.member.findMany({
        where: { treasuryId: treasury.id },
        select: { email: true, name: true },
      })
      try {
        intent = parseIntent(body.rawText, members)
      } catch (error) {
        if (error instanceof ParseError) {
          return Response.json({ error: error.message, stage: 'parse' }, { status: 400 })
        }
        throw error
      }
    } else {
      intent = { amount: body.amount!, toEmail: body.toEmail!, reason: body.reason! }
    }

    // 2 — Evaluar contra el reglamento. Determinista.
    const state = await buildState(treasury.id, walletIndex, intent.toEmail)
    const result = evaluate(
      { amount: intent.amount, toEmail: intent.toEmail, requestedByEmail: requester.email },
      rules as RuleSet,
      state,
    )

    // 3 — Persistir la decisión, incluso si es un rechazo. Cada rechazo queda
    //     en el registro auditable, igual que cada pago.
    const payment = await prisma.payment.create({
      data: {
        treasuryId: treasury.id,
        requestedById: requester.id,
        toEmail: intent.toEmail.toLowerCase(),
        toAddress: state.beneficiary?.walletAddress ?? '',
        amount: intent.amount,
        reason: intent.reason,
        rawRequest: body.rawText ?? `${intent.amount} → ${intent.toEmail}: ${intent.reason}`,
        status: result.decision === 'REJECTED' ? 'REJECTED' : 'PENDING_APPROVAL',
        decisionPath: result.decision,
        decisionLog: JSON.stringify(result.decisionLog),
        rejectReason: result.rejectReason ?? null,
      },
    })

    const base = {
      paymentId: payment.id,
      decision: result.decision,
      decisionLog: result.decisionLog,
      approvalsNeeded: result.approvalsNeeded,
      adminRequired: result.adminRequired,
    }

    if (result.decision === 'REJECTED') {
      return Response.json({ ...base, rejectReason: result.rejectReason })
    }

    // 4 — AUTO ejecuta ya. El resto espera aprobaciones.
    if (result.decision === 'AUTO') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'APPROVED' } })
      const executed = await executePayment(payment.id)
      return Response.json({
        ...base,
        status: executed.status,
        txHash: executed.txHash,
        errorMessage: executed.errorMessage,
      })
    }

    return Response.json({ ...base, status: 'PENDING_APPROVAL' })
  } catch (error) {
    return errorResponse(error)
  }
}
