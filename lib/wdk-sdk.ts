/**
 * Integración con el SDK de WDK: `@tetherto/wdk-wallet-evm`.
 *
 * Hermano de lib/wdk.ts. El wrapper del CLI lanza un proceso hijo, lo que
 * funciona en una máquina local pero no en un entorno serverless, donde no hay
 * binario. Este módulo hace el mismo trabajo con el SDK en proceso, y es el que
 * usa el despliegue público.
 *
 * Los dos son WDK oficial. La diferencia está en dónde puede correr cada uno:
 *
 *   lib/wdk.ts      @tetherto/wdk-cli          proceso hijo   local
 *   lib/wdk-sdk.ts  @tetherto/wdk-wallet-evm   en proceso     local y serverless
 *
 * Y hay una capacidad que solo existe aquí: `quoteTransfer`, que estima la
 * comisión antes de firmar. El track la menciona explícitamente ("checks
 * balances, quotes and sends USD₮").
 *
 * ── Custodia ──────────────────────────────────────────────────────────────
 * Una sola seed maestra deriva una cuenta por usuario mediante su índice BIP-44.
 * No se guarda ninguna seed en la base de datos: solo el índice, que no es
 * secreto. La seed vive en una variable de entorno del servidor y nunca sale de
 * ahí. Es un modelo custodial, apropiado para una demo en testnet y declarado
 * como tal en el README.
 */

import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { SeedSignerEvm } from '@tetherto/wdk-wallet-evm/signers'

export class WalletError extends Error {
  readonly cause?: unknown
  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'WalletError'
    this.cause = cause
  }
}

interface SdkEnv {
  seed: string
  rpcUrl: string
  tokenAddress: string
  decimals: number
}

function readEnv(): SdkEnv {
  const seed = process.env.MASTER_SEED
  if (!seed) {
    throw new WalletError(
      'Falta MASTER_SEED. Es la frase semilla de la que se derivan todas las tesorerías.',
    )
  }
  const tokenAddress = process.env.TOKEN_ADDRESS
  if (!tokenAddress) {
    throw new WalletError('Falta TOKEN_ADDRESS, el contrato del USD₮ de la demo.')
  }
  return {
    seed,
    // publicnode responde sin API key ni plan de pago. Alternativas probadas:
    // https://1rpc.io/sepolia y https://sepolia.gateway.tenderly.co
    rpcUrl: process.env.EVM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
    tokenAddress,
    decimals: Number(process.env.TOKEN_DECIMALS || 6),
  }
}

/**
 * El manager es caro de construir y no guarda estado por petición, así que se
 * reutiliza entre invocaciones dentro del mismo proceso.
 */
const globalForWdk = globalThis as unknown as { wdkManager?: WalletManagerEvm }

function getManager(): WalletManagerEvm {
  if (globalForWdk.wdkManager) return globalForWdk.wdkManager

  const env = readEnv()
  const manager = new WalletManagerEvm(new SeedSignerEvm(env.seed), {
    provider: env.rpcUrl,
  })

  if (process.env.NODE_ENV !== 'production') globalForWdk.wdkManager = manager
  return manager
}

/** La cuenta que actúa como tesorería del agente para un usuario dado. */
async function accountFor(walletIndex: number) {
  try {
    return await getManager().getAccount(walletIndex)
  } catch (error) {
    // El motivo real importa: aquí es donde aparecen los fallos del addon
    // nativo, y sin el mensaje original no hay forma de distinguirlos.
    const detail = error instanceof Error ? error.message : String(error)
    throw new WalletError(`No pude derivar la cuenta ${walletIndex}: ${detail}`, error)
  }
}

/** Convierte unidades base a decimales sin perder precisión con enteros grandes. */
function fromBaseUnits(value: bigint | string | number, decimals: number): number {
  const raw = typeof value === 'bigint' ? value.toString() : String(value)
  if (!/^\d+$/.test(raw)) return Number(raw) || 0

  const padded = raw.padStart(decimals + 1, '0')
  const whole = padded.slice(0, padded.length - decimals)
  const fraction = decimals > 0 ? padded.slice(padded.length - decimals) : ''
  return Number(fraction ? `${whole}.${fraction}` : whole)
}

