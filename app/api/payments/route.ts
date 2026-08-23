import type { NextRequest } from 'next/server'

import { prisma } from '@/lib/prisma'
import { approvalsNeededFor } from '@/lib/treasury'
import { errorResponse, requireWorkspace } from '@/lib/session'
import type { RuleSet } from '@/lib/rules'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = [
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTING',
  'SUCCESS',
  'FAILED',
  'REJECTED',
]

export async function GET(request: NextRequest) {
  try {
    const { treasury, rules } = await requireWorkspace(request)

    const status = request.nextUrl.searchParams.get('status')
    const limit = Number(request.nextUrl.searchParams.get('limit') ?? 50)

    const payments = await prisma.payment.findMany({
      where: {
        treasuryId: treasury.id,
        ...(status && VALID_STATUSES.includes(status) ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50,
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approvals: {
          include: { approver: { select: { id: true, name: true, email: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return Response.json({
      payments: payments.map((payment) => {
        const { needed, adminRequired } = approvalsNeededFor(
          payment.decisionPath,
          rules as RuleSet,
        )
        return {
          ...payment,
          decisionLog: JSON.parse(payment.decisionLog),
          approvalsNeeded: needed,
          adminRequired,
          approvalsGiven: payment.approvals.filter((a) => a.approved).length,
        }
      }),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
