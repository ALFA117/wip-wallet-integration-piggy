'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { Toaster } from 'sonner'

/**
 * Privy gestiona la identidad: Google, correo o billetera externa.
 *
 * Se le pide que cree una billetera embebida para quien no traiga una. No es la
 * tesorería —esa la deriva el servidor de su propia seed y la controla el
 * agente— pero da a cada persona una dirección propia desde el primer minuto, y
 * hace que "conectar billetera" deje de ser un requisito para probar.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!appId) {
    return (
      <>
        {children}
        <Toaster position="bottom-right" />
      </>
    )
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['google', 'email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#003b6d',
          logo: undefined,
          walletChainType: 'ethereum-only',
        },
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--surface)',
            color: 'var(--ink)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
          },
        }}
      />
    </PrivyProvider>
  )
}
