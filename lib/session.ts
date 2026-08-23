/**
 * Puente entre la identidad y la alcancía de quien la abre.
 *
 * Cada ruta del producto empieza por aquí: sin token no hay tesorería, y con él
 * solo se ve la propia. Es el único punto donde se decide "de quién son estos
 * datos", así que ninguna consulta de abajo tiene que acordarse.
 */

import { getWorkspace } from '@/lib/provision'
import { identify, Unauthorized } from '@/lib/privy'

export { Unauthorized }

export async function requireWorkspace(request: Request) {
  const identity = await identify(request)
  const workspace = await getWorkspace(identity.userId)
  return { ...workspace, userId: identity.userId, sessionUser: identity }
}

/** Traduce los errores conocidos a respuestas HTTP. */
export function errorResponse(error: unknown): Response {
  if (error instanceof Unauthorized) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  const message = error instanceof Error ? error.message : String(error)
  return Response.json({ error: message }, { status: 500 })
}
