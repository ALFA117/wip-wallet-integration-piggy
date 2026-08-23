import { prisma } from '@/lib/prisma'
import { getTreasury } from '@/lib/treasury'
import { parseAllowlist } from '@/lib/rules'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { rules } = await getTreasury()
    const allowlist = parseAllowlist(rules.allowlistCsv)

    const members = await prisma.user.findMany({
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
    return Response.json({ error: String(error) }, { status: 500 })
  }
}
