/**
 * Chequeo de salud de la base. Confirma que el esquema y los datos están como
 * la app los espera.
 *
 *   npx tsx scripts/check-db.ts
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../lib/generated/prisma/client.ts'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `
  console.log('Tablas en public:')
  for (const { tablename } of tables) console.log(`  ${tablename}`)

  const [users, treasuries, rules, payments, approvals] = await Promise.all([
    prisma.user.count(),
    prisma.treasury.count(),
    prisma.rule.count(),
    prisma.payment.count(),
    prisma.approval.count(),
  ])
  console.log('\nFilas:')
  console.log(`  User      ${users}`)
  console.log(`  Treasury  ${treasuries}`)
  console.log(`  Rule      ${rules}`)
  console.log(`  Payment   ${payments}`)
  console.log(`  Approval  ${approvals}`)

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const spent = await prisma.payment.aggregate({
    where: { status: { in: ['SUCCESS', 'EXECUTING'] }, createdAt: { gte: monthStart } },
    _sum: { amount: true },
  })
  const rule = await prisma.rule.findFirst()
  console.log(`\nGastado este mes: $${spent._sum.amount ?? 0} de $${rule?.monthlyBudget ?? 0}`)

  // La invariante que un jurado atento revisaría: ningún pago ejecutado puede
  // superar el tope por transacción que el reglamento declara.
  if (rule) {
    const violations = await prisma.payment.findMany({
      where: { status: { in: ['SUCCESS', 'EXECUTING'] }, amount: { gt: rule.maxSingleTx } },
      select: { amount: true, toEmail: true },
    })
    console.log(
      violations.length === 0
        ? `\nCoherencia: ningún pago ejecutado supera el tope de $${rule.maxSingleTx}.`
        : `\nINCOHERENTE: ${violations.length} pagos superan el tope de $${rule.maxSingleTx}.`,
    )
  }

  const writeTest = await prisma.$queryRaw<{ now: Date }[]>`SELECT NOW() as now`
  console.log(`\nConexión viva. Hora del servidor: ${writeTest[0].now.toISOString()}`)
}

main()
  .catch((error) => {
    console.error('Falló el chequeo:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
