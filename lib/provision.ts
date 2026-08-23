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

/** Reserva un hueco de índices para el usuario, si aún no tiene uno. */
async function assignSlot(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletIndex: true },
  })
  if (user?.walletIndex != null) return user.walletIndex

  // El siguiente hueco libre. Con pocos usuarios simultáneos basta; para
  // volumen real esto sería una secuencia en la base.
  const last = await prisma.user.findFirst({
    where: { walletIndex: { not: null } },
    orderBy: { walletIndex: 'desc' },
    select: { walletIndex: true },
  })

  const slot = last?.walletIndex ? last.walletIndex + SLOT_SIZE : FIRST_SLOT * SLOT_SIZE
  await prisma.user.update({ where: { id: userId }, data: { walletIndex: slot } })
  return slot
}

export interface Workspace {
  treasuryId: string
  walletIndex: number
  address: string
  created: boolean
}

/**
 * Devuelve la alcancía del usuario, creándola la primera vez.
 * Es idempotente: llamarla de nuevo no duplica nada.
 */
export async function ensureWorkspace(userId: string): Promise<Workspace> {
  const existing = await prisma.treasury.findFirst({
    where: { ownerId: userId },
    select: { id: true, walletIndex: true, walletAddress: true },
  })
  if (existing) {
    return {
      treasuryId: existing.id,
      walletIndex: existing.walletIndex,
      address: existing.walletAddress,
      created: false,
    }
  }

  const slot = await assignSlot(userId)

  // Las direcciones salen de la seed maestra: la tesorería y sus integrantes.
  const [treasuryAddress, ...memberAddresses] = await Promise.all([
    getTreasuryAddress(slot),
    ...MEMBERS.map((_, index) => getTreasuryAddress(slot + index + 1)),
  ])

  const allowlist = MEMBERS.map((m) => `${m.key}@wip.demo`).join(',')

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
