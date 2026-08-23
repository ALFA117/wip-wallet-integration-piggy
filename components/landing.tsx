'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Check, X } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Particles } from '@/components/particles'
import { Button } from '@/components/ui'
import { riseItem, spring, staggerContainer } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * La portada.
 *
 * Tiene un trabajo: que alguien entienda qué es esto antes de decidir si entra.
 * Así que la idea va en una frase, la prueba de que funciona va en cuatro
 * líneas de chequeos reales, y el resto sobra.
 */
export function Landing() {
  const { ready, authenticated, login } = usePrivy()
  const router = useRouter()
  const reduce = useReducedMotion()

  // Quien ya entró no tiene por qué volver a leer la portada.
  useEffect(() => {
    if (ready && authenticated) router.replace('/app')
  }, [ready, authenticated, router])

  const enter = () => (authenticated ? router.push('/app') : login())

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <Particles className="pointer-events-none absolute inset-0 h-full w-full" />
      <Glow />

      <nav className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Logo className="h-6 w-auto" />
        <Button size="sm" onClick={enter} disabled={!ready}>
          Entrar
        </Button>
      </nav>

      <motion.div
        variants={reduce ? undefined : staggerContainer(0.09, 0.05)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'show'}
        className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-12"
      >
        <motion.p variants={reduce ? undefined : riseItem} className="eyebrow">
          Wallet Integration Piggy
        </motion.p>

        <motion.h1
          variants={reduce ? undefined : riseItem}
          className="mt-3 text-[clamp(2rem,6vw,3.25rem)] font-bold leading-[1.08] tracking-tight text-ink text-balance"
        >
          La alcancía del grupo, con un guardián que no se puede sobornar.
        </motion.h1>

        <motion.p
          variants={reduce ? undefined : riseItem}
          className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-muted"
        >
          Le das una billetera a un agente y un reglamento que no puede romper.
          Pides un pago escribiéndolo. Él comprueba las reglas y paga, o te dice
          exactamente cuál rompiste.
        </motion.p>

        <motion.div
          variants={reduce ? undefined : riseItem}
          className="mt-8 flex flex-wrap items-center gap-4"
        >
          <Button onClick={enter} disabled={!ready} className="gap-2 px-5">
            Probar con mi alcancía
            <ArrowRight size={16} />
          </Button>
          <span className="text-[0.8125rem] text-faint">
            Gratis, en red de pruebas. Sin instalar nada.
          </span>
        </motion.div>

        <motion.div variants={reduce ? undefined : riseItem} className="mt-14">
          <Proof />
        </motion.div>

        <motion.div
          variants={reduce ? undefined : riseItem}
          className="mt-14 grid gap-6 border-t border-line pt-8 sm:grid-cols-3"
        >
          <Point title="Sin tesorero">
            Nadie tiene que ser el que aprueba. El reglamento decide, y lo
            escribieron todos.
          </Point>
          <Point title="El texto no decide">
            El lenguaje natural solo traduce lo que pides. Quien decide es código
            determinista, no un modelo.
          </Point>
          <Point title="También los noes">
            Cada rechazo queda escrito, con su motivo. Es lo que hace auditable a
            un agente.
          </Point>
        </motion.div>
      </motion.div>

      <footer className="relative z-10 mx-auto w-full max-w-5xl px-6 py-6 text-xs text-faint">
        Transferencias reales de USD₮ en la testnet de Sepolia, verificables en
        Etherscan. El dinero no tiene valor.
      </footer>
    </main>
  )
}

// ---------------------------------------------------------------------------

/** La prueba: los chequeos reales corriendo sobre una petición de ejemplo. */
function Proof() {
  const reduce = useReducedMotion()

  const steps = [
    { label: 'En la lista blanca', detail: 'juan@wip.demo', ok: true },
    { label: 'Tope por transacción', detail: '$50 ≤ $2,000', ok: true },
    { label: 'Presupuesto del mes', detail: '$50 + $2,300 ≤ $5,000', ok: true },
    { label: 'Fondos en la alcancía', detail: 'leído de la cadena', ok: true },
  ]

  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-line bg-surface/70 backdrop-blur">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm text-ink">
          <span className="text-faint">tú · </span>
          paga $50 a juan@wip.demo por el café de la oficina
        </p>
      </div>

      <motion.ul
        variants={reduce ? undefined : staggerContainer(0.1, 0.6)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'show'}
        className="flex flex-col gap-2 px-4 py-3.5"
      >
        {steps.map((step) => (
          <motion.li
            key={step.label}
            variants={
              reduce
                ? undefined
                : {
                    hidden: { opacity: 0, x: -10, scale: 0.9 },
                    show: { opacity: 1, x: 0, scale: 1, transition: spring.bouncy },
                  }
            }
            className="flex items-center gap-2.5"
          >
            <span
              className={cn(
                'flex size-[17px] shrink-0 items-center justify-center rounded-full',
                step.ok ? 'bg-ok-wash text-ok' : 'bg-bad text-white',
              )}
              aria-hidden
            >
              {step.ok ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
            </span>
            <span className="text-[0.8125rem] font-medium text-ink">{step.label}</span>
            <span className="tnum truncate text-xs text-muted">{step.detail}</span>
          </motion.li>
        ))}
      </motion.ul>

      <motion.div
        initial={reduce ? undefined : { opacity: 0, scale: 0.9 }}
        animate={reduce ? undefined : { opacity: 1, scale: 1 }}
        transition={{ ...spring.bouncy, delay: reduce ? 0 : 1.1 }}
        className="border-t border-ok/25 bg-ok-wash px-4 py-3"
      >
        <p className="text-[0.8125rem] font-semibold text-ok">Aprobado y enviado</p>
        <p className="hash mt-0.5 text-muted">0x6334f1e1…e8ab</p>
      </motion.div>
    </div>
  )
}

function Point({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[0.9375rem] font-semibold text-ink">{title}</h2>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">{children}</p>
    </div>
  )
}

/** Dos manchas de color, una por tono de marca, como en el logotipo. */
function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -left-40 -top-52 size-[38rem] rounded-full opacity-[0.09] blur-3xl"
        style={{ background: 'var(--brand-navy)' }}
      />
      <div
        className="absolute -bottom-56 -right-40 size-[34rem] rounded-full opacity-[0.09] blur-3xl"
        style={{ background: 'var(--brand-teal)' }}
      />
    </div>
  )
}
