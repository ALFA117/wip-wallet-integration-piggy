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
 * La forma de los comandos está verificada contra `wdk --help` y el `--help` de
 * cada subcomando de la versión instalada:
 *
 *   wdk get address  --network <net> [--wallet <name>] [--index <n>] --json
 *   wdk get balance  --network <net> [--token <tok>]   [--wallet <name>] --json
 *   wdk get history  --network <net> [--token <tok>] [--limit <n>] [--wallet <name>] --json
 *   wdk send --network <net> --to <addr> --amount <val> [--token <tok>] [--wallet <name>] [--dry-run] --json
 *
 * Sobre el password: el CLI usa un modelo de sesión. `wdk wallet unlock --name
 * <n> --ttl 0` lo pide una sola vez por consola y levanta un daemon que guarda
 * la sesión; los comandos siguientes no vuelven a pedirlo. Por eso este archivo
 * nunca ve la passphrase, ni por argumento ni por variable de entorno.
 */

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Cómo invocar el CLI: el ejecutable y los argumentos que van antes de los
 * nuestros.
 *
 * Por defecto se ejecuta el entry point del paquete con el mismo Node que corre
 * la app. Los shims de `node_modules/.bin` son `.cmd` en Windows, y desde el
 * parche de CVE-2024-27980 Node se niega a lanzarlos sin `shell: true` — que
 * abriría la puerta a inyección de comandos. Ir directo al `.mjs` evita las dos
 * cosas y se comporta igual en Windows, macOS y Linux.
 */
function resolveBin(): { command: string; prefix: string[] } {
  const override = process.env.WDK_CLI_BIN
  if (override) return { command: override, prefix: [] }

  const entry = path.join(
    process.cwd(),
    'node_modules',
    '@tetherto',
    'wdk-cli',
    'bin',
    'wdk.mjs',
  )
  if (existsSync(entry)) return { command: process.execPath, prefix: [entry] }

  // Sin la dependencia local, se confía en una instalación global.
  return { command: 'wdk', prefix: [] }
}

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

interface WdkEnv {
  bin: { command: string; prefix: string[] }
  network: string
  wallet: string
  token: string
  treasuryAddress: string
  dryRun: boolean
}

function readEnv(): WdkEnv {
  return {
    bin: resolveBin(),
    network: process.env.WDK_NETWORK || 'sepolia',
    wallet: process.env.WDK_WALLET_NAME || '',
    // Nombre del token en el registro del CLI, no una dirección de contrato.
    // `wdk token info --network sepolia --token usdt` resuelve la dirección.
    token: process.env.WDK_TOKEN || 'usdt',
    treasuryAddress: process.env.WDK_TREASURY_ADDRESS || '',
    dryRun: process.env.WDK_DRY_RUN === '1',
  }
}

/** `--wallet <name>` solo si hay nombre; sin él, el CLI usa la billetera por defecto. */
function walletFlag(env: WdkEnv): string[] {
  return env.wallet ? ['--wallet', env.wallet] : []
}

/**
 * La forma exacta de cada comando, en un solo objeto. Verificada contra el
 * `--help` de la versión instalada.
 */
const CLI_COMMANDS = {
  address: (env: WdkEnv) => [
    'get', 'address',
    '--network', env.network,
    ...walletFlag(env),
    '--json',
  ],
  balance: (env: WdkEnv) => [
    'get', 'balance',
    '--network', env.network,
    '--token', env.token,
    ...walletFlag(env),
    '--json',
  ],
  history: (env: WdkEnv, limit: number) => [
    'get', 'history',
    '--network', env.network,
    '--token', env.token,
    '--limit', String(limit),
    ...walletFlag(env),
    '--json',
  ],
  send: (env: WdkEnv, to: string, amount: number) => [
    'send',
    '--network', env.network,
    '--to', to,
    '--amount', String(amount),
    '--token', env.token,
    ...walletFlag(env),
    '--json',
  ],
} as const

/** ¿Está el CLI apagado y devolviendo datos simulados? La interfaz lo muestra. */
export function isDryRun(): boolean {
  return readEnv().dryRun
}

