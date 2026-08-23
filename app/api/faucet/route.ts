import { faucetStatus, fundTreasury, GRANT } from '@/lib/faucet'
import { errorResponse, requireWorkspace } from '@/lib/session'

export const dynamic = 'force-dynamic'
/** Fondear son dos transacciones en cadena; puede tardar. */
export const maxDuration = 60

export async function GET(request: Request) {
  try {
    await requireWorkspace(request)
    const status = await faucetStatus()
    return Response.json({ ...status, grant: GRANT })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { treasury } = await requireWorkspace(request)
    const result = await fundTreasury(treasury.id)
    return Response.json(result, { status: result.ok ? 200 : 409 })
  } catch (error) {
    return errorResponse(error)
  }
}
