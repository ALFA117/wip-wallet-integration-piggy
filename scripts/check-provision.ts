/**
 * Estado del aprovisionamiento: quién entró y qué alcancía tiene.
 *
 *   npx tsx scripts/check-provision.ts
 *   npx tsx scripts/check-provision.ts --reset correo@ejemplo.com
 *
 * El `--reset` borra la alcancía de una cuenta para volver a probar la primera
 * visita. Borra pagos e integrantes de esa persona, nada más.
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../lib/generated/prisma/client.ts'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

async function main() {
  const resetIndex = process.argv.indexOf('--reset')

  if (resetIndex !== -1) {
    const email = process.argv[resetIndex + 1]
    if (!email) {
      console.error('Uso: npx tsx scripts/check-provision.ts --reset correo@ejemplo.com')
      process.exit(1)
    }

    const user = await prisma.user.findFirst({ where: { email } })
    if (!user) {
      console.error(`No hay ninguna cuenta con ${email}.`)
      process.exit(1)
    }

    const { count } = await prisma.treasury.deleteMany({ where: { ownerId: user.id } })
    console.log(`Borradas ${count} alcancías de ${email}.`)
    console.log('Su índice de billetera se conserva, así que recibirá la misma dirección.')
    return
  }

  const users = await prisma.user.findMany({
    include: {
      treasuries: {
        select: {
          id: true,
          walletAddress: true,
          walletIndex: true,
          _count: { select: { members: true, payments: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (users.length === 0) {
    console.log('Todavía no ha entrado nadie.')
    return
  }

  console.log(`${users.length} cuenta${users.length === 1 ? '' : 's'}:\n`)
  for (const user of users) {
    console.log(`  ${user.email ?? '(sin correo)'}`)
    console.log(`    id     ${user.id}`)
    console.log(`    hueco  ${user.walletIndex ?? '(sin asignar)'}`)
    if (user.treasuries.length === 0) {
      console.log('    SIN ALCANCÍA — el aprovisionamiento no terminó')
    }
    for (const treasury of user.treasuries) {
      console.log(
        `    alcancía ${treasury.walletAddress} · índice ${treasury.walletIndex} · ` +
          `${treasury._count.members} integrantes · ${treasury._count.payments} pagos`,
      )
    }
    console.log()
  }

  // Dos alcancías con la misma dirección serían un fallo de aislamiento.
  const addresses = users.flatMap((u) => u.treasuries.map((t) => t.walletAddress))
  const duplicated = addresses.filter((a, i) => addresses.indexOf(a) !== i)
  console.log(
    duplicated.length === 0
      ? 'Aislamiento correcto: ninguna dirección se repite.'
      : `PROBLEMA: direcciones repetidas → ${[...new Set(duplicated)].join(', ')}`,
  )
}

main()
  .catch((error) => {
    console.error('Falló:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
