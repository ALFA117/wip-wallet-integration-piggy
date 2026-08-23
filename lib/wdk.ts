/**
 * Integración con @tetherto/wdk-cli 1.0.0-beta.3.
 *
 * Wrapper delgado sobre el binario del CLI. Es el ÚNICO lugar del proyecto que
 * invoca al CLI: si el contrato del comando cambia, se arregla aquí y nada más.
 *
 * Reglas de este archivo:
 *  - Se usa la salida `--json` y se parsea. Nada de scraping de texto humano.
 *  - Todo error del CLI se propaga con el stderr real incluido. Sin catch vacío.
 *  - Nunca se reintenta automáticamente una transferencia fallida: un pago que
 *    se manda dos veces por un retry es mucho peor que uno que falla y avisa.
 *
 * IMPORTANTE: los nombres de subcomando y flags viven en CLI_COMMANDS, abajo.
 * Están tomados de `wdk --help` y de https://docs.wdk.tether.io/cli/api-reference/
 * y deben verificarse contra el CLI instalado antes de la demo. Corre
 * `npm run wdk:check` para confirmarlos.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface TxRecord {
  txHash: string
  direction: 'in' | 'out'
  counterparty: string
  amount: number
  timestamp: string
}

export class WdkError extends Error {
  readonly stderr: string
  constructor(message: string, stderr: string) {
    super(stderr ? `${message}\n${stderr}` : message)
    this.name = 'WdkError'
    this.stderr = stderr
  }
}

/**
 * Forma de los comandos del CLI, en un solo sitio para poder corregirla sin
 * tocar la lógica. Verificar con `wdk <cmd> --help` antes de grabar la demo.
 */
const CLI_COMMANDS = {
  address: (env: WdkEnv) => [
    'wallet',
    'address',
    '--name',
    env.walletName,
    '--network',
    env.network,
    '--json',
  ],
  balance: (env: WdkEnv) => [
    'wallet',
    'balance',
    '--name',
    env.walletName,
    '--network',
    env.network,
    '--token',
    env.usdtContract,
    '--json',
  ],
  send: (env: WdkEnv, to: string, amount: number) => [
    'wallet',
    'send',
    '--name',
    env.walletName,
    '--network',
    env.network,
    '--token',
    env.usdtContract,
    '--to',
    to,
    '--amount',
    String(amount),
    '--json',
  ],
  history: (env: WdkEnv, limit: number) => [
    'wallet',
    'history',
    '--name',
    env.walletName,
    '--network',
    env.network,
    '--token',
    env.usdtContract,
    '--limit',
    String(limit),
    '--json',
  ],
} as const

interface WdkEnv {
  bin: string
  network: string
  walletName: string
  password: string
  usdtContract: string
  treasuryAddress: string
  dryRun: boolean
}

function readEnv(): WdkEnv {
  return {
    bin: process.env.WDK_CLI_BIN || 'wdk',
    network: process.env.WDK_NETWORK || 'sepolia',
    walletName: process.env.WDK_WALLET_NAME || 'wip-treasury',
    password: process.env.WDK_WALLET_PASSWORD || '',
    usdtContract: process.env.WDK_USDT_CONTRACT || '',
    treasuryAddress: process.env.WDK_TREASURY_ADDRESS || '',
    dryRun: process.env.WDK_DRY_RUN === '1',
  }
}

/** ¿Está el CLI apagado y devolviendo datos simulados? La UI lo muestra. */
export function isDryRun(): boolean {
  return readEnv().dryRun
}

async function runCli(args: string[]): Promise<unknown> {
  const env = readEnv()
  try {
    const { stdout } = await execFileAsync(env.bin, args, {
      // El password sale del entorno; nunca como argumento (queda en `ps`).
      env: { ...process.env, WDK_PASSWORD: env.password },
      maxBuffer: 1024 * 1024 * 8,
      timeout: 120_000,
      windowsHide: true,
    })
    try {
      return JSON.parse(stdout)
    } catch {
      throw new WdkError(
        `El CLI no devolvió JSON para \`${env.bin} ${args.join(' ')}\``,
        stdout.slice(0, 2000),
      )
    }
  } catch (error) {
    if (error instanceof WdkError) throw error
    const e = error as NodeJS.ErrnoException & { stderr?: string }
    if (e.code === 'ENOENT') {
      throw new WdkError(
        `No se encontró el binario \`${env.bin}\`. Instala @tetherto/wdk-cli o ajusta WDK_CLI_BIN.`,
        '',
      )
    }
    throw new WdkError(
      `Falló \`${env.bin} ${args.join(' ')}\``,
      e.stderr ?? e.message ?? '',
    )
  }
}

