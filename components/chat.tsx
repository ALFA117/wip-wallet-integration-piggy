'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ArrowUpRight, Check, X } from 'lucide-react'
import { toast } from 'sonner'

import { LogoMark } from '@/components/logo'
import { api } from '@/lib/api'
import { cn, money, shortHash } from '@/lib/utils'
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
  | { id: string; role: 'agent'; kind: 'text'; text: string }
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

  const others = members.filter((m) => m.id !== currentUser?.id && m.inAllowlist)
  const suggestion = others[0]?.email ?? 'juan@wip.demo'

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  function push(message: Message) {
    setMessages((previous) => [...previous, message])
  }

  async function send(text: string) {
    if (!currentUser || busy || text.trim().length < 3) return

    setDraft('')
    setBusy(true)
    push({ id: nextId(), role: 'user', kind: 'text', text })

    const thinkingId = nextId()
    push({ id: thinkingId, role: 'agent', kind: 'thinking' })

    try {
      const outcome = await api.post<RequestOutcome>('/api/payments/request', {
        requesterId: currentUser.id,
        rawText: text,
      })

      // El "pensando" se sustituye por los chequeos; el veredicto llega después
      // de que terminen de caer, para que se lea la causa antes del efecto.
      setMessages((previous) =>
        previous.map((m) =>
          m.id === thinkingId
            ? { id: thinkingId, role: 'agent', kind: 'checks', steps: outcome.decisionLog }
            : m,
        ),
      )

      const delay = outcome.decisionLog.length * 160 + 240
      setTimeout(() => {
        push({ id: nextId(), role: 'agent', kind: 'verdict', outcome })
        if (outcome.status === 'SUCCESS') toast.success('Pago ejecutado')
        if (outcome.decision === 'REJECTED') toast.error('Solicitud rechazada')
        onSettled()
      }, delay)
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error)
      setMessages((previous) =>
        previous.map((m) =>
          m.id === thinkingId ? { id: thinkingId, role: 'agent', kind: 'error', text } : m,
        ),
      )
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-1 py-2">
        {messages.length === 0 ? (
          <Welcome suggestion={suggestion} onPick={send} disabled={!currentUser} />
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
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
          placeholder={`paga $50 a ${suggestion} por el café de la oficina`}
          aria-label="Pide un pago"
          className={cn(
            'max-h-32 min-h-[42px] flex-1 resize-none rounded-[var(--radius)] border border-line',
            'bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-faint',
            'transition-colors focus:border-accent disabled:opacity-50',
          )}
        />
        <button
          type="submit"
          disabled={!currentUser || busy || draft.trim().length < 3}
          aria-label="Enviar"
          className={cn(
            'flex size-[42px] shrink-0 items-center justify-center rounded-[var(--radius)]',
            'bg-accent text-accent-ink transition-all duration-150',
            'hover:bg-accent-hover active:scale-90',
            'disabled:opacity-35 disabled:hover:bg-accent',
          )}
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
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
  const examples = [
    `paga $50 a ${suggestion} por el café de la oficina`,
    `paga $380 a ${suggestion} por el rediseño`,
    `paga $3,000 a ${suggestion} para el evento`,
  ]

  return (
    <div className="flex flex-col gap-5 py-4">
      <div className="bubble-in-left flex gap-3">
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
      </div>

      <div
        className="bubble-in-left flex flex-col gap-2 pl-11"
        style={{ animationDelay: '140ms' }}
      >
        <p className="eyebrow">Prueba con esto</p>
        {examples.map((example, index) => (
          <button
            key={example}
            disabled={disabled}
            onClick={() => onPick(example)}
            className={cn(
              'group rounded-[var(--radius)] border border-line bg-bg px-3 py-2 text-left',
              'text-[0.8125rem] text-muted transition-all duration-150',
              'hover:border-accent hover:bg-accent-wash hover:text-ink',
              'active:scale-[0.98] disabled:opacity-50',
            )}
          >
            <span className="text-faint transition-colors group-hover:text-accent">
              {index === 2 ? 'y este te lo rechazo · ' : ''}
            </span>
            {example}
          </button>
        ))}
      </div>
    </div>
  )
}

function Avatar() {
  return <LogoMark className="size-8 shrink-0 rounded-lg" />
}

function Bubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="bubble-in-right flex justify-end">
        <p
          className="max-w-[85%] rounded-[var(--radius)] px-3.5 py-2.5 text-sm leading-relaxed"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {message.text}
        </p>
      </div>
    )
  }

  return (
    <div className="bubble-in-left flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1">
        {message.kind === 'thinking' ? <Thinking /> : null}
        {message.kind === 'text' ? (
          <p className="text-sm leading-relaxed text-ink">{message.text}</p>
        ) : null}
        {message.kind === 'checks' ? <Checks steps={message.steps} /> : null}
        {message.kind === 'verdict' ? <Verdict outcome={message.outcome} /> : null}
        {message.kind === 'error' ? (
          <div className="rounded-[var(--radius)] border border-bad/30 bg-bad-wash px-3.5 py-2.5">
            <p className="text-[0.8125rem] leading-relaxed text-bad">{message.text}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Thinking() {
  return (
    <div className="flex h-8 items-center gap-1.5" role="status" aria-label="Revisando">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="think-dot size-1.5 rounded-full bg-muted"
          style={{ animationDelay: `${index * 130}ms` }}
        />
      ))}
    </div>
  )
}

/** Los chequeos van cayendo: es donde se ve razonar al agente. */
function Checks({ steps }: { steps: CheckStep[] }) {
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduced) {
      setVisible(steps.length)
      return
    }

    const timers = steps.map((_, index) =>
      setTimeout(() => setVisible(index + 1), 160 * (index + 1)),
    )
    return () => timers.forEach(clearTimeout)
  }, [steps])

  return (
    <ul className="flex flex-col gap-1.5">
      {steps.slice(0, visible).map((step, index) => (
        <li key={`${step.check}-${index}`} className="check-pop flex items-start gap-2.5">
          <span
            className={cn(
              'mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full',
              step.passed ? 'bg-ok-wash text-ok' : 'bg-bad text-white',
            )}
            aria-hidden
          >
            {step.passed ? (
              <Check size={11} strokeWidth={3} />
            ) : (
              <X size={11} strokeWidth={3} />
            )}
          </span>
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
        </li>
      ))}
    </ul>
  )
}

function Verdict({ outcome }: { outcome: RequestOutcome }) {
  const rejected = outcome.decision === 'REJECTED'
  const failed = outcome.status === 'FAILED'
  const done = outcome.status === 'SUCCESS'
  const waiting = outcome.status === 'PENDING_APPROVAL'

  return (
    <div
      className={cn(
        'verdict-in rounded-[var(--radius)] border px-4 py-3',
        done && 'border-ok/30 bg-ok-wash',
        waiting && 'border-warn/30 bg-warn-wash',
        (rejected || failed) && 'border-bad/30 bg-bad-wash',
      )}
    >
      {done ? (
        <>
          <p className="text-sm font-semibold text-ok">Aprobado y enviado</p>
          <a
            href={`${EXPLORER}${outcome.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="hash mt-1.5 inline-flex items-center gap-1 font-medium text-accent underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            {shortHash(outcome.txHash!)}
            <ArrowUpRight size={13} />
          </a>
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
    </div>
  )
}
