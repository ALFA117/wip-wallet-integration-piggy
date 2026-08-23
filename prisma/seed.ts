/**
 * Escenario de la demo.
 *
 * Un dashboard vacío arruina el video; uno con historial creíble se ve como un
 * producto en uso. Los pagos históricos se generan pasándolos por el MISMO
 * motor de reglas que usa la app, así que ningún registro viola los topes que
 * el reglamento declara — un jurado atento lo notaría.
 *
 *   npm run seed
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../lib/generated/prisma/client.ts'
import { evaluate, type RuleSet, type TreasuryState } from '../lib/rules.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('Falta DATABASE_URL. Copia .env.example a .env y rellénalo.')
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const TREASURY_ADDRESS =
  process.env.WDK_TREASURY_ADDRESS || '0x000000000000000000000000000000000000dEaD'

const RULES: RuleSet = {
  autoApproveUnder: 100,
  requireApprovals: 2,
  adminOnlyOver: 500,
  monthlyBudget: 5000,
  dailyLimit: 1000,
  maxSingleTx: 2000,
  allowlistCsv: 'sofia@wip.demo,juan@wip.demo,maria@wip.demo,carlos@wip.demo',
}

/**
 * Direcciones de los miembros. Reemplázalas por las 4 cuentas de prueba que
 * controlas (sección 4, paso 3 del brief) antes de grabar: el video enlaza a
 * Etherscan y estas direcciones aparecen ahí.
 */
const MEMBERS = [
  {
    email: 'sofia@wip.demo',
    name: 'Sofía Ramírez',
    role: 'ADMIN',
    walletAddress: process.env.SEED_ADDR_SOFIA || '0x1111111111111111111111111111111111111111',
  },
  {
    email: 'juan@wip.demo',
    name: 'Juan Pérez',
    role: 'MEMBER',
    walletAddress: process.env.SEED_ADDR_JUAN || '0x2222222222222222222222222222222222222222',
  },
  {
    email: 'maria@wip.demo',
    name: 'María Solís',
    role: 'MEMBER',
    walletAddress: process.env.SEED_ADDR_MARIA || '0x3333333333333333333333333333333333333333',
  },
  {
    email: 'carlos@wip.demo',
    name: 'Carlos Duarte',
    role: 'MEMBER',
    walletAddress: process.env.SEED_ADDR_CARLOS || '0x4444444444444444444444444444444444444444',
  },
] as const

/** daysAgo: cuántos días atrás ocurrió. Los del mes en curso suman ~$2,300. */
const HISTORY = [
  { daysAgo: 158, from: 'juan@wip.demo', to: 'maria@wip.demo', amount: 420, reason: 'Servidor de staging, marzo' },
  { daysAgo: 143, from: 'sofia@wip.demo', to: 'carlos@wip.demo', amount: 85, reason: 'Dominio anual' },
  { daysAgo: 121, from: 'maria@wip.demo', to: 'juan@wip.demo', amount: 640, reason: 'Diseño de la landing' },
  { daysAgo: 96, from: 'carlos@wip.demo', to: 'sofia@wip.demo', amount: 75, reason: 'Café de la oficina' },
  { daysAgo: 74, from: 'juan@wip.demo', to: 'carlos@wip.demo', amount: 310, reason: 'Licencias de monitoreo' },
  { daysAgo: 52, from: 'sofia@wip.demo', to: 'maria@wip.demo', amount: 180, reason: 'Traducción del sitio' },
  { daysAgo: 38, from: 'maria@wip.demo', to: 'carlos@wip.demo', amount: 950, reason: 'Auditoría del contrato' },
  // Mes en curso — suman 2 300, ninguno supera el tope diario de 1 000
  { daysAgo: 21, from: 'juan@wip.demo', to: 'sofia@wip.demo', amount: 980, reason: 'Freelance de frontend' },
  { daysAgo: 16, from: 'sofia@wip.demo', to: 'juan@wip.demo', amount: 60, reason: 'Café de la oficina' },
  { daysAgo: 11, from: 'carlos@wip.demo', to: 'maria@wip.demo', amount: 340, reason: 'Infraestructura del mes' },
  { daysAgo: 6, from: 'maria@wip.demo', to: 'carlos@wip.demo', amount: 920, reason: 'Soporte de guardia' },
] as const

/** Hash determinista y evidentemente sintético, para no simular uno real. */
function seedHash(index: number): string {
  return '0xseed' + String(index).padStart(2, '0') + 'f'.repeat(58)
}

