import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { getTreasury } from '@/lib/treasury'

export const dynamic = 'force-dynamic'

const RulesPayload = z
  .object({
    autoApproveUnder: z.number().positive(),
    requireApprovals: z.number().int().min(1).max(10),
    adminOnlyOver: z.number().positive(),
    monthlyBudget: z.number().positive(),
    dailyLimit: z.number().positive(),
    maxSingleTx: z.number().positive(),
    allowlistCsv: z.string(),
    actorId: z.string().min(1),
  })
  .refine((data) => data.autoApproveUnder < data.adminOnlyOver, {
    message: 'El tope automático tiene que ser menor que el tope de administrador',
    path: ['autoApproveUnder'],
  })
  .refine((data) => data.adminOnlyOver <= data.maxSingleTx, {
    message: 'El tope de administrador no puede superar el tope por transacción',
    path: ['adminOnlyOver'],
  })
  .refine((data) => data.dailyLimit <= data.monthlyBudget, {
    message: 'El tope diario no puede superar el presupuesto mensual',
    path: ['dailyLimit'],
  })

export async function GET() {
  try {
    const { rules } = await getTreasury()
    return Response.json({ rules })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const parsed = RulesPayload.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json(
        { error: 'Reglamento inválido', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const { actorId, ...values } = parsed.data

    // Editar el reglamento es cosa de un ADMIN. Se comprueba en el servidor,
    // no solo escondiendo el formulario.
    const actor = await prisma.user.findUnique({ where: { id: actorId } })
    if (!actor) {
      return Response.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }
    if (actor.role !== 'ADMIN') {
      return Response.json(
        { error: 'Solo un administrador puede editar el reglamento' },
        { status: 403 },
      )
    }

    const { rules } = await getTreasury()
    const updated = await prisma.rule.update({
      where: { id: rules.id },
      data: {
        ...values,
        allowlistCsv: values.allowlistCsv
          .split(',')
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
          .join(','),
      },
    })

    return Response.json({ rules: updated })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
