import type { Metadata } from 'next'

import { Landing } from '@/components/landing'

export const metadata: Metadata = {
  title: 'WIP · La alcancía del grupo',
  description:
    'Un agente con billetera propia que solo paga lo que el reglamento permite. Cada pago y cada rechazo, escritos.',
}

export default function Page() {
  return <Landing />
}
