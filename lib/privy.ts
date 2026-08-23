/**
 * Autenticación con Privy.
 *
 * Privy se encarga de la identidad —Google, correo, billetera externa— y
 * devuelve un token firmado. Aquí solo se verifica ese token y se traduce a la
 * cuenta local, que es la que decide de quién es cada alcancía.
 *
 * Lo que Privy NO hace en este producto es custodiar la tesorería: esa se
 * deriva de la seed maestra con el índice del usuario. El agente firma con su
 * propia billetera, que es el punto del proyecto; la del usuario solo lo
 * identifica.
 */

import { PrivyClient } from '@privy-io/server-auth'

import { prisma } from '@/lib/prisma'

export class Unauthorized extends Error {
  constructor(message = 'Inicia sesión para usar tu alcancía') {
    super(message)
    this.name = 'Unauthorized'
  }
}

const globalForPrivy = globalThis as unknown as { privy?: PrivyClient }

function client(): PrivyClient {
  if (globalForPrivy.privy) return globalForPrivy.privy

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET
  if (!appId || !appSecret) {
    throw new Error('Faltan NEXT_PUBLIC_PRIVY_APP_ID o PRIVY_APP_SECRET.')
  }

  const privy = new PrivyClient(appId, appSecret)
  if (process.env.NODE_ENV !== 'production') globalForPrivy.privy = privy
  return privy
}

/** Saca el token del encabezado `Authorization: Bearer …`. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice(7).trim()
  return token.length > 0 ? token : null
}

export interface Identity {
  userId: string
  email: string | null
  name: string | null
  image: string | null
}

/**
 * Verifica el token y devuelve la cuenta local, creándola la primera vez.
 *
 * Privy identifica a la persona con un DID estable (`did:privy:…`) que no
 * cambia aunque cambie de método de acceso. Ese es el ancla, no el correo:
 * alguien puede entrar hoy con Google y mañana con una billetera y sigue siendo
 * el mismo dueño de la misma alcancía.
 */
export async function identify(request: Request): Promise<Identity> {
  const token = bearerToken(request)
  if (!token) throw new Unauthorized()

  let privyUserId: string
  try {
    const claims = await client().verifyAuthToken(token)
    privyUserId = claims.userId
  } catch {
    throw new Unauthorized('Tu sesión caducó. Vuelve a entrar.')
  }

  const profile = await client().getUser(privyUserId)

  const email =
    profile.email?.address ??
    profile.google?.email ??
    null
  const name =
    profile.google?.name ??
    (email ? email.split('@')[0] : null) ??
    'Invitado'

  // El id local es el DID de Privy: estable entre métodos de acceso.
  const user = await prisma.user.upsert({
    where: { id: privyUserId },
    update: { email, name },
    create: { id: privyUserId, email, name },
    select: { id: true, email: true, name: true, image: true },
  })

  return { userId: user.id, email: user.email, name: user.name, image: user.image }
}
