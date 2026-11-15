import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from 'next/font/google'

import { Providers } from '@/components/providers'
import './globals.css'

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
  display: 'swap',
})

// Títulos: un serif de documento. La alcancía se presenta como un reglamento
// escrito, no como una app de cripto.
const display = Source_Serif_4({
  variable: '--font-display',
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700'],
})

// Hashes, direcciones e importes del registro.
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500'],
})

const SITE = 'https://wip-piggy.vercel.app'
const DESCRIPTION =
  'La alcancía compartida del grupo, con un guardián que no se puede sobornar: un agente con billetera propia hace cumplir topes, lista blanca y presupuesto antes de mover USD₮ de prueba en Sepolia.'

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
    description:
      'Un agente con billetera propia que hace cumplir el reglamento de gasto del grupo. Sepolia testnet.',
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f4ef' },
    { media: '(prefers-color-scheme: dark)', color: '#07131f' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${publicSans.variable} ${display.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
