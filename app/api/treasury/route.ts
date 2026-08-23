import { prisma } from '@/lib/prisma'
import { getGasBalance, getUsdtBalance } from '@/lib/wdk-sdk'
import { startOfMonth } from '@/lib/treasury'
import { errorResponse, requireWorkspace } from '@/lib/session'
import { GRANT } from '@/lib/faucet'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { treasury, rules, walletIndex, sessionUser } = await requireWorkspace(request)

    // Los balances salen de la cadena, no de la base. Si el nodo falla lo
    // decimos en vez de mostrar un número inventado.
    let onchainBalance: number | null = null
    let gasBalance: number | null = null
    let balanceError: string | null = null
    try {
      ;[onchainBalance, gasBalance] = await Promise.all([
        getUsdtBalance(walletIndex),
        getGasBalance(walletIndex),
      ])
    } catch (error) {
      balanceError = error instanceof Error ? error.message : String(error)
    }

    const [spentAggregate, pendingCount, memberCount, history] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          treasuryId: treasury.id,
          status: { in: ['SUCCESS', 'EXECUTING'] },
          createdAt: { gte: startOfMonth() },
        },
        _sum: { amount: true },
      }),
      prisma.payment.count({ where: { treasuryId: treasury.id, status: 'PENDING_APPROVAL' } }),
      prisma.member.count({ where: { treasuryId: treasury.id } }),
      prisma.payment.findMany({
        where: { treasuryId: treasury.id, status: 'SUCCESS' },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const spentThisMonth = spentAggregate._sum.amount ?? 0

    // Gasto de los últimos 6 meses, para el gráfico de barras.
    const buckets = new Map<string, number>()
    const now = new Date()
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
      buckets.set(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, 0)
    }
    for (const payment of history) {
      const key = `${payment.createdAt.getFullYear()}-${String(payment.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + payment.amount)
    }

    return Response.json({
      treasury: { id: treasury.id, name: treasury.name, address: treasury.walletAddress },
      session: { name: sessionUser?.name, email: sessionUser?.email, image: sessionUser?.image },
      onchainBalance,
      gasBalance,
      balanceError,
      /** Sin gas no se puede firmar, aunque sobre USD₮. La interfaz lo avisa. */
      needsFunding: (onchainBalance ?? 0) < 1 || (gasBalance ?? 0) < GRANT.eth / 4,
      spentThisMonth,
      monthlyBudget: rules.monthlyBudget,
      available: Math.max(rules.monthlyBudget - spentThisMonth, 0),
      pendingCount,
      memberCount,
      chart: [...buckets.entries()].map(([month, amount]) => ({ month, amount })),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
