/**
 * Llena una alcancía con historial de demo.
 *
 *   npm run seed -- tu-correo@gmail.com
 *
 * En el modelo multi-inquilino cada persona recibe su alcancía vacía al entrar,
 * que es lo honesto: los pagos que ve son los que hizo. Pero para grabar el
 * vídeo hace falta un panel con historial creíble, y para eso está esto.
 *
 * Los pagos se generan pasándolos por el MISMO motor de reglas que usa la app,
 * así que ninguno viola los topes que el reglamento declara — un jurado atento
 * lo notaría.
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../lib/generated/prisma/client.ts'
import { evaluate, type RuleSet, type TreasuryState } from '../lib/rules.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('Falta DATABASE_URL.')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const email = process.argv[2]
if (!email) {
  console.error('Uso: npm run seed -- tu-correo@gmail.com')
  console.error('(el correo con el que iniciaste sesión)')
  process.exit(1)
}

/** daysAgo: cuántos días atrás. Los del mes en curso suman ~2 300. */
const HISTORY = [
  { daysAgo: 158, from: 'juan', to: 'maria', amount: 420, reason: 'Servidor de staging' },
  { daysAgo: 143, from: 'sofia', to: 'carlos', amount: 85, reason: 'Dominio anual' },
  { daysAgo: 121, from: 'maria', to: 'juan', amount: 640, reason: 'Diseño de la landing' },
  { daysAgo: 96, from: 'carlos', to: 'sofia', amount: 75, reason: 'Café de la oficina' },
  { daysAgo: 74, from: 'juan', to: 'carlos', amount: 310, reason: 'Licencias de monitoreo' },
  { daysAgo: 52, from: 'sofia', to: 'maria', amount: 180, reason: 'Traducción del sitio' },
  { daysAgo: 38, from: 'maria', to: 'carlos', amount: 950, reason: 'Auditoría del contrato' },
  { daysAgo: 21, from: 'juan', to: 'sofia', amount: 980, reason: 'Freelance de frontend' },
  { daysAgo: 16, from: 'sofia', to: 'juan', amount: 60, reason: 'Café de la oficina' },
  { daysAgo: 11, from: 'carlos', to: 'maria', amount: 340, reason: 'Infraestructura del mes' },
  { daysAgo: 6, from: 'maria', to: 'carlos', amount: 920, reason: 'Soporte de guardia' },
] as const

function daysAgoDate(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(11, 30, 0, 0)
  return date
}

/** Hash determinista y evidentemente sintético: no simula uno real. */
const seedHash = (i: number) => '0xseed' + String(i).padStart(2, '0') + 'f'.repeat(58)

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { treasuries: { include: { rules: true, members: true } } },
  })

  if (!user) {
    console.error(`No hay ninguna cuenta con el correo ${email}.`)
    console.error('Inicia sesión en la app primero: eso crea tu alcancía.')
    process.exit(1)
  }

  const treasury = user.treasuries[0]
  if (!treasury?.rules) {
    console.error('Esa cuenta todavía no tiene alcancía. Abre la app una vez.')
    process.exit(1)
  }

  const rules = treasury.rules as RuleSet
  const byKey = new Map(treasury.members.map((m) => [m.email.split('@')[0], m]))

  console.log(`Sembrando la alcancía de ${email}…\n`)

  await prisma.approval.deleteMany({ where: { payment: { treasuryId: treasury.id } } })
  await prisma.payment.deleteMany({ where: { treasuryId: treasury.id } })

  // Los topes diario y mensual se evalúan contra lo ya gastado en esa ventana,
  // así que acumulamos por día y por mes mientras sembramos.
  const spentByDay = new Map<string, number>()
  const spentByMonth = new Map<string, number>()
  const key = (d: Date, scope: 'day' | 'month') =>
    scope === 'day' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 7)

  let index = 0
  for (const entry of HISTORY) {
    const requester = byKey.get(entry.from)
    const beneficiary = byKey.get(entry.to)
    if (!requester || !beneficiary) {
      throw new Error(`Falta el integrante ${entry.from} o ${entry.to}`)
    }

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
        `El pago histórico de $${entry.amount} viola el reglamento: ${result.rejectReason}. ` +
          'Ajusta HISTORY en prisma/seed.ts.',
      )
    }

    const payment = await prisma.payment.create({
      data: {
        treasuryId: treasury.id,
        requestedById: requester.id,
        toEmail: beneficiary.email,
        toAddress: beneficiary.walletAddress,
        amount: entry.amount,
        reason: entry.reason,
        rawRequest: `paga $${entry.amount} a ${beneficiary.email} por ${entry.reason.toLowerCase()}`,
        status: 'SUCCESS',
        decisionPath: result.decision,
        decisionLog: JSON.stringify(result.decisionLog),
        txHash: seedHash(index),
        executedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      },
    })

    // Aprobaciones coherentes con la vía, siempre de terceros.
    const voters = treasury.members.filter(
      (m) => m.id !== requester.id && m.id !== beneficiary.id,
    )
    const needed =
      result.decision === 'ADMIN_ONLY'
        ? voters.filter((v) => v.role === 'ADMIN').slice(0, 1)
        : result.decision === 'MULTI_SIG'
          ? voters.slice(0, result.approvalsNeeded)
          : []

    for (const voter of needed) {
      await prisma.approval.create({
        data: { paymentId: payment.id, approverId: voter.id, approved: true, createdAt },
      })
    }

    spentByDay.set(key(createdAt, 'day'), state.spentToday + entry.amount)
    spentByMonth.set(key(createdAt, 'month'), state.spentThisMonth + entry.amount)

    console.log(
      `  ${String(`$${entry.amount}`).padEnd(7)} ${beneficiary.email.padEnd(18)} ${result.decision.padEnd(11)} ${createdAt.toISOString().slice(0, 10)}`,
    )
    index += 1
  }

  const thisMonth = [...spentByMonth.entries()].at(-1)?.[1] ?? 0
  console.log(
    `\nListo. ${HISTORY.length} pagos · $${thisMonth} gastados este mes de $${rules.monthlyBudget}.`,
  )
}

main()
  .catch((error) => {
    console.error('\nFalló el seed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
