'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowDown, ArrowUpRight, Check, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Card } from '@/components/ui'
import { api } from '@/lib/api'
import { spring, staggerContainer, riseItem } from '@/lib/motion'
import { cn, shortAddress, shortHash } from '@/lib/utils'

const EXPLORER = 'https://sepolia.etherscan.io'

/**
 * Los primeros pasos, en orden.
 *
 * Antes había dos tarjetas sueltas —fondear por un lado, sembrar historial por
 * otro— y quien llegaba no sabía cuál iba primero ni si necesitaba las dos. Un
 * paso a la vez, numerado, con el siguiente ya visible pero apagado: se entiende
 * dónde estás y qué falta sin tener que leer nada.
 *
 * Desaparece cuando ya no hace falta: una guía que se queda después de haberla
 * seguido estorba.
 */
export function GettingStarted({
  address,
  usdt,
  eth,
  hasHistory,
  onDone,
}: {
  address: string
  usdt: number | null
  eth: number | null
  hasHistory: boolean
  onDone: () => void
}) {
  const [funding, setFunding] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [hashes, setHashes] = useState<string[]>([])
  const reduce = useReducedMotion()

  const funded = (usdt ?? 0) >= 1 && (eth ?? 0) > 0

  async function fund() {
    setFunding(true)
    try {
      const data = await api.post<{
        message: string
        ethTxHash?: string
        usdtTxHash?: string
      }>('/api/faucet')
      setHashes([data.ethTxHash, data.usdtTxHash].filter(Boolean) as string[])
      toast.success(data.message)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setFunding(false)
    }
  }

  async function seed() {
    setSeeding(true)
    try {
      const data = await api.post<{ message: string }>('/api/demo')
      toast.success(data.message)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSeeding(false)
    }
  }

  return (
    <motion.div
      variants={reduce ? undefined : staggerContainer(0.07)}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'show'}
    >
      <Card className="overflow-hidden border-accent/25">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-accent-wash px-4 py-3 sm:px-5">
          <p className="text-[0.8125rem] font-semibold text-accent">Para empezar</p>
          <p className="text-xs text-muted">
            Todo ocurre en una red de pruebas: el dinero no vale nada.
          </p>
        </header>

        <div className="flex flex-col divide-y divide-line">
          <Step
            number={1}
            done={funded}
            title={funded ? 'Tu alcancía tiene fondos' : 'Fondea tu alcancía'}
            detail={
              funded
                ? 'Ya puedes pedir pagos.'
                : 'Necesita USD₮ para pagar y algo de ETH para las comisiones. Te lo mandamos nosotros.'
            }
            action={
              funded ? null : (
                <Button
                  onClick={fund}
                  disabled={funding}
                  className="w-full justify-center sm:w-auto"
                >
                  {funding ? 'Fondeando…' : 'Fondear'}
                </Button>
              )
            }
          />

          <Step
            number={2}
            done={false}
            waiting={!funded}
            title="Pídele un pago"
            detail={
              funded
                ? 'Escríbelo abajo como se lo pedirías a alguien. Verás los nueve chequeos antes del veredicto.'
                : 'Se desbloquea en cuanto tengas fondos.'
            }
            action={
              funded ? (
                <span className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent">
                  <motion.span
                    animate={reduce ? undefined : { y: [0, 4, 0] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <ArrowDown size={15} />
                  </motion.span>
                  aquí abajo
                </span>
              ) : null
            }
          />
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-muted">
              Tesorería{' '}
              <a
                href={`${EXPLORER}/address/${address}`}
                target="_blank"
                rel="noreferrer"
                className="hash text-accent underline underline-offset-2"
              >
                {shortAddress(address)}
              </a>
            </span>
            <span className="tnum text-faint">
              {usdt ?? 0} USD₮ · {(eth ?? 0).toFixed(4)} ETH
            </span>
          </div>

          {!hasHistory ? (
            <button
              onClick={seed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-50"
            >
              <Sparkles size={12} />
              {seeding ? 'Sembrando…' : 'Ver cómo se ve con historial'}
            </button>
          ) : null}
        </footer>

        <AnimatePresence>
          {hashes.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={spring.panel}
              className="overflow-hidden border-t border-ok/25 bg-ok-wash"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:px-5">
                <span className="text-xs font-medium text-ok">Fondos enviados</span>
                {hashes.map((hash) => (
                  <a
                    key={hash}
                    href={`${EXPLORER}/tx/${hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hash inline-flex items-center gap-1 text-accent underline underline-offset-2"
                  >
                    {shortHash(hash)}
                    <ArrowUpRight size={11} />
                  </a>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

function Step({
  number,
  title,
  detail,
  action,
  done,
  waiting = false,
}: {
  number: number
  title: string
  detail: string
  action?: React.ReactNode
  done: boolean
  /** El paso existe pero todavía no toca: se muestra apagado. */
  waiting?: boolean
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      variants={reduce ? undefined : riseItem}
      className={cn(
        'flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5',
        waiting && 'opacity-55',
      )}
    >
      <motion.span
        animate={reduce ? undefined : { scale: done ? [1, 1.18, 1] : 1 }}
        transition={spring.bouncy}
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          done ? 'bg-ok text-white' : 'bg-accent-wash text-accent',
        )}
        aria-hidden
      >
        {done ? <Check size={14} strokeWidth={3} /> : number}
      </motion.span>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold', done ? 'text-muted' : 'text-ink')}>
          {title}
        </p>
        <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{detail}</p>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </motion.div>
  )
}
