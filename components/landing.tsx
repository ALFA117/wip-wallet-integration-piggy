'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy } from '@privy-io/react-auth'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, ArrowUpRight, Check, FileText, MessageSquareText, ShieldCheck } from 'lucide-react'

import { Logo } from '@/components/logo'
import { RuleBands } from '@/components/rule-bands'
import { Button, NetworkTag } from '@/components/ui'
import { riseItem, staggerContainer } from '@/lib/motion'
import { usePanelStatus, type PanelStatus } from '@/lib/use-status'
import { cn } from '@/lib/utils'
import type { RuleDTO } from '@/lib/types'

const REPO = 'https://github.com/ALFA117/wip-wallet-integration-piggy'
/** Transferencia real del flujo de ejemplo, enviada desde la tesorería del proyecto. */
const EXAMPLE_TX = '0x6334f1e1147fd48ed04eb295b88f425f5fd2726b87b42a4265aa6dfbfc45e8ab'

/** Los valores con los que nace cada alcancía (lib/provision.ts). */
const DEFAULT_RULES: RuleDTO = {
  id: 'default',
  autoApproveUnder: 100,
  requireApprovals: 2,
  adminOnlyOver: 500,
  monthlyBudget: 5000,
  dailyLimit: 1000,
  maxSingleTx: 2000,
  allowlistCsv: '',
}

/**
 * La portada.
 *
 * Un trabajo: que alguien entienda qué es esto antes de decidir si entra. La
 * idea en una frase, la prueba en un recibo con chequeos reales, el reglamento
 * dibujado y, al final, el estado honesto del proyecto.
 */
