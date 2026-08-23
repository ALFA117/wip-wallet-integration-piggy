/**
 * Despliega el USD₮ de prueba en Sepolia y reparte saldo a la tesorería.
 *
 *   $env:DEPLOY_SEED="doce palabras…"; npx tsx scripts/deploy-test-usdt.ts
 *
 * Por qué existe: el USD₮ de testnet de Tether en Sepolia
 * (0xd077A400968890Eacc75cdc901F0356c943e4fDb) es real y está registrado en el
 * CLI, pero no tiene faucet público al que pudiéramos llegar durante el
 * hackathon. El brief contempla este plan B: un ERC-20 propio con 6 decimales,
 * documentado de forma prominente.
 *
 * La seed se lee de una variable de entorno y no se escribe en ningún archivo.
 */

import 'dotenv/config'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import solc from 'solc'
import { createPublicClient, createWalletClient, http, formatEther, parseUnits } from 'viem'
import { mnemonicToAccount } from 'viem/accounts'
import { sepolia } from 'viem/chains'

const SEED = process.env.DEPLOY_SEED
if (!SEED) {
  console.error('Falta DEPLOY_SEED. Pásala solo por entorno, nunca en un archivo:')
  console.error('  $env:DEPLOY_SEED="tus doce palabras"; npx tsx scripts/deploy-test-usdt.ts')
  process.exit(1)
}

/** Saldo inicial de la tesorería, en USD₮. */
const TREASURY_SUPPLY = 25_000

function compile() {
  const file = path.join(process.cwd(), 'contracts', 'TestUSDT.sol')
  const source = readFileSync(file, 'utf-8')

  const input = {
    language: 'Solidity',
    sources: { 'TestUSDT.sol': { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)))

  const fatal = (output.errors ?? []).filter((e: { severity: string }) => e.severity === 'error')
  if (fatal.length > 0) {
    for (const error of fatal) console.error(error.formattedMessage)
    throw new Error('El contrato no compila')
  }

  const contract = output.contracts['TestUSDT.sol'].TestUSDT
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}` as `0x${string}`,
  }
}

async function main() {
  const account = mnemonicToAccount(SEED!)
  console.log(`Desplegando desde ${account.address}\n`)

  const expected = process.env.WDK_TREASURY_ADDRESS
  if (expected && expected.toLowerCase() !== account.address.toLowerCase()) {
    console.error(
      `La seed deriva ${account.address}, pero WDK_TREASURY_ADDRESS dice ${expected}.\n` +
        'Son billeteras distintas: revisa cuál seed estás pasando.',
    )
    process.exit(1)
  }

  const publicClient = createPublicClient({ chain: sepolia, transport: http() })
  const walletClient = createWalletClient({ account, chain: sepolia, transport: http() })

  const balance = await publicClient.getBalance({ address: account.address })
  console.log(`Saldo para gas: ${formatEther(balance)} ETH`)
  if (balance === 0n) {
    console.error('\nSin ETH no se puede desplegar. Mina en https://sepolia-faucet.pk910.de/')
    process.exit(1)
  }

  console.log('\nCompilando TestUSDT.sol…')
  const { abi, bytecode } = compile()
  console.log(`  bytecode: ${(bytecode.length / 2 - 1).toLocaleString()} bytes`)

  console.log('\nDesplegando…')
  const hash = await walletClient.deployContract({
    abi,
    bytecode,
    args: [parseUnits(String(TREASURY_SUPPLY), 6)],
  })
  console.log(`  tx: ${hash}`)
  console.log('  esperando confirmación…')

  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  const address = receipt.contractAddress
  if (!address) throw new Error('El despliegue no devolvió dirección de contrato')

  console.log(`\n  contrato:  ${address}`)
  console.log(`  explorer:  https://sepolia.etherscan.io/address/${address}`)
  console.log(`  gas usado: ${receipt.gasUsed.toLocaleString()}`)

  const minted = await publicClient.readContract({
    address,
    abi,
    functionName: 'balanceOf',
    args: [account.address],
  })
  console.log(`  saldo:     ${Number(minted) / 1e6} USD₮ en la tesorería`)

  console.log('\n───────────────────────────────────────────────────────────')
  console.log('Registra el token en el CLI:\n')
  const spec = JSON.stringify({
    network: 'sepolia',
    token: 'testusdt',
    symbol: 'USDT',
    decimals: 6,
    address,
  })
  console.log(`  npx wdk token add '${spec}'`)
  console.log('\nY en .env:\n')
  console.log('  WDK_TOKEN="testusdt"')
  console.log('───────────────────────────────────────────────────────────')
}

main().catch((error) => {
  console.error('\nFalló el despliegue:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
