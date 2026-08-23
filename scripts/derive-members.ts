/**
 * Deriva las direcciones de los cuatro miembros de la demo.
 *
 *   $env:DEPLOY_SEED="doce palabras…"; npx tsx scripts/derive-members.ts
 *
 * Salen de la misma seed con índices 1 a 4, así que las controla la misma
 * persona — que es justo lo que pide el brief para los miembros del seed. No
 * necesitan fondos: solo reciben.
 */

import 'dotenv/config'
import { mnemonicToAccount } from 'viem/accounts'

const SEED = process.env.DEPLOY_SEED
if (!SEED) {
  console.error('Falta DEPLOY_SEED.')
  process.exit(1)
}

const MEMBERS = ['SOFIA', 'JUAN', 'MARIA', 'CARLOS'] as const

console.log('Direcciones derivadas (índice 0 es la tesorería):\n')

for (const [index, name] of MEMBERS.entries()) {
  const account = mnemonicToAccount(SEED, { addressIndex: index + 1 })
  console.log(`SEED_ADDR_${name}="${account.address}"`)
}
