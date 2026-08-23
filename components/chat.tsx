'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUp, ArrowUpRight, Check, X } from 'lucide-react'
import { toast } from 'sonner'

import { LogoMark } from '@/components/logo'
import { api } from '@/lib/api'
import {
  bubble,
  checkItem,
  press,
  spring,
  staggerContainer,
  verdict as verdictVariants,
} from '@/lib/motion'
import { cn, shortHash } from '@/lib/utils'
import type { CheckStep, MemberDTO, RequestOutcome } from '@/lib/types'

const EXPLORER = 'https://sepolia.etherscan.io/tx/'

/** Nombres legibles: nadie debería tener que leer snake_case. */
const CHECK_LABEL: Record<string, string> = {
  beneficiary_resolvable: 'Beneficiario identificado',
  beneficiary_in_allowlist: 'En la lista blanca',
  not_self_payment: 'No es un pago a sí mismo',
  amount_valid: 'Monto válido',
  max_single_tx: 'Tope por transacción',
  daily_limit: 'Tope diario',
  monthly_budget: 'Presupuesto mensual',
  onchain_balance: 'Fondos en la alcancía',
  approval_tier: 'Vía de aprobación',
}

type Message =
  | { id: string; role: 'user'; kind: 'text'; text: string }
  | { id: string; role: 'agent'; kind: 'thinking' }
  | { id: string; role: 'agent'; kind: 'checks'; steps: CheckStep[] }
  | { id: string; role: 'agent'; kind: 'verdict'; outcome: RequestOutcome }
  | { id: string; role: 'agent'; kind: 'error'; text: string }

let counter = 0
const nextId = () => `m${++counter}`

/**
 * La conversación con el agente.
 *
 * Pedir un pago es una petición a alguien que puede decir que no, así que se
 * lee mejor como diálogo que como formulario. El chat además deja ver el
 * razonamiento: los chequeos van cayendo uno a uno antes del veredicto, y eso
 * hace entendible por qué se aprueba o se rechaza sin que nadie lo explique.
 *
 * Lo que el chat NO hace es decidir. El texto solo se traduce a una intención;
 * la decisión la toma el motor de reglas en el servidor.
 */
