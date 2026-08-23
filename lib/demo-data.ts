/**
 * Historial de demostración.
 *
 * Una alcancía recién creada está vacía, y un panel vacío no enseña nada: no se
 * ve el gráfico, ni las tres vías de decisión, ni cómo queda el rastro de una
 * aprobación. Esto la llena con seis meses de movimientos plausibles.
 *
 * Los pagos NO se insertan a mano: pasan por el mismo motor de reglas que usa
 * la app. Si uno violara los topes que el reglamento declara, el sembrado falla
 * en vez de guardar un historial incoherente — que es justo lo que un revisor
 * atento detectaría.
 *
 * Ninguno toca la cadena: son registros históricos, con hashes marcados como
 * sintéticos. Los pagos de verdad los hace quien prueba.
 */

import { prisma } from '@/lib/prisma'
import { evaluate, type RuleSet, type TreasuryState } from '@/lib/rules'

/** daysAgo: hace cuánto ocurrió. Los del mes en curso suman ~2 300. */
const HISTORY = [
  { daysAgo: 168, from: 'juan', to: 'maria', amount: 420, reason: 'Servidor de staging' },
  { daysAgo: 161, from: 'sofia', to: 'carlos', amount: 85, reason: 'Dominio anual' },
  { daysAgo: 149, from: 'carlos', to: 'juan', amount: 55, reason: 'Café de la oficina' },
  { daysAgo: 138, from: 'maria', to: 'juan', amount: 640, reason: 'Diseño de la landing' },
  { daysAgo: 127, from: 'juan', to: 'maria', amount: 190, reason: 'Banco de imágenes' },
  { daysAgo: 118, from: 'sofia', to: 'carlos', amount: 310, reason: 'Licencias de monitoreo' },
  { daysAgo: 104, from: 'carlos', to: 'sofia', amount: 75, reason: 'Comida del equipo' },
  { daysAgo: 96, from: 'maria', to: 'carlos', amount: 880, reason: 'Auditoría del contrato' },
  { daysAgo: 88, from: 'juan', to: 'sofia', amount: 240, reason: 'Publicidad del lanzamiento' },
  { daysAgo: 74, from: 'sofia', to: 'maria', amount: 180, reason: 'Traducción del sitio' },
  { daysAgo: 66, from: 'carlos', to: 'juan', amount: 95, reason: 'Certificado SSL' },
  { daysAgo: 59, from: 'maria', to: 'sofia', amount: 520, reason: 'Consultoría de seguridad' },
  { daysAgo: 47, from: 'juan', to: 'carlos', amount: 340, reason: 'Infraestructura del mes' },
  { daysAgo: 38, from: 'sofia', to: 'juan', amount: 70, reason: 'Café de la oficina' },
  { daysAgo: 31, from: 'carlos', to: 'maria', amount: 760, reason: 'Rediseño de la app' },
  { daysAgo: 24, from: 'maria', to: 'carlos', amount: 145, reason: 'Herramientas de análisis' },
  // Mes en curso — 2 300 en total, ninguno supera el tope diario de 1 000
  { daysAgo: 19, from: 'juan', to: 'sofia', amount: 980, reason: 'Freelance de frontend' },
  { daysAgo: 14, from: 'sofia', to: 'juan', amount: 60, reason: 'Café de la oficina' },
  { daysAgo: 9, from: 'carlos', to: 'maria', amount: 340, reason: 'Infraestructura del mes' },
  { daysAgo: 4, from: 'maria', to: 'carlos', amount: 920, reason: 'Soporte de guardia' },
] as const

/** Solicitudes que el reglamento bloqueó. Los rechazos también son historial. */
const REJECTED = [
  { daysAgo: 52, from: 'carlos', to: 'maria', amount: 3200, reason: 'Patrocinio del evento' },
  { daysAgo: 12, from: 'juan', to: 'carlos', amount: 2500, reason: 'Equipo nuevo' },
] as const

function daysAgoDate(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(9 + (days % 8), (days * 7) % 60, 0, 0)
  return date
}

/**
 * Hash sintético, marcado como tal.
 *
 * Empieza por `0xdemo` para que se distinga de un hash real de un vistazo. Un
 * hash inventado que aparente ser auténtico sería mucho peor que uno que se
 * declara: quien haga clic en Etherscan y no lo encuentre merece entender por
 * qué antes de hacerlo.
 */
const demoHash = (treasuryId: string, index: number) =>
  '0xdemo' + treasuryId.slice(-8).padEnd(8, '0') + String(index).padStart(4, '0') +
  'd'.repeat(58 - 8 - 4)

export interface SeedResult {
  created: number
  rejected: number
  spentThisMonth: number
}

/** ¿Ya tiene movimientos? Sembrar dos veces duplicaría el historial. */
export async function hasHistory(treasuryId: string): Promise<boolean> {
  const count = await prisma.payment.count({ where: { treasuryId } })
  return count > 0
}

