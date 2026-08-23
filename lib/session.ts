/**
 * Puente entre la sesión y la alcancía de quien la abre.
 *
 * Cada ruta del producto empieza por aquí: sin sesión no hay tesorería, y con
 * sesión solo se ve la propia. Es el único punto donde se decide "de quién son
 * estos datos", así que ninguna consulta de abajo tiene que acordarse.
 */

import { auth } from '@/auth'
import { getWorkspace } from '@/lib/provision'

export class Unauthorized extends Error {
  constructor() {
    super('Inicia sesión para usar tu alcancía')
    this.name = 'Unauthorized'
  }
}

export async function requireWorkspace() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new Unauthorized()

  const workspace = await getWorkspace(userId)
  return { ...workspace, userId, sessionUser: session.user }
}

/** Traduce los errores conocidos a respuestas HTTP. */
export function errorResponse(error: unknown): Response {
  if (error instanceof Unauthorized) {
    return Response.json({ error: error.message }, { status: 401 })
  }
  const message = error instanceof Error ? error.message : String(error)
  return Response.json({ error: message }, { status: 500 })
}
