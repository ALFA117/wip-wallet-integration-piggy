'use client'

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Card } from '@/components/ui'
import { shortAddress, shortHash } from '@/lib/utils'

const EXPLORER = 'https://sepolia.etherscan.io'

/**
 * El primer paso de quien llega a probar: sin fondos no hay transferencia que
 * mirar. Un botón deja la alcancía lista, en vez de mandar a la gente a minar
 * en un faucet público.
 */
export function FundingCard({
  address,
  usdt,
  eth,
  onFunded,
}: {
  address: string
  usdt: number | null
  eth: number | null
  onFunded: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [hashes, setHashes] = useState<string[]>([])

  async function fund() {
    setLoading(true)
    try {
      const response = await fetch('/api/faucet', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.message ?? data.error ?? 'No se pudo fondear')
        return
      }

      const received = [data.ethTxHash, data.usdtTxHash].filter(Boolean) as string[]
      setHashes(received)
      toast.success(data.message)
      onFunded()
    } catch (error) {
      toast.error(String(error))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="flex flex-col gap-4 border-accent/25 bg-accent-wash p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">Empieza aquí</p>
          <h2 className="mt-1 text-base font-semibold text-ink">
            Tu alcancía necesita fondos para poder pagar
          </h2>
          <p className="mt-1 max-w-lg text-[0.8125rem] leading-relaxed text-muted">
            Te mandamos USD₮ de prueba y un poco de ETH para las comisiones. Son de la
            testnet de Sepolia: no valen dinero, pero las transferencias son reales y
            quedan en la cadena.
          </p>
        </div>
        <Button onClick={fund} disabled={loading}>
          {loading ? 'Fondeando…' : 'Fondear mi alcancía'}
        </Button>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-3 text-[0.8125rem]">
        <div className="flex gap-2">
          <dt className="text-muted">Tesorería</dt>
          <dd>
            <a
              href={`${EXPLORER}/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="hash inline-flex items-center gap-1 text-accent underline underline-offset-2"
            >
              {shortAddress(address)}
              <ArrowUpRight size={12} />
            </a>
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">USD₮</dt>
          <dd className="tnum font-medium text-ink">{usdt ?? '—'}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">ETH para comisiones</dt>
          <dd className="tnum font-medium text-ink">{eth?.toFixed(4) ?? '—'}</dd>
        </div>
      </dl>

      {hashes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3">
          <span className="text-xs text-muted">Transferencias:</span>
          {hashes.map((hash) => (
            <a
              key={hash}
              href={`${EXPLORER}/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
              className="hash inline-flex items-center gap-1 text-accent underline underline-offset-2"
            >
              {shortHash(hash)}
              <ArrowUpRight size={12} />
            </a>
          ))}
        </div>
      ) : null}
    </Card>
  )
}
