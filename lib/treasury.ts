/**
 * La capa que une base de datos, motor de reglas y WDK.
 *
 * Toda la lógica de decisión y ejecución vive aquí y en las rutas API. Nada de
 * esto se duplica en el cliente.
 */

import { prisma } from '@/lib/prisma'
import { getUsdtBalance, sendUsdt, WdkError } from '@/lib/wdk'
import {
  evaluate,
  resolveApprovals,
  type CheckStep,
  type Evaluation,
  type RuleSet,
  type TreasuryState,
} from '@/lib/rules'

/** Pagos que cuentan para los topes. Los rechazados nunca cuentan. */
const COUNTS_TOWARD_BUDGET = ['SUCCESS', 'EXECUTING'] as const

export function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export function startOfMonth(): Date {
  const date = new Date()
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date
}

/** La tesorería y su reglamento. Falla ruidosamente si falta el seed. */
export async function getTreasury() {
  const treasury = await prisma.treasury.findFirst({ include: { rules: true } })
  if (!treasury) {
    throw new Error('No hay tesorería. Corre `npm run seed`.')
  }
  if (!treasury.rules) {
    throw new Error('La tesorería no tiene reglamento. Corre `npm run seed`.')
  }
  return { treasury, rules: treasury.rules as RuleSet & { id: string } }
}

async function sumSpent(treasuryId: string, since: Date): Promise<number> {
  const result = await prisma.payment.aggregate({
    where: {
      treasuryId,
      status: { in: [...COUNTS_TOWARD_BUDGET] },
      createdAt: { gte: since },
    },
    _sum: { amount: true },
  })
  return result._sum.amount ?? 0
}

/**
 * Arma el estado contra el que se evalúan las reglas.
 * El balance sale del CLI, nunca de la base de datos.
 */
export async function buildState(treasuryId: string, toEmail: string): Promise<TreasuryState> {
  const [beneficiary, spentToday, spentThisMonth, onchainBalance] = await Promise.all([
    prisma.user.findUnique({
      where: { email: toEmail.trim().toLowerCase() },
      select: { email: true, walletAddress: true },
    }),
    sumSpent(treasuryId, startOfToday()),
    sumSpent(treasuryId, startOfMonth()),
    getUsdtBalance(),
  ])

  return { beneficiary, spentToday, spentThisMonth, onchainBalance }
}

/**
 * Ejecuta una transferencia ya aprobada.
 *
 * El orden importa y no se altera:
 *   1. `EXECUTING` persistido ANTES de llamar a la cadena — si el proceso muere
 *      a mitad, queda rastro y el pago no se re-ejecuta a ciegas.
 *   2. `sendUsdt()`.
 *   3. SUCCESS + txHash, o FAILED + errorMessage.
 *
 * Nunca reintenta.
 */
export async function executePayment(paymentId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
  if (!payment) throw new Error(`Pago ${paymentId} no encontrado`)

  if (payment.status !== 'APPROVED') {
    // Un Payment solo pasa a EXECUTING desde APPROVED. Nunca desde
    // PENDING_APPROVAL directo.
    throw new Error(
      `El pago ${paymentId} está en ${payment.status}; solo se ejecuta desde APPROVED`,
    )
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'EXECUTING' },
  })

  try {
    const { txHash } = await sendUsdt(payment.toAddress, payment.amount)
    return await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'SUCCESS', txHash, executedAt: new Date(), errorMessage: null },
    })
  } catch (error) {
    const message = error instanceof WdkError ? error.message : String(error)
    return await prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED', errorMessage: message },
    })
  }
}

/**
 * Re-evalúa los chequeos 5 a 8 justo antes de ejecutar. Entre que se pidió el
 * pago y que se aprobó, el balance o el gasto acumulado pudieron cambiar.
 */
export async function revalidateBeforeExecution(paymentId: string): Promise<{
  ok: boolean
  reason?: string
  steps: CheckStep[]
}> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { requestedBy: { select: { email: true } } },
  })
  if (!payment) return { ok: false, reason: 'Pago no encontrado', steps: [] }

  const { rules } = await getTreasury()
  const state = await buildState(payment.treasuryId, payment.toEmail)

  const result = evaluate(
    {
      amount: payment.amount,
      toEmail: payment.toEmail,
      requestedByEmail: payment.requestedBy.email,
    },
    rules,
    state,
  )

  const revalidated = result.decisionLog.filter((step) =>
    ['max_single_tx', 'daily_limit', 'monthly_budget', 'onchain_balance'].includes(step.check),
  )

  if (result.decision === 'REJECTED') {
    return { ok: false, reason: result.rejectReason, steps: revalidated }
  }
  return { ok: true, steps: revalidated }
}

/** Cuántas aprobaciones faltan para un pago, según su vía de decisión. */
export function approvalsNeededFor(decisionPath: string, rules: RuleSet): {
  needed: number
  adminRequired: boolean
} {
  if (decisionPath === 'ADMIN_ONLY') return { needed: 1, adminRequired: true }
  if (decisionPath === 'MULTI_SIG') return { needed: rules.requireApprovals, adminRequired: false }
  return { needed: 0, adminRequired: false }
}

/** Estado de aprobación de un pago pendiente, leyendo sus votos actuales. */
export async function approvalStatus(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      approvals: { include: { approver: { select: { email: true, role: true, name: true } } } },
      requestedBy: { select: { email: true } },
    },
  })
  if (!payment) throw new Error('Pago no encontrado')

  const { rules } = await getTreasury()
  const { needed, adminRequired } = approvalsNeededFor(payment.decisionPath, rules)

  const outcome = resolveApprovals(
    payment.approvals.map((approval) => ({
      approverEmail: approval.approver.email,
      approverRole: approval.approver.role,
      approved: approval.approved,
    })),
    needed,
    adminRequired,
  )

  return { payment, outcome, needed, adminRequired }
}

export type { Evaluation }
export { evaluate }
