import { prisma } from '@/lib/prisma'
import { parseAllowlist } from '@/lib/rules'
import { errorResponse, requireWorkspace } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { treasury, rules } = await requireWorkspace(request)
    const allowlist = parseAllowlist(rules.allowlistCsv)

    const members = await prisma.member.findMany({
      where: { treasuryId: treasury.id },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: { id: true, email: true, name: true, role: true, walletAddress: true },
    })

    return Response.json({
      members: members.map((member) => ({
        ...member,
        inAllowlist: allowlist.includes(member.email.toLowerCase()),
      })),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