export async function seedDemoHistory(treasuryId: string): Promise<SeedResult> {
  const treasury = await prisma.treasury.findUniqueOrThrow({
    where: { id: treasuryId },
    include: { rules: true, members: true },
  })
  if (!treasury.rules) throw new Error('La alcancía no tiene reglamento.')

  const rules = treasury.rules as RuleSet
  const byKey = new Map(treasury.members.map((m) => [m.email.split('@')[0], m]))

  // Se limpia antes para que sembrar de nuevo reponga en vez de acumular.
  await prisma.approval.deleteMany({ where: { payment: { treasuryId } } })
  await prisma.payment.deleteMany({ where: { treasuryId } })

  const spentByDay = new Map<string, number>()
  const spentByMonth = new Map<string, number>()
  const key = (d: Date, scope: 'day' | 'month') =>
    scope === 'day' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7)

  let created = 0

  for (const [index, entry] of HISTORY.entries()) {
    const requester = byKey.get(entry.from)
    const beneficiary = byKey.get(entry.to)
    if (!requester || !beneficiary) continue

    const createdAt = daysAgoDate(entry.daysAgo)
    const state: TreasuryState = {
      beneficiary: { email: beneficiary.email, walletAddress: beneficiary.walletAddress },
      spentToday: spentByDay.get(key(createdAt, 'day')) ?? 0,
      spentThisMonth: spentByMonth.get(key(createdAt, 'month')) ?? 0,
      onchainBalance: 25_000,
    }

    const result = evaluate(
      { amount: entry.amount, toEmail: beneficiary.email, requestedByEmail: requester.email },
      rules,
      state,
    )

    if (result.decision === 'REJECTED') {
      throw new Error(
        `El histórico de $${entry.amount} viola el reglamento: ${result.rejectReason}`,
      )
    }

    const payment = await prisma.payment.create({
      data: {
        treasuryId,
        requestedById: requester.id,
        toEmail: beneficiary.email,
        toAddress: beneficiary.walletAddress,
        amount: entry.amount,
        reason: entry.reason,
        rawRequest: `paga $${entry.amount} a ${beneficiary.email} por ${entry.reason.toLowerCase()}`,
        status: 'SUCCESS',
        decisionPath: result.decision,
        decisionLog: JSON.stringify(result.decisionLog),
        txHash: demoHash(treasuryId, index),
        executedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      },
    })

    // Aprobaciones coherentes con la vía, siempre de terceros.
    const voters = treasury.members.filter(
      (m) => m.id !== requester.id && m.id !== beneficiary.id,
    )
    const signers =
      result.decision === 'ADMIN_ONLY'
        ? voters.filter((v) => v.role === 'ADMIN').slice(0, 1)
        : result.decision === 'MULTI_SIG'
          ? voters.slice(0, result.approvalsNeeded)
          : []

    for (const voter of signers) {
      await prisma.approval.create({
        data: { paymentId: payment.id, approverId: voter.id, approved: true, createdAt },
      })
    }

    spentByDay.set(key(createdAt, 'day'), state.spentToday + entry.amount)
    spentByMonth.set(key(createdAt, 'month'), state.spentThisMonth + entry.amount)
    created += 1
  }

  // Los rechazos, con su motivo real salido del propio motor.
  let rejected = 0
  for (const entry of REJECTED) {
    const requester = byKey.get(entry.from)
    const beneficiary = byKey.get(entry.to)
    if (!requester || !beneficiary) continue

    const createdAt = daysAgoDate(entry.daysAgo)
    const result = evaluate(
      { amount: entry.amount, toEmail: beneficiary.email, requestedByEmail: requester.email },
      rules,
      {
        beneficiary: { email: beneficiary.email, walletAddress: beneficiary.walletAddress },
        spentToday: 0,
        spentThisMonth: spentByMonth.get(key(createdAt, 'month')) ?? 0,
        onchainBalance: 25_000,
      },
    )

    if (result.decision !== 'REJECTED') continue

    await prisma.payment.create({
      data: {
        treasuryId,
        requestedById: requester.id,
        toEmail: beneficiary.email,
        toAddress: beneficiary.walletAddress,
        amount: entry.amount,
        reason: entry.reason,
        rawRequest: `paga $${entry.amount} a ${beneficiary.email} para ${entry.reason.toLowerCase()}`,
        status: 'REJECTED',
        decisionPath: 'REJECTED',
        decisionLog: JSON.stringify(result.decisionLog),
        rejectReason: result.rejectReason,
        createdAt,
        updatedAt: createdAt,
      },
    })
    rejected += 1
  }

  // Y uno pendiente, para que se vea la banda de votación sin tener que pedirlo.
  const pendingRequester = byKey.get('maria')
  const pendingBeneficiary = byKey.get('juan')
  if (pendingRequester && pendingBeneficiary) {
    const createdAt = daysAgoDate(1)
    const result = evaluate(
      {
        amount: 380,
        toEmail: pendingBeneficiary.email,
        requestedByEmail: pendingRequester.email,
      },
      rules,
      {
        beneficiary: {
          email: pendingBeneficiary.email,
          walletAddress: pendingBeneficiary.walletAddress,
        },
        spentToday: 0,
        spentThisMonth: spentByMonth.get(key(createdAt, 'month')) ?? 0,
        onchainBalance: 25_000,
      },
    )

    if (result.decision === 'MULTI_SIG') {
      await prisma.payment.create({
        data: {
          treasuryId,
          requestedById: pendingRequester.id,
          toEmail: pendingBeneficiary.email,
          toAddress: pendingBeneficiary.walletAddress,
          amount: 380,
          reason: 'Migración de la base de datos',
          rawRequest: 'paga $380 a juan@wip.demo por la migración de la base de datos',
          status: 'PENDING_APPROVAL',
          decisionPath: result.decision,
          decisionLog: JSON.stringify(result.decisionLog),
          createdAt,
          updatedAt: createdAt,
        },
      })
    }
  }

  const thisMonth = [...spentByMonth.entries()].at(-1)?.[1] ?? 0
  return { created, rejected, spentThisMonth: thisMonth }
}
