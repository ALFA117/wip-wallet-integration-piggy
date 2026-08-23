/**
 * Verifica el SDK contra la cadena real.
 *
 *   $env:MASTER_SEED="…"; npx tsx scripts/test-sdk.ts
 *
 * Debe derivar la misma dirección que el CLI para el índice 0: es la prueba de
 * que ambos backends hablan de la misma billetera.
 */

import 'dotenv/config'

import {
  getGasBalance,
  getTreasuryAddress,
  getUsdtBalance,
  quoteTransfer,
} from '../lib/wdk-sdk.ts'

async function main() {
  console.log('Derivando cuentas de la seed maestra…\n')

  for (const index of [0, 1, 2]) {
    const address = await getTreasuryAddress(index)
    const label = index === 0 ? '(la misma que el CLI)' : ''
    console.log(`  índice ${index}  ${address}  ${label}`)
  }

  const expected = process.env.WDK_TREASURY_ADDRESS
  if (expected) {
    const derived = await getTreasuryAddress(0)
    const match = derived.toLowerCase() === expected.toLowerCase()
    console.log(`\n  ¿coincide con WDK_TREASURY_ADDRESS? ${match ? 'sí' : 'NO'}`)
    if (!match) {
      console.error(`  esperaba ${expected}`)
      process.exitCode = 1
      return
    }
  }

  console.log('\nLeyendo balances del índice 0…')
  console.log(`  USD₮  ${await getUsdtBalance(0)}`)
  console.log(`  ETH   ${await getGasBalance(0)}`)

  console.log('\nEstimando comisión de una transferencia de 1 USD₮…')
  const to = await getTreasuryAddress(1)
  const quote = await quoteTransfer(0, to, 1)
  console.log(`  ${quote.feeEth} ETH  (${quote.feeWei} wei)`)

  console.log('\nEl SDK funciona. Sirve en serverless.')
}

main().catch((error) => {
  console.error('\nFalló:', error instanceof Error ? error.message : error)
  if (error instanceof Error && 'cause' in error && error.cause) {
    console.error('causa:', error.cause)
  }
  process.exitCode = 1
})
