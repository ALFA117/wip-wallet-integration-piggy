import type { Metadata } from 'next'
import { Public_Sans } from 'next/font/google'
import { Toaster } from 'sonner'

import './globals.css'

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'WIP · Wallet Integration Piggy',
  description:
    'La alcancía compartida del grupo, con un guardián que no se puede sobornar.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${publicSans.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--surface)',
              color: 'var(--ink)',
              border: '1px solid var(--border)',
            },
          }}
        />
      </body>
    </html>
  )
}