async function runCli(args: string[]): Promise<unknown> {
  const env = readEnv()
  const readable = `wdk ${args.join(' ')}`

  try {
    const { stdout } = await execFileAsync(env.bin.command, [...env.bin.prefix, ...args], {
      maxBuffer: 1024 * 1024 * 8,
      timeout: 120_000,
      windowsHide: true,
    })
    try {
      return JSON.parse(stdout)
    } catch {
      throw new WdkError(`El CLI no devolvió JSON para \`${readable}\``, stdout.slice(0, 2000))
    }
  } catch (error) {
    if (error instanceof WdkError) throw error
    const e = error as NodeJS.ErrnoException & { stderr?: string; stdout?: string }

    if (e.code === 'ENOENT') {
      throw new WdkError(
        'No se encontró el CLI. Corre `npm install` o ajusta WDK_CLI_BIN.',
        '',
      )
    }

    const stderr = e.stderr || e.stdout || e.message || ''

    if (/locked|unlock|passphrase|no wallet|not found/i.test(stderr)) {
      throw new WdkError(
        `La billetera "${env.wallet || 'por defecto'}" no está disponible. ` +
          `Créala con \`npx wdk wallet create --name ${env.wallet || 'wip-treasury'}\` ` +
          `y desbloquéala con \`npx wdk wallet unlock --name ${env.wallet || 'wip-treasury'} --ttl 0\`.`,
        stderr,
      )
    }

    throw new WdkError(`Falló \`${readable}\``, stderr)
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
  for (const wrapper of ['data', 'result', 'wallet', 'balance', 'transaction']) {
    const nested = record[wrapper]
    if (nested && typeof nested === 'object') {
      const found = pick(nested, keys)
      if (found !== undefined) return found
    }
  }
  return undefined
}

/**
 * Convierte un monto del CLI a número.
 *
 * `get balance` devuelve `balance` en unidades base junto con `decimals`
 * (25000000000 y 6 para 25 000 USD₮), así que hay que escalarlo. `send`, en
 * cambio, recibe decimales salvo que se le pase `--base-units`. Son convenios
 * distintos del mismo CLI y confundirlos daría cifras un millón de veces
 * mayores en la interfaz.
 */
function fromBaseUnits(value: unknown, decimals: number): number {
  const raw = typeof value === 'bigint' ? value.toString() : String(value ?? '')
  if (!/^\d+$/.test(raw)) {
    const parsed = Number(raw.replace(/,/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }

  // División en texto para no perder precisión con enteros grandes.
  const padded = raw.padStart(decimals + 1, '0')
  const whole = padded.slice(0, padded.length - decimals)
  const fraction = decimals > 0 ? padded.slice(padded.length - decimals) : ''
  return Number(fraction ? `${whole}.${fraction}` : whole)
}

/** Dirección de la billetera del agente. */
export async function getTreasuryAddress(): Promise<string> {
  const env = readEnv()
  if (env.dryRun) {
    return env.treasuryAddress || '0x0000000000000000000000000000000000000000'
  }

  const json = await runCli(CLI_COMMANDS.address(env))
  const address = pick(json, ['address', 'walletAddress', 'account'])
  if (typeof address !== 'string' || !address.startsWith('0x')) {
    throw new WdkError(
      'El CLI no devolvió una dirección válida',
      JSON.stringify(json).slice(0, 500),
    )
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
  const decimals = Number(pick(json, ['decimals']) ?? 6)
  return fromBaseUnits(pick(json, ['balance', 'amount', 'value']), decimals)
}

/**
 * Transferencia real de USD₮. Devuelve el hash de la red.
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
        'Pon WDK_DRY_RUN=0 y desbloquea la billetera para ejecutar de verdad.',
      '',
    )
  }

  const json = await runCli(CLI_COMMANDS.send(env, to, amount))
  const txHash = pick(json, ['txHash', 'hash', 'transactionHash', 'txid', 'tx'])
  if (typeof txHash !== 'string' || !txHash.startsWith('0x')) {
    throw new WdkError(
      'El CLI no devolvió un txHash. La transferencia pudo haberse enviado igual: ' +
        'revisa la billetera antes de reintentar a mano.',
      JSON.stringify(json).slice(0, 500),
    )
  }
  return { txHash }
}

/**
 * Historial leído del CLI.
 * `wdk get history` necesita una API key de indexador configurada; si no la hay,
 * el error se propaga y la interfaz lo muestra en vez de inventar movimientos.
 */
export async function getHistory(limit = 20): Promise<TxRecord[]> {
  const env = readEnv()
  if (env.dryRun) return []

  const json = await runCli(CLI_COMMANDS.history(env, limit))
  const list = Array.isArray(json)
    ? json
    : pick(json, ['transfers', 'transactions', 'items', 'history'])
  if (!Array.isArray(list)) return []

  const treasury = (env.treasuryAddress || '').toLowerCase()

  return list.map((entry): TxRecord => {
    const from = String(pick(entry, ['from', 'sender']) ?? '')
    const to = String(pick(entry, ['to', 'recipient']) ?? '')
    const isOut = from.toLowerCase() === treasury
    const decimals = Number(pick(entry, ['decimals']) ?? 6)
    return {
      txHash: String(pick(entry, ['txHash', 'hash', 'transactionHash', 'txid']) ?? ''),
      direction: isOut ? 'out' : 'in',
      counterparty: isOut ? to : from,
      amount: fromBaseUnits(pick(entry, ['amount', 'value']), decimals),
      timestamp: String(
        pick(entry, ['timestamp', 'date', 'blockTime']) ?? new Date().toISOString(),
      ),
    }
  })
}

/** URL del explorador para un hash, para enlazar desde la interfaz. */
export function explorerUrl(txHash: string): string {
  const network = readEnv().network
  const host = network === 'ethereum' ? 'etherscan.io' : `${network}.etherscan.io`
  return `https://${host}/tx/${txHash}`
}
