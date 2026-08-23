'use client'

import { getAccessToken } from '@privy-io/react-auth'

/**
 * Cliente de la API.
 *
 * Adjunta el token de Privy a cada llamada y trata el 401 de una sola forma:
 * mandar a la pantalla de acceso. Sin esto, cada componente tendría que
 * acordarse de lo mismo y alguno se olvidaría.
 */

export class ApiError extends Error {
  readonly status: number
  readonly payload: unknown
  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()

  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (response.status === 401) {
    // Recarga completa a propósito, no navegación del router: al caducar la
    // sesión hay que tirar todo el estado en memoria, no conservarlo.
    if (typeof window !== 'undefined' && window.location.pathname !== '/') {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/'
    }
    throw new ApiError('Sesión caducada', 401, null)
  }

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      (payload as { error?: string; message?: string } | null)?.error ??
      (payload as { message?: string } | null)?.message ??
      `Error ${response.status}`
    throw new ApiError(message, response.status, payload)
  }

  return payload as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
}