export function Landing() {
  const { ready, authenticated, login } = usePrivy()
  const router = useRouter()
  const reduce = useReducedMotion()
  const status = usePanelStatus()

  // Quien ya entró no tiene por qué volver a leer la portada.
  useEffect(() => {
    if (ready && authenticated) router.replace('/app')
  }, [ready, authenticated, router])

  const enter = () => (authenticated ? router.push('/app') : login())

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/95">
        <nav
          aria-label="Principal"
          className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6"
        >
          <a href="#" aria-label="WIP, inicio" className="flex shrink-0 items-center gap-3">
            <Logo className="h-6 w-auto" />
            <span className="hidden border-l border-line-strong pl-3 text-sm font-semibold text-ink sm:inline">
              Wallet Integration Piggy
            </span>
          </a>
          <div className="ml-auto hidden items-center gap-1 md:flex">
            <NavLink href="#como-decide">Cómo decide</NavLink>
            <NavLink href="#reglamento">Reglamento</NavLink>
            <NavLink href="#estado">Estado</NavLink>
          </div>
          <Button size="sm" onClick={enter} disabled={!ready} className="ml-auto md:ml-3">
            Entrar
          </Button>
        </nav>
      </header>

      <main id="contenido" className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="border-b border-line">
          <motion.div
            variants={reduce ? undefined : staggerContainer(0.07, 0.05)}
            initial={reduce ? undefined : 'hidden'}
            animate={reduce ? undefined : 'show'}
            className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-24"
          >
            <div className="flex flex-col lg:col-span-7 lg:pr-6">
              <motion.div variants={reduce ? undefined : riseItem} className="flex flex-wrap items-center gap-3">
                <NetworkTag />
                <StatusPill status={status} />
              </motion.div>

              <motion.h1
                variants={reduce ? undefined : riseItem}
                className="display mt-6 text-balance text-[clamp(2.375rem,6.4vw,4.25rem)] leading-[1.04] text-ink"
              >
                La alcancía del grupo, con un guardián que no se puede sobornar.
              </motion.h1>

              <motion.p
                variants={reduce ? undefined : riseItem}
                className="mt-6 max-w-xl text-lg leading-relaxed text-muted"
              >
                Le das una billetera a un agente y un reglamento que no puede romper.
                Pides un pago escribiéndolo; él comprueba cada regla y paga, o te dice
                exactamente cuál rompiste.
              </motion.p>

              <motion.div
                variants={reduce ? undefined : riseItem}
                className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
              >
                <Button size="lg" onClick={enter} disabled={!ready} className="w-full sm:w-auto">
                  Probar con mi alcancía
                  <ArrowRight size={18} aria-hidden />
                </Button>
                <a
                  href="#como-decide"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius)] px-4 text-base font-semibold text-accent underline-offset-4 hover:underline"
                >
                  Ver cómo decide
                </a>
              </motion.div>

              <motion.p
                variants={reduce ? undefined : riseItem}
                className="mt-4 text-sm leading-relaxed text-faint"
              >
                Gratis, en la red de pruebas Sepolia. Entras con Google, correo o tu billetera.
                {status === 'offline' ? (
                  <span className="mt-1 block font-medium text-warn">
                    Ahora mismo el panel está fuera de línea: puedes entrar, pero no cargará la
                    alcancía hasta que vuelva la base de datos.
                  </span>
                ) : null}
              </motion.p>
            </div>

            <motion.div variants={reduce ? undefined : riseItem} className="lg:col-span-5">
              <Receipt />
            </motion.div>
          </motion.div>
        </section>

        {/* ── Cómo decide ──────────────────────────────────────────────── */}
        <section id="como-decide" className="scroll-mt-20 border-b border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <SectionHead
              kicker="Cómo decide"
              title="El texto no decide. El reglamento, sí."
              lead="El lenguaje natural solo se traduce a una intención: monto, destinatario y motivo. A partir de ahí manda código determinista, no un modelo."
            />

            <ol className="mt-12 grid border-y border-line-strong md:grid-cols-3">
              <Stage
                n="01"
                icon={<MessageSquareText size={20} aria-hidden />}
                title="Lo pides como a una persona"
                body="«paga $50 a juan@wip.demo por el café». El agente extrae los datos; si falta alguno, no adivina."
              />
              <Stage
                n="02"
                icon={<ShieldCheck size={20} aria-hidden />}
                title="Nueve chequeos, en orden"
                body="Lista blanca, topes por pago, por día y por mes, fondos en la cadena y la vía de aprobación. Uno que falle basta."
              />
              <Stage
                n="03"
                icon={<FileText size={20} aria-hidden />}
                title="Paga, espera firmas o se niega"
                body="La billetera del agente firma en Sepolia, o el pago queda esperando votos. Cada rechazo queda escrito con su motivo."
                last
              />
            </ol>
          </div>
        </section>

        {/* ── Reglamento ───────────────────────────────────────────────── */}
        <section id="reglamento" className="scroll-mt-20 border-b border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionHead
                kicker="Reglamento"
                title="Una recta de dinero, partida en tramos."
                lead="Cada alcancía nace con estos valores. Un administrador los cambia desde el panel, y la recta se mueve con él."
              />
            </div>
            <div className="flex flex-col gap-6 lg:col-span-7">
              <div className="rounded-[var(--radius)] border border-line-strong bg-bg p-4 shadow-[var(--shadow-card)] sm:p-5">
                <RuleBands rules={DEFAULT_RULES} />
              </div>
              <dl className="grid grid-cols-2 border-l border-t border-line sm:grid-cols-4">
                <Limit term="Tope por pago" value="$2,000" />
                <Limit term="Tope diario" value="$1,000" />
                <Limit term="Presupuesto mensual" value="$5,000" />
                <Limit term="Destinatarios" value="Lista blanca" />
              </dl>
            </div>
          </div>
        </section>

        {/* ── Principios ───────────────────────────────────────────────── */}
        <section className="border-b border-line">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-12">
            <p className="display text-balance text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.15] text-ink lg:col-span-5">
              Nadie tiene que ser el tesorero.
            </p>
            <div className="flex flex-col divide-y divide-line border-y border-line lg:col-span-7">
              <Principle title="El reglamento lo escribieron todos">
                Topes, lista blanca y aprobaciones se acuerdan una vez. Después nadie
                tiene que decir que no: lo dice el reglamento.
              </Principle>
              <Principle title="Quien pide no se aprueba a sí mismo">
                Con los valores por defecto, entre $100 y $500 hacen falta dos firmas de personas distintas a quien
                lo pidió; por encima, un administrador.
              </Principle>
              <Principle title="También los noes quedan escritos">
                Cada solicitud guarda su rastro completo de chequeos. Es lo que hace
                auditable a un agente con dinero.
              </Principle>
            </div>
          </div>
        </section>

        {/* ── Estado ───────────────────────────────────────────────────── */}
        <section id="estado" className="scroll-mt-20">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <SectionHead
              kicker="Estado del proyecto"
              title="Qué es real y qué es de prueba."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact
                term="Red"
                value="Sepolia testnet"
                note="Transferencias reales en una red de pruebas, verificables en Etherscan."
              />
              <Fact
                term="Token"
                value="USD₮ de prueba"
                note="Un ERC-20 propio de 6 decimales en Sepolia. No tiene valor."
              />
              <Fact
                term="Billetera"
                value="Tether WDK"
                note="Una cuenta por alcancía, derivada en el servidor. La base guarda el índice, nunca la seed."
              />
              <Fact
                term="Panel"
                value={
                  status === 'online'
                    ? 'En línea'
                    : status === 'offline'
                      ? 'Fuera de línea'
                      : 'Comprobando…'
                }
                tone={status === 'online' ? 'ok' : status === 'offline' ? 'warn' : 'neutral'}
                note={
                  status === 'offline'
                    ? 'La base de datos no responde. La portada funciona; el panel no puede cargar alcancías.'
                    : 'Se comprueba al abrir esta página contra la base de datos del proyecto.'
                }
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line-strong bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Logo className="h-6 w-auto" />
            <p className="text-sm text-muted">Construido para Aleph Hackathon 2026 · WDK Track</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <a
              href={REPO}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink underline-offset-4 hover:underline"
            >
              Código en GitHub
              <ArrowUpRight size={14} aria-hidden />
            </a>
            <span className="text-faint">El dinero de esta demo no tiene valor.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ---------------------------------------------------------------------------

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-10 items-center rounded-[var(--radius)] px-3 text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      {children}
    </a>
  )
}

