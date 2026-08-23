'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'

import { Logo } from '@/components/logo'

/**
 * Guardián de las pantallas del producto.
 *
 * La sesión de Privy se resuelve en el cliente, así que hay un instante en el
 * que no se sabe si hay identidad. Durante ese instante se muestra la marca en
 * vez de un esqueleto vacío: es más corto que un parpadeo y evita que la página
 * salte del panel a la pantalla de acceso.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy()
  const router = useRouter()

  useEffect(() => {
    if (ready && !authenticated) router.replace('/login')
  }, [ready, authenticated, router])

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Logo className="h-9 w-auto pulse-soft" />
        <span className="sr-only">Cargando</span>
      </div>
    )
  }

  return <>{children}</>
}
