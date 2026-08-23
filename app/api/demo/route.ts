import { hasHistory, seedDemoHistory } from '@/lib/demo-data'
import { errorResponse, requireWorkspace } from '@/lib/session'

export const dynamic = 'force-dynamic'
/** Son ~40 inserciones con sus aprobaciones. */
export const maxDuration = 60

export async function GET(request: Request) {
  try {
    const { treasury } = await requireWorkspace(request)
    return Response.json({ hasHistory: await hasHistory(treasury.id) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { treasury } = await requireWorkspace(request)
    const result = await seedDemoHistory(treasury.id)
    return Response.json({
      ...result,
      message: `${result.created} pagos y ${result.rejected} rechazos en tu historial.`,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