function StatusPill({ status }: { status: PanelStatus }) {
  const label =
    status === 'online' ? 'Panel en línea' : status === 'offline' ? 'Panel fuera de línea' : 'Comprobando el panel'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap rounded-[4px] border px-2 py-0.5 text-xs font-semibold',
        status === 'online' && 'border-ok/35 bg-ok-wash text-ok',
        status === 'offline' && 'border-warn/35 bg-warn-wash text-warn',
        status === 'checking' && 'border-line bg-surface text-muted',
      )}
      role="status"
    >
      <span className="relative flex size-1.5" aria-hidden>
        {status === 'online' ? (
          <span className="status-ping absolute inset-0 rounded-full bg-ok" />
        ) : null}
        <span
          className={cn(
            'relative size-1.5 rounded-full',
            status === 'online' && 'bg-ok',
            status === 'offline' && 'bg-warn',
            status === 'checking' && 'bg-faint',
          )}
        />
      </span>
      {label}
    </span>
  )
}

function SectionHead({ kicker, title, lead }: { kicker: string; title: string; lead?: string }) {
  return (
    <div className="max-w-2xl">
      <p className="kicker">{kicker}</p>
      <h2 className="display mt-4 text-balance text-[clamp(1.75rem,3.6vw,2.5rem)] leading-[1.15] text-ink">
        {title}
      </h2>
      {lead ? <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">{lead}</p> : null}
    </div>
  )
}

function Stage({
  n,
  icon,
  title,
  body,
  last = false,
}: {
  n: string
  icon: React.ReactNode
  title: string
  body: string
  last?: boolean
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-4 py-8 md:px-8 md:first:pl-0',
        !last && 'border-b border-line md:border-b-0 md:border-r',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-[var(--radius)] border border-line-strong bg-surface text-accent shadow-[var(--shadow-card)]">
          {icon}
        </span>
        <span className="mono text-sm text-faint">{n}</span>
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="text-base leading-relaxed text-muted">{body}</p>
    </li>
  )
}

function Limit({ term, value }: { term: string; value: string }) {
  return (
    <div className="border-b border-r border-line px-4 py-4">
      <dt className="text-[0.8125rem] text-faint">{term}</dt>
      <dd className="mono mt-1 text-base font-medium text-ink">{value}</dd>
    </div>
  )
}

function Principle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 py-6 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-8">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-base leading-relaxed text-muted">{children}</p>
    </div>
  )
}

