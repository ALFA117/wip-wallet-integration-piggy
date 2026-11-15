import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WIP · Wallet Integration Piggy',
    short_name: 'WIP',
    description: 'La alcancía del grupo, con un guardián que no se puede sobornar.',
    start_url: '/',
    display: 'standalone',
    background_color: '#04121f',
    theme_color: '#04121f',
    icons: [
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
