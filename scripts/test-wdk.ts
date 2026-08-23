/**
 * Verifica el wrapper del CLI contra la billetera real.
 *
 *   npm run wdk:check              # solo lectura
 *   npm run wdk:check -- --send 1 0xDIRECCION   # además manda 1 USD₮
 *
 * La Fase 2 termina cuando esto imprime dirección, balance e historial reales,
 * y el hash de la transferencia existe en sepolia.etherscan.io.
 */

import 'dotenv/config'

import {
  explorerUrl,
  getHistory,
  getTreasuryAddress,
  getUsdtBalance,
  isDryRun,
  sendUsdt,
} from '../lib/wdk.ts'

async function main() {
  if (isDryRun()) {
    console.log('WDK_DRY_RUN=1 — los datos son simulados.')
    console.log('Pon WDK_DRY_RUN=0 en .env para hablar con el CLI de verdad.\n')
  }

  console.log('1/3  dirección de la tesorería')
  const address = await getTreasuryAddress()
  console.log(`     ${address}\n`)

  console.log('2/3  balance de USD₮ (leído del CLI, no de la base)')
  const balance = await getUsdtBalance()
  console.log(`     ${balance} USD₮\n`)

  console.log('3/3  historial')
  try {
    const history = await getHistory(5)
    if (history.length === 0) {
      console.log('     sin movimientos todavía\n')
    } else {
      for (const tx of history) {
        const arrow = tx.direction === 'out' ? '→' : '←'
        console.log(`     ${arrow} ${tx.amount} USD₮  ${tx.counterparty}  ${tx.txHash.slice(0, 14)}…`)
      }
      console.log()
    }
  } catch (error) {
    // `wdk get history` va contra un indexador externo que pide API key. Es la
    // única de las cuatro funciones que necesita configuración extra, y la app
    // no depende de ella: el historial de pagos sale de la base, con sus
    // chequeos y aprobaciones. Se reporta y se sigue.
    const message = error instanceof Error ? error.message : String(error)
    if (/indexer|api key|403/i.test(message)) {
      console.log('     no disponible: falta la API key del indexador (opcional)')
      console.log('     wdk config set --key indexer.apiKey --value <tu-api-key>\n')
    } else {
      throw error
    }
  }

  const sendIndex = process.argv.indexOf('--send')
  if (sendIndex !== -1) {
    const amount = Number(process.argv[sendIndex + 1])
    const to = process.argv[sendIndex + 2]
    if (!Number.isFinite(amount) || !to) {
      console.error('Uso: npm run wdk:check -- --send <monto> <dirección>')
      process.exitCode = 1
      return
    }

    console.log(`Enviando ${amount} USD₮ a ${to}…`)
    const { txHash } = await sendUsdt(to, amount)
    console.log(`     txHash  ${txHash}`)
    console.log(`     verifica ${explorerUrl(txHash)}`)
  }
}

main().catch((error) => {
  console.error('\nFalló:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