function Fact({
  term,
  value,
  note,
  tone = 'neutral',
}: {
  term: string
  value: string
  note: string
  tone?: 'neutral' | 'ok' | 'warn'
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-[var(--radius)] border bg-surface p-5 shadow-[var(--shadow-card)]',
        tone === 'warn' ? 'border-warn/45' : tone === 'ok' ? 'border-ok/45' : 'border-line-strong',
      )}
    >
      <p className="text-[0.8125rem] font-semibold text-faint">{term}</p>
      <p
        className={cn(
          'display text-2xl',
          tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="text-sm leading-relaxed text-muted">{note}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------

/**
 * La prueba: una solicitud de ejemplo con sus chequeos, presentada como un
 * recibo. El hash es la transferencia real de ese flujo en Sepolia.
 */
function Receipt() {
  const reduce = useReducedMotion()

  const steps = [
    { label: 'En la lista blanca', detail: 'juan@wip.demo' },
    { label: 'Tope por transacción', detail: '$50 ≤ $2,000' },
    { label: 'Presupuesto del mes', detail: '$50 + $2,300 ≤ $5,000' },
    { label: 'Fondos en la alcancía', detail: 'leído de la cadena' },
  ]

  return (
    <figure className="overflow-hidden rounded-[var(--radius)] border border-line-strong bg-surface shadow-[var(--shadow-pop)]">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="text-[0.8125rem] font-semibold text-ink">Solicitud de ejemplo</span>
        <span className="mono text-xs text-faint">Sepolia</span>
      </div>

      <div className="border-b border-line bg-bg px-5 py-4">
        <p className="text-[0.8125rem] text-faint">Pedido por escrito</p>
        <p className="mt-1 text-base leading-relaxed text-ink">
          paga $50 a juan@wip.demo por el café de la oficina
        </p>
      </div>

      <motion.ul
        variants={reduce ? undefined : staggerContainer(0.09, 0.45)}
        initial={reduce ? undefined : 'hidden'}
        animate={reduce ? undefined : 'show'}
        className="flex flex-col px-5 py-2"
        aria-label="Chequeos del reglamento"
      >
        {steps.map((step) => (
          <motion.li
            key={step.label}
            variants={reduce ? undefined : riseItem}
            className="flex items-center gap-3 border-b border-dashed border-line py-2.5 last:border-b-0"
          >
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-full border border-ok/40 bg-ok-wash text-ok"
              aria-hidden
            >
              <Check size={12} strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1 text-[0.9375rem] text-ink">{step.label}</span>
            <span className="mono shrink-0 text-right text-[0.8125rem] text-muted">{step.detail}</span>
          </motion.li>
        ))}
      </motion.ul>
      <p className="px-5 pb-3 text-xs text-faint">4 de los 9 chequeos; los otros cinco también pasaron.</p>

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-ok/30 bg-ok-wash px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ok">
            <Check size={16} strokeWidth={3} aria-hidden />
            Aprobado y enviado
          </p>
          <p className="mono mt-1 text-[0.8125rem] text-muted">0x6334f1e1…e8ab</p>
        </div>
        <a
          href={`https://sepolia.etherscan.io/tx/${EXAMPLE_TX}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-accent underline underline-offset-4"
        >
          Ver en Etherscan
          <ArrowUpRight size={14} aria-hidden />
        </a>
      </div>
    </figure>
  )
}
