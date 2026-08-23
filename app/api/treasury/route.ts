import { prisma } from '@/lib/prisma'
import { getUsdtBalance, isDryRun } from '@/lib/wdk'
import { getTreasury, startOfMonth } from '@/lib/treasury'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { treasury, rules } = await getTreasury()

    // El balance sale del CLI, no de la base. Si el CLI falla lo decimos en
    // vez de mostrar un número inventado.
    let onchainBalance: number | null = null
    let balanceError: string | null = null
    try {
      onchainBalance = await getUsdtBalance()
    } catch (error) {
      balanceError = error instanceof Error ? error.message : String(error)
    }

    const [spentAggregate, pendingCount, memberCount, monthly] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          treasuryId: treasury.id,
          status: { in: ['SUCCESS', 'EXECUTING'] },
          createdAt: { gte: startOfMonth() },
        },
        _sum: { amount: true },
      }),
      prisma.payment.count({
        where: { treasuryId: treasury.id, status: 'PENDING_APPROVAL' },
      }),
      prisma.user.count(),
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
    for (const payment of monthly) {
      const key = `${payment.createdAt.getFullYear()}-${String(payment.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + payment.amount)
    }

    return Response.json({
      treasury: { id: treasury.id, name: treasury.name, address: treasury.walletAddress },
      onchainBalance,
      balanceError,
      dryRun: isDryRun(),
      spentThisMonth,
      monthlyBudget: rules.monthlyBudget,
      available: Math.max(rules.monthlyBudget - spentThisMonth, 0),
      pendingCount,
      memberCount,
      chart: [...buckets.entries()].map(([month, amount]) => ({ month, amount })),
    })
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
