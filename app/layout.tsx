import type { Metadata, Viewport } from 'next'
import { Public_Sans } from 'next/font/google'

import { Providers } from '@/components/providers'
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
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