/** Convierte decimales a unidades base sin pasar por coma flotante. */
function toBaseUnits(amount: number, decimals: number): bigint {
  const [whole, fraction = ''] = String(amount).split('.')
  const padded = (fraction + '0'.repeat(decimals)).slice(0, decimals)
  return BigInt(whole + padded)
}

// ---------------------------------------------------------------------------

/** Dirección de la tesorería de un usuario. */
export async function getTreasuryAddress(walletIndex: number): Promise<string> {
  const account = await accountFor(walletIndex)
  return account.getAddress()
}

/** Balance real de USD₮, leído de la cadena. Nunca de la base de datos. */
export async function getUsdtBalance(walletIndex: number): Promise<number> {
  const env = readEnv()
  const account = await accountFor(walletIndex)
  try {
    const balance = await account.getTokenBalance(env.tokenAddress)
    return fromBaseUnits(balance as bigint, env.decimals)
  } catch (error) {
    throw new WalletError('No pude leer el balance de USD₮', error)
  }
}

/** Balance de ETH nativo, que es lo que paga el gas. */
export async function getGasBalance(walletIndex: number): Promise<number> {
  const account = await accountFor(walletIndex)
  try {
    const balance = await account.getBalance()
    return fromBaseUnits(balance as bigint, 18)
  } catch (error) {
    throw new WalletError('No pude leer el balance de ETH', error)
  }
}

/**
 * Estima la comisión de una transferencia sin firmarla.
 * Es lo que permite avisar "no te alcanza el gas" antes de intentar.
 */
export async function quoteTransfer(
  walletIndex: number,
  to: string,
  amount: number,
): Promise<{ feeWei: bigint; feeEth: number }> {
  const env = readEnv()
  const account = await accountFor(walletIndex)
  try {
    const quote = await account.quoteTransfer({
      token: env.tokenAddress,
      recipient: to,
      amount: toBaseUnits(amount, env.decimals),
    })
    const feeWei = BigInt((quote as { fee: bigint | string }).fee)
    return { feeWei, feeEth: fromBaseUnits(feeWei, 18) }
  } catch (error) {
    throw new WalletError('No pude estimar la comisión', error)
  }
}

/**
 * Transferencia real de USD₮. Devuelve el hash.
 * No reintenta jamás: si falla, el Payment queda en FAILED y se ve en la UI.
 */
export async function sendUsdt(
  walletIndex: number,
  to: string,
  amount: number,
): Promise<{ txHash: string }> {
  const env = readEnv()

  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new WalletError(`Dirección de destino inválida: ${to}`)
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new WalletError(`Monto inválido: ${amount}`)
  }

  const account = await accountFor(walletIndex)
  try {
    const result = await account.transfer({
      token: env.tokenAddress,
      recipient: to,
      amount: toBaseUnits(amount, env.decimals),
    })
    const txHash = (result as { hash?: string }).hash
    if (!txHash || !txHash.startsWith('0x')) {
      throw new WalletError(
        'El SDK no devolvió un hash. La transferencia pudo haberse enviado igual: ' +
          'revisa la billetera antes de reintentar a mano.',
      )
    }
    return { txHash }
  } catch (error) {
    if (error instanceof WalletError) throw error
    const message = error instanceof Error ? error.message : String(error)
    if (/insufficient funds|gas/i.test(message)) {
      throw new WalletError(
        'La tesorería no tiene ETH para pagar el gas. Fondéala antes de transferir.',
        error,
      )
    }
    throw new WalletError(`Falló la transferencia: ${message}`, error)
  }
}

/** URL del explorador para un hash. */
export function explorerUrl(txHash: string): string {
  const base = process.env.EXPLORER_BASE || 'https://sepolia.etherscan.io/tx/'
  return `${base}${txHash}`
}
