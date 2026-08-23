/**
 * Faucet interno: fondea la alcancía de quien viene a probar.
 *
 * Sin esto, un juez tendría que minar en un faucet público y conseguir el token
 * por su cuenta antes de poder ver nada. Con esto, un botón le deja la alcancía
 * lista en unos segundos.
 *
 * Sale todo de una cuenta dispensadora —el índice 0 de la seed maestra— que se
 * carga a mano antes de publicar. Es un grifo con fondo limitado: cuando se
 * acaba, se acaba, y la interfaz lo dice en vez de fallar de forma críptica.
 */

import { prisma } from '@/lib/prisma'
import { getGasBalance, getUsdtBalance, sendUsdt, WalletError } from '@/lib/wdk-sdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { SeedSignerEvm } from '@tetherto/wdk-wallet-evm/signers'

/** Índice de la cuenta que reparte. */
const DISPENSER_INDEX = 0

/** Lo que recibe cada alcancía nueva. */
export const GRANT = {
  eth: 0.004, // alcanza para ~60 transferencias ERC-20
  usdt: 1000,
}

/** Una sola concesión por alcancía, salvo que se quede sin fondos. */
const COOLDOWN_MINUTES = 10

function dispenser() {
  const seed = process.env.MASTER_SEED
  if (!seed) throw new WalletError('Falta MASTER_SEED.')
  const manager = new WalletManagerEvm(new SeedSignerEvm(seed), {
    provider: process.env.EVM_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
  })
  return manager.getAccount(DISPENSER_INDEX)
}

function toWei(eth: number): bigint {
  const [whole, fraction = ''] = String(eth).split('.')
  return BigInt(whole + (fraction + '0'.repeat(18)).slice(0, 18))
}

export interface FaucetResult {
  ok: boolean
  message: string
  ethTxHash?: string
  usdtTxHash?: string
}

/**
 * Manda gas y USD₮ a una alcancía. Solo repone lo que falta: si ya tiene ETH,
 * no se le manda más.
 */
export async function fundTreasury(treasuryId: string): Promise<FaucetResult> {
  const treasury = await prisma.treasury.findUniqueOrThrow({
    where: { id: treasuryId },
    select: { walletAddress: true, walletIndex: true, lastFundedAt: true },
  })

  // El reloj corre desde el último reparto real, no desde el último cambio en
  // la fila: una alcancía recién creada nunca ha recibido nada.
  if (treasury.lastFundedAt) {
    const since = Date.now() - treasury.lastFundedAt.getTime()
    if (since < COOLDOWN_MINUTES * 60_000) {
      const wait = Math.ceil((COOLDOWN_MINUTES * 60_000 - since) / 60_000)
      return {
        ok: false,
        message: `Ya fondeaste hace poco. Espera ${wait} minuto${wait === 1 ? '' : 's'}.`,
      }
    }
  }

  const [currentEth, currentUsdt] = await Promise.all([
    getGasBalance(treasury.walletIndex),
    getUsdtBalance(treasury.walletIndex),
  ])

  const needsEth = currentEth < GRANT.eth / 2
  const needsUsdt = currentUsdt < GRANT.usdt / 2

  if (!needsEth && !needsUsdt) {
    return { ok: true, message: 'Tu alcancía ya tiene fondos suficientes.' }
  }

  // El grifo no puede quedarse sin nada: hay que dejar margen para los
  // siguientes y para el propio gas de repartir.
  const [dispenserEth, dispenserUsdt] = await Promise.all([
    getGasBalance(DISPENSER_INDEX),
    getUsdtBalance(DISPENSER_INDEX),
  ])

  if (needsEth && dispenserEth < GRANT.eth * 2) {
    return {
      ok: false,
      message: 'El faucet se quedó sin ETH para gas. Avisa a quien mantiene la demo.',
    }
  }
  if (needsUsdt && dispenserUsdt < GRANT.usdt) {
    return {
      ok: false,
      message: 'El faucet se quedó sin USD₮. Avisa a quien mantiene la demo.',
    }
  }

  const result: FaucetResult = { ok: true, message: 'Alcancía fondeada.' }

  try {
    if (needsEth) {
      const account = await dispenser()
      const tx = await account.sendTransaction({
        to: treasury.walletAddress,
        value: toWei(GRANT.eth),
      })
      result.ethTxHash = (tx as { hash?: string }).hash
    }

    if (needsUsdt) {
      const { txHash } = await sendUsdt(DISPENSER_INDEX, treasury.walletAddress, GRANT.usdt)
      result.usdtTxHash = txHash
    }

    await prisma.treasury.update({
      where: { id: treasuryId },
      data: { lastFundedAt: new Date() },
    })

    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, message: `El faucet falló: ${message}` }
  }
}

/** Cuánto le queda al grifo, para mostrarlo en la interfaz. */
export async function faucetStatus() {
  const [eth, usdt] = await Promise.all([
    getGasBalance(DISPENSER_INDEX),
    getUsdtBalance(DISPENSER_INDEX),
  ])
  return {
    eth,
    usdt,
    remainingGrants: Math.min(Math.floor(eth / GRANT.eth), Math.floor(usdt / GRANT.usdt)),
  }
}