function daysAgoDate(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(11, 30, 0, 0)
  return date
}

async function main() {
  console.log('Sembrando el escenario de la demo…\n')

  // Orden inverso al de las dependencias.
  await prisma.approval.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.rule.deleteMany()
  await prisma.treasury.deleteMany()
  await prisma.user.deleteMany()

  const users = new Map<string, { id: string; email: string; role: string; walletAddress: string }>()
  for (const member of MEMBERS) {
    const user = await prisma.user.create({ data: member })
    users.set(user.email, user)
    console.log(`  miembro   ${user.name.padEnd(16)} ${user.role.padEnd(7)} ${user.walletAddress}`)
  }

  const treasury = await prisma.treasury.create({
    data: { name: 'Alcancía Aleph', walletAddress: TREASURY_ADDRESS },
  })
  console.log(`\n  tesorería ${treasury.name} → ${treasury.walletAddress}`)

  await prisma.rule.create({ data: { treasuryId: treasury.id, ...RULES } })
  console.log(
    `  reglamento auto<${RULES.autoApproveUnder} · ${RULES.requireApprovals} firmas · admin>${RULES.adminOnlyOver} · mes ${RULES.monthlyBudget}\n`,
  )

  // Los topes diario y mensual se evalúan contra lo ya gastado en esa ventana,
  // así que acumulamos por día y por mes mientras sembramos.
  const spentByDay = new Map<string, number>()
  const spentByMonth = new Map<string, number>()
  const key = (date: Date, scope: 'day' | 'month') =>
    scope === 'day' ? date.toISOString().slice(0, 10) : date.toISOString().slice(0, 7)

  let index = 0
  for (const entry of HISTORY) {
    const createdAt = daysAgoDate(entry.daysAgo)
    const beneficiary = users.get(entry.to)!
    const requester = users.get(entry.from)!

    const state: TreasuryState = {
      beneficiary: { email: beneficiary.email, walletAddress: beneficiary.walletAddress },
      spentToday: spentByDay.get(key(createdAt, 'day')) ?? 0,
      spentThisMonth: spentByMonth.get(key(createdAt, 'month')) ?? 0,
      // Balance histórico plausible: el que había antes de este pago.
      onchainBalance: 4820,
    }

    const result = evaluate(
      { amount: entry.amount, toEmail: entry.to, requestedByEmail: entry.from },
      RULES,
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
        rawRequest: `paga $${entry.amount} a ${entry.to} por ${entry.reason.toLowerCase()}`,
        status: 'SUCCESS',
        decisionPath: result.decision,
        decisionLog: JSON.stringify(result.decisionLog),
        txHash: seedHash(index),
        executedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      },
    })

    // Aprobaciones coherentes con la vía de decisión, siempre de personas
    // distintas al solicitante.
    const voters = MEMBERS.filter(
      (member) => member.email !== entry.from && member.email !== entry.to,
    )
    if (result.decision === 'ADMIN_ONLY') {
      const admin = MEMBERS.find((member) => member.role === 'ADMIN' && member.email !== entry.from)
      if (admin) {
        await prisma.approval.create({
          data: { paymentId: payment.id, approverId: users.get(admin.email)!.id, approved: true, createdAt },
        })
      }
    } else if (result.decision === 'MULTI_SIG') {
      for (const voter of voters.slice(0, result.approvalsNeeded)) {
        await prisma.approval.create({
          data: { paymentId: payment.id, approverId: users.get(voter.email)!.id, approved: true, createdAt },
        })
      }
    }

    spentByDay.set(key(createdAt, 'day'), state.spentToday + entry.amount)
    spentByMonth.set(key(createdAt, 'month'), state.spentThisMonth + entry.amount)

    console.log(
      `  pago      ${String(`$${entry.amount}`).padEnd(7)} ${entry.to.padEnd(18)} ${result.decision.padEnd(11)} ${createdAt.toISOString().slice(0, 10)}`,
    )
    index += 1
  }

  const thisMonth = [...spentByMonth.entries()].at(-1)?.[1] ?? 0
  console.log(`\nListo. ${HISTORY.length} pagos · $${thisMonth} gastados este mes de $${RULES.monthlyBudget}.`)

  if (TREASURY_ADDRESS.endsWith('dEaD')) {
    console.log(
      '\nAviso: WDK_TREASURY_ADDRESS no está configurada, se usó una dirección de relleno.\n' +
        '       Ponla en .env antes de grabar la demo.',
    )
  }
}

main()
  .catch((error) => {
    console.error('\nFalló el seed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