/**
 * Busca el primer valor presente entre varias claves candidatas. El CLI está en
 * beta y la forma exacta del JSON puede variar entre subcomandos.
 */
function pick(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined
  const record = source as Record<string, unknown>
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key]
  }
  // Algunos comandos envuelven la respuesta en { data: ... } o { result: ... }
  for (const wrapper of ['data', 'result', 'wallet']) {
    const nested = record[wrapper]
    if (nested && typeof nested === 'object') {
      const found = pick(nested, keys)
      if (found !== undefined) return found
    }
  }
  return undefined
}

function toNumber(value: unknown, fallbackDecimals: number): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      // Si viene en unidades base (entero grande), lo bajamos por decimales.
      if (!value.includes('.') && Math.abs(parsed) > 1e6) {
        return parsed / 10 ** fallbackDecimals
      }
      return parsed
    }
  }
  return 0
}

/** Dirección de la billetera del agente. */
export async function getTreasuryAddress(): Promise<string> {
  const env = readEnv()
  if (env.dryRun) return env.treasuryAddress || '0x0000000000000000000000000000000000000000'

  const json = await runCli(CLI_COMMANDS.address(env))
  const address = pick(json, ['address', 'walletAddress', 'account'])
  if (typeof address !== 'string' || !address.startsWith('0x')) {
    throw new WdkError('El CLI no devolvió una dirección válida', JSON.stringify(json).slice(0, 500))
  }
  return address
}

/**
 * Balance real de USD₮ leído del CLI. Nunca de la base de datos: el dashboard
 * tiene que cambiar si mandas fondos por fuera y recargas.
 */
export async function getUsdtBalance(): Promise<number> {
  const env = readEnv()
  if (env.dryRun) return 4820

  const json = await runCli(CLI_COMMANDS.balance(env))
  const decimals = Number(process.env.WDK_USDT_DECIMALS || 6)
  const raw = pick(json, ['balance', 'amount', 'value', 'formatted'])
  return toNumber(raw, decimals)
}

/**
 * Transferencia real de USD₮. Devuelve el hash de Sepolia.
 * No reintenta jamás: si falla, el Payment queda en FAILED y se ve en la UI.
 */
export async function sendUsdt(to: string, amount: number): Promise<{ txHash: string }> {
  const env = readEnv()

  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new WdkError(`Dirección de destino inválida: ${to}`, '')
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new WdkError(`Monto inválido: ${amount}`, '')
  }

  if (env.dryRun) {
    throw new WdkError(
      'WDK_DRY_RUN=1: las transferencias están deshabilitadas. ' +
        'Pon WDK_DRY_RUN=0 y configura la billetera para ejecutar de verdad.',
      '',
    )
  }

  const json = await runCli(CLI_COMMANDS.send(env, to, amount))
  const txHash = pick(json, ['txHash', 'hash', 'transactionHash', 'tx'])
  if (typeof txHash !== 'string' || !txHash.startsWith('0x')) {
    throw new WdkError(
      'El CLI no devolvió un txHash. La transferencia pudo haberse enviado igual: revisa la billetera antes de reintentar.',
      JSON.stringify(json).slice(0, 500),
    )
  }
  return { txHash }
}

/** Historial leído del CLI. */
export async function getHistory(limit = 20): Promise<TxRecord[]> {
  const env = readEnv()
  if (env.dryRun) return []

  const json = await runCli(CLI_COMMANDS.history(env, limit))
  const list = Array.isArray(json) ? json : pick(json, ['transactions', 'items', 'history'])
  if (!Array.isArray(list)) return []

  const decimals = Number(process.env.WDK_USDT_DECIMALS || 6)
  const treasury = (env.treasuryAddress || '').toLowerCase()

  return list.map((entry): TxRecord => {
    const from = String(pick(entry, ['from', 'sender']) ?? '')
    const to = String(pick(entry, ['to', 'recipient']) ?? '')
    const isOut = from.toLowerCase() === treasury
    return {
      txHash: String(pick(entry, ['txHash', 'hash', 'transactionHash']) ?? ''),
      direction: isOut ? 'out' : 'in',
      counterparty: isOut ? to : from,
      amount: toNumber(pick(entry, ['amount', 'value']), decimals),
      timestamp: String(pick(entry, ['timestamp', 'date', 'blockTime']) ?? new Date().toISOString()),
    }
  })
}

/** URL del explorador para un hash, para enlazar desde la UI. */
export function explorerUrl(txHash: string): string {
  const network = readEnv().network
  const host = network === 'mainnet' ? 'etherscan.io' : `${network}.etherscan.io`
  return `https://${host}/tx/${txHash}`
}
