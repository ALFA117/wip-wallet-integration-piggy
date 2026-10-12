import type { Metadata, Viewport } from 'next'
import { Public_Sans } from 'next/font/google'

import { Providers } from '@/components/providers'
import { AmbientTunnel } from '@/components/ambient-tunnel'
import './globals.css'

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
  display: 'swap',
})

const SITE = 'https://wip-piggy.vercel.app'
const DESCRIPTION =
  'La alcancía compartida del grupo, con un guardián que no se puede sobornar: un agente con billetera propia hace cumplir topes, lista blanca y presupuesto antes de mover USD₮ en Sepolia.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'WIP · Wallet Integration Piggy',
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: SITE,
    siteName: 'WIP',
    title: 'WIP · la alcancía del grupo con un guardián que no se soborna',
    description: DESCRIPTION,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'WIP · Wallet Integration Piggy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'WIP · Wallet Integration Piggy',
    description: 'Un agente con billetera propia que hace cumplir el reglamento de gasto del grupo. Sepolia testnet.',
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f7fa' },
    { media: '(prefers-color-scheme: dark)', color: '#04121f' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${publicSans.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <AmbientTunnel />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