export function Chat({
  currentUser,
  members,
  onSettled,
}: {
  currentUser: MemberDTO | null
  members: MemberDTO[]
  onSettled: () => void
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const reduce = useReducedMotion()

  const others = members.filter((m) => m.id !== currentUser?.id && m.inAllowlist)
  const suggestion = others[0]?.email ?? 'juan@wip.demo'

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [messages, reduce])

  async function send(text: string) {
    if (!currentUser || busy || text.trim().length < 3) return

    setDraft('')
    setBusy(true)
    setMessages((prev) => [...prev, { id: nextId(), role: 'user', kind: 'text', text }])

    const thinkingId = nextId()
    setMessages((prev) => [...prev, { id: thinkingId, role: 'agent', kind: 'thinking' }])

    try {
      const outcome = await api.post<RequestOutcome>('/api/payments/request', {
        requesterId: currentUser.id,
        rawText: text,
      })

      // El "pensando" se convierte en los chequeos: la misma burbuja cambia de
      // contenido en vez de desaparecer y aparecer otra, así que `layout` la
      // hace crecer en su sitio.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? { id: thinkingId, role: 'agent', kind: 'checks', steps: outcome.decisionLog }
            : m,
        ),
      )

      // El veredicto espera a que caiga el último chequeo: primero la causa,
      // después el efecto.
      const settle = reduce ? 120 : outcome.decisionLog.length * 130 + 320
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: nextId(), role: 'agent', kind: 'verdict', outcome }])
        if (outcome.status === 'SUCCESS') toast.success('Pago ejecutado')
        if (outcome.decision === 'REJECTED') toast.error('Solicitud rechazada')
        onSettled()
      }, settle)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId ? { id: thinkingId, role: 'agent', kind: 'error', text: detail } : m,
        ),
      )
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-1 py-2">
        {messages.length === 0 ? (
          <Welcome suggestion={suggestion} onPick={send} disabled={!currentUser} />
        ) : (
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false} mode="popLayout">
              {messages.map((message) => (
                <Bubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          void send(draft)
        }}
        className="sticky bottom-0 mt-3 flex items-end gap-2 border-t border-line bg-surface pt-3"
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          disabled={!currentUser || busy}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send(draft)
            }
          }}
          placeholder={`paga $50 a ${suggestion} por el café`}
          aria-label="Pide un pago"
          className={cn(
            'max-h-32 min-h-[42px] flex-1 resize-none rounded-[var(--radius)] border border-line',
            'bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint',
            'transition-colors focus:border-accent disabled:opacity-50',
          )}
        />
        <motion.button
          type="submit"
          disabled={!currentUser || busy || draft.trim().length < 3}
          aria-label="Enviar"
          whileHover={reduce ? undefined : { scale: 1.05 }}
          whileTap={reduce ? undefined : { scale: 0.92 }}
          transition={spring.snappy}
          className={cn(
            'flex size-[42px] shrink-0 items-center justify-center rounded-[var(--radius)]',
            'bg-accent text-accent-ink',
            'disabled:opacity-35',
          )}
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </motion.button>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Welcome({
  suggestion,
  onPick,
  disabled,
}: {
  suggestion: string
  onPick: (text: string) => void
  disabled: boolean
}) {
  const reduce = useReducedMotion()
  const examples = [
    { text: `paga $50 a ${suggestion} por el café de la oficina`, note: '' },
    { text: `paga $380 a ${suggestion} por el rediseño`, note: 'este necesita dos firmas · ' },
    { text: `paga $3,000 a ${suggestion} para el evento`, note: 'y este te lo rechazo · ' },
  ]

  return (
    <motion.div
      variants={reduce ? undefined : staggerContainer(0.08)}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'show'}
      className="flex flex-col gap-5 py-4"
    >
      <motion.div variants={reduce ? undefined : bubble('left')} className="flex gap-3">
        <Avatar />
        <div className="flex-1">
          <p className="text-sm leading-relaxed text-ink">
            Soy el guardián de esta alcancía. Pídeme un pago como se lo pedirías a
            alguien, y lo valido contra el reglamento antes de mover nada.
          </p>
          <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
            Si una regla no se cumple, te digo cuál y no hay transferencia.
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={reduce ? undefined : staggerContainer(0.06, 0.2)}
        className="flex flex-col gap-2 pl-11"
      >
        <p className="eyebrow">Prueba con esto</p>
        {examples.map((example) => (
          <motion.button
            key={example.text}
            variants={reduce ? undefined : bubble('left')}
            whileHover={reduce || disabled ? undefined : { scale: 1.015, x: 2 }}
            whileTap={reduce || disabled ? undefined : { scale: 0.985 }}
            transition={spring.snappy}
            disabled={disabled}
            onClick={() => onPick(example.text)}
            className={cn(
              'group rounded-[var(--radius)] border border-line bg-bg px-3 py-2 text-left',
              'text-[0.8125rem] text-muted',
              'hover:border-accent hover:bg-accent-wash hover:text-ink',
              'disabled:opacity-50',
            )}
          >
            <span className="text-faint transition-colors group-hover:text-accent">
              {example.note}
            </span>
            {example.text}
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  )
}

function Avatar() {
  return <LogoMark className="size-8 shrink-0 rounded-lg" />
}

function Bubble({ message }: { message: Message }) {
  const reduce = useReducedMotion()
  const side = message.role === 'user' ? 'right' : 'left'

  return (
    <motion.div
      layout={reduce ? false : 'position'}
      variants={reduce ? undefined : bubble(side)}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'show'}
      exit={reduce ? undefined : 'exit'}
      className={cn('flex gap-3', message.role === 'user' && 'justify-end')}
    >
      {message.role === 'agent' ? <Avatar /> : null}

      {message.role === 'user' ? (
        <p
          className="max-w-[85%] rounded-[var(--radius)] px-3.5 py-2.5 text-sm leading-relaxed"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {message.text}
        </p>
      ) : (
        <div className="min-w-0 flex-1">
          {message.kind === 'thinking' ? <Thinking /> : null}
          {message.kind === 'checks' ? <Checks steps={message.steps} /> : null}
          {message.kind === 'verdict' ? <Verdict outcome={message.outcome} /> : null}
          {message.kind === 'error' ? (
            <div className="rounded-[var(--radius)] border border-bad/30 bg-bad-wash px-3.5 py-2.5">
              <p className="text-[0.8125rem] leading-relaxed text-bad">{message.text}</p>
            </div>
          ) : null}
        </div>
      )}
    </motion.div>
  )
}

function Thinking() {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <p className="flex h-8 items-center text-[0.8125rem] text-muted" role="status">
        Revisando el reglamento…
      </p>
    )
  }

  return (
    <div className="flex h-8 items-center gap-1.5" role="status" aria-label="Revisando">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="size-1.5 rounded-full bg-muted"
          animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: index * 0.13,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

/** Los chequeos van cayendo: es donde se ve razonar al agente. */
function Checks({ steps }: { steps: CheckStep[] }) {
  const reduce = useReducedMotion()

  return (
    <motion.ul
      variants={reduce ? undefined : staggerContainer(0.13)}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'show'}
      className="flex flex-col gap-1.5"
    >
      {steps.map((step, index) => (
        <motion.li
          key={`${step.check}-${index}`}
          variants={reduce ? undefined : checkItem}
          className="flex items-start gap-2.5"
        >
          <motion.span
            // El aspa del fallo llega con más energía: es la que importa.
            initial={reduce ? undefined : { scale: 0.5 }}
            animate={reduce ? undefined : { scale: 1 }}
            transition={step.passed ? spring.snappy : spring.bouncy}
            className={cn(
              'mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full',
              step.passed ? 'bg-ok-wash text-ok' : 'bg-bad text-white',
            )}
            aria-hidden
          >
            {step.passed ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
          </motion.span>
          <div className="min-w-0">
            <p
              className={cn(
                'text-[0.8125rem] font-medium leading-tight',
                step.passed ? 'text-ink' : 'text-bad',
              )}
            >
              {CHECK_LABEL[step.check] ?? step.check}
            </p>
            <p className="tnum text-xs leading-snug text-muted">{step.detail}</p>
          </div>
        </motion.li>
      ))}
    </motion.ul>
  )
}

function Verdict({ outcome }: { outcome: RequestOutcome }) {
  const reduce = useReducedMotion()
  const rejected = outcome.decision === 'REJECTED'
  const failed = outcome.status === 'FAILED'
  const done = outcome.status === 'SUCCESS'
  const waiting = outcome.status === 'PENDING_APPROVAL'

  return (
    <motion.div
      variants={reduce ? undefined : verdictVariants}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'show'}
      className={cn(
        'rounded-[var(--radius)] border px-4 py-3',
        done && 'border-ok/30 bg-ok-wash',
        waiting && 'border-warn/30 bg-warn-wash',
        (rejected || failed) && 'border-bad/30 bg-bad-wash',
      )}
    >
      {done ? (
        <>
          <p className="text-sm font-semibold text-ok">Aprobado y enviado</p>
          <motion.a
            href={`${EXPLORER}${outcome.txHash}`}
            target="_blank"
            rel="noreferrer"
            whileHover={reduce ? undefined : { x: 2 }}
            transition={spring.snappy}
            className="hash mt-1.5 inline-flex items-center gap-1 font-medium text-accent underline underline-offset-2"
          >
            {shortHash(outcome.txHash!)}
            <ArrowUpRight size={13} />
          </motion.a>
          <p className="mt-1 text-xs text-muted">Compruébalo en Etherscan.</p>
        </>
      ) : null}

      {waiting ? (
        <>
          <p className="text-sm font-semibold text-warn">
            {outcome.adminRequired
              ? 'Necesita a un administrador'
              : `Necesita ${outcome.approvalsNeeded} aprobaciones`}
          </p>
          <p className="mt-1 text-[0.8125rem] text-ink">
            De gente distinta a quien lo pidió. Aparece arriba, en la banda de
            pendientes: cambia de integrante y vótalo.
          </p>
        </>
      ) : null}

      {rejected ? (
        <>
          <p className="text-sm font-semibold text-bad">No lo voy a hacer</p>
          <p className="mt-1 text-[0.8125rem] text-ink">{outcome.rejectReason}.</p>
          <p className="mt-1 text-xs text-muted">No se envió ninguna transacción.</p>
        </>
      ) : null}

      {failed ? (
        <>
          <p className="text-sm font-semibold text-bad">La transferencia falló</p>
          <p className="mt-1 text-[0.8125rem] text-ink">{outcome.errorMessage}</p>
          <p className="mt-1 text-xs text-muted">No se reintenta sola, a propósito.</p>
        </>
      ) : null}
    </motion.div>
  )
}

export { press }
