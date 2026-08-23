/**
 * Aprovisionamiento del espacio de pruebas de cada usuario.
 *
 * Al entrar por primera vez, una persona recibe su propia alcancía con su
 * reglamento y cuatro integrantes. Todo se deriva de la misma seed maestra: no
 * se guarda ninguna frase semilla, solo índices.
 *
 * Reparto de índices BIP-44, para que dos usuarios nunca colisionen:
 *
 *   0 … 9        reservados para pruebas locales (el índice 0 es el del CLI)
 *   N*10         tesorería del usuario N
 *   N*10 + 1..4  sus cuatro integrantes
 *
 * El primer usuario es N = 10, así que arranca en el índice 100.
 */

import { prisma } from '@/lib/prisma'
import { getTreasuryAddress } from '@/lib/wdk-sdk'

const FIRST_SLOT = 10
const SLOT_SIZE = 10

const MEMBERS = [
  { key: 'sofia', name: 'Sofía Ramírez', role: 'ADMIN' },
  { key: 'juan', name: 'Juan Pérez', role: 'MEMBER' },
  { key: 'maria', name: 'María Solís', role: 'MEMBER' },
  { key: 'carlos', name: 'Carlos Duarte', role: 'MEMBER' },
] as const

const DEFAULT_RULES = {
  autoApproveUnder: 100,
  requireApprovals: 2,
  adminOnlyOver: 500,
  monthlyBudget: 5000,
  dailyLimit: 1000,
  maxSingleTx: 2000,
}

/** ¿Es una violación de índice único? Es la señal de que otra petición ganó. */
function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  if (code === 'P2002') return true
  return /unique constraint/i.test(String(error))
}

/**
 * Reserva un hueco de índices para el usuario, si aún no tiene uno.
 *
 * El índice es único, así que dos peticiones simultáneas que calculen el mismo
 * hueco chocan. La que pierde reintenta con el siguiente, en vez de romperse.
 */
async function assignSlot(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletIndex: true },
  })
  if (user?.walletIndex != null) return user.walletIndex

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const last = await prisma.user.findFirst({
      where: { walletIndex: { not: null } },
      orderBy: { walletIndex: 'desc' },
      select: { walletIndex: true },
    })

    const slot = last?.walletIndex
      ? last.walletIndex + SLOT_SIZE
      : FIRST_SLOT * SLOT_SIZE

    try {
      await prisma.user.update({ where: { id: userId }, data: { walletIndex: slot } })
      return slot
    } catch (error) {
      if (!isUniqueViolation(error)) throw error

      // Otra petición tomó ese hueco. Si fue la nuestra —el mismo usuario en
      // paralelo— ya está resuelto; si no, se busca el siguiente.
      const current = await prisma.user.findUnique({
        where: { id: userId },
        select: { walletIndex: true },
      })
      if (current?.walletIndex != null) return current.walletIndex
    }
  }

  throw new Error('No pude reservar un hueco de billetera. Vuelve a intentarlo.')
}

export interface Workspace {
  treasuryId: string
  walletIndex: number
  address: string
  created: boolean
}

async function findExisting(userId: string): Promise<Workspace | null> {
  const existing = await prisma.treasury.findFirst({
    where: { ownerId: userId },
    select: { id: true, walletIndex: true, walletAddress: true },
  })
  if (!existing) return null
  return {
    treasuryId: existing.id,
    walletIndex: existing.walletIndex,
    address: existing.walletAddress,
    created: false,
  }
}

/**
 * Devuelve la alcancía del usuario, creándola la primera vez.
 *
 * Idempotente incluso en paralelo, y eso importa: el panel pide tesorería,
 * integrantes y pagos a la vez, así que en la primera visita tres peticiones
 * llegan aquí al mismo tiempo y las tres ven que no hay nada. Una crea y las
 * otras dos chocan contra el índice único de `walletAddress`; las perdedoras
 * releen en vez de fallar.
 */
export async function ensureWorkspace(userId: string): Promise<Workspace> {
  const existing = await findExisting(userId)
  if (existing) return existing

  const slot = await assignSlot(userId)

  // Las direcciones salen de la seed maestra: la tesorería y sus integrantes.
  const [treasuryAddress, ...memberAddresses] = await Promise.all([
    getTreasuryAddress(slot),
    ...MEMBERS.map((_, index) => getTreasuryAddress(slot + index + 1)),
  ])

  const allowlist = MEMBERS.map((m) => `${m.key}@wip.demo`).join(',')

  try {
    const treasury = await prisma.treasury.create({
      data: {
        name: 'Mi alcancía',
        walletAddress: treasuryAddress,
        walletIndex: slot,
        ownerId: userId,
        rules: { create: { ...DEFAULT_RULES, allowlistCsv: allowlist } },
        members: {
          create: MEMBERS.map((member, index) => ({
            email: `${member.key}@wip.demo`,
            name: member.name,
            role: member.role,
            walletAddress: memberAddresses[index],
          })),
        },
      },
      select: { id: true },
    })

    return { treasuryId: treasury.id, walletIndex: slot, address: treasuryAddress, created: true }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error

    // Otra petición la creó mientras preparábamos esta. Es el resultado
    // correcto, no un fallo: se devuelve la que ganó.
    const winner = await findExisting(userId)
    if (winner) return winner
    throw error
  }
}

/**
 * La alcancía del usuario con su reglamento.
 * Toda consulta del producto pasa por aquí, así que nadie ve datos de otro.
 */
export async function getWorkspace(userId: string) {
  const workspace = await ensureWorkspace(userId)
  const treasury = await prisma.treasury.findUniqueOrThrow({
    where: { id: workspace.treasuryId },
    include: { rules: true },
  })
  if (!treasury.rules) {
    throw new Error('La alcancía no tiene reglamento.')
  }
  return { treasury, rules: treasury.rules, walletIndex: treasury.walletIndex }
}
