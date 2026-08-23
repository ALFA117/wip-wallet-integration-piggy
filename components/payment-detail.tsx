'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight } from 'lucide-react'

import { Dialog, PathBadge, StatusBadge } from '@/components/ui'
import { DecisionLog } from '@/components/decision-log'
import { staggerContainer, riseItem, spring } from '@/lib/motion'
import { cn, formatDateTime, money, shortAddress, shortHash } from '@/lib/utils'
import type { PaymentDTO } from '@/lib/types'

/** El recibo que nadie puede negar. */
export function PaymentDetail({
  payment,
  explorerBase,
  onClose,
}: {
  payment: PaymentDTO | null
  explorerBase: string
  onClose: () => void
}) {
  // Se retiene el último pago mientras el diálogo se cierra: si el contenido
  // desapareciera al instante, la animación de salida no tendría qué animar.
  const [shown, setShown] = useState(payment)
  useEffect(() => {
    if (payment) setShown(payment)
  }, [payment])

  if (!shown) return null

  return (
    <Dialog
      open={payment !== null}
      onClose={onClose}
      title={`${money(shown.amount, 2)} USD₮ a ${shown.toEmail}`}
      description={shown.reason}
      wide
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={shown.status} />
          <PathBadge path={shown.decisionPath} />
          <span className="hash text-faint">{shortAddress(shown.toAddress)}</span>
        </div>

        <Timeline>
          <Event
            when={shown.createdAt}
            title={`${shown.requestedBy.name} solicitó el pago`}
          >
            <p className="rounded-[var(--radius)] bg-sunken px-3 py-2 text-[0.8125rem] text-muted italic">
              “{shown.rawRequest}”
            </p>
          </Event>

          <Event when={shown.createdAt} title="El agente evaluó el reglamento">
            <DecisionLog steps={shown.decisionLog} animate={false} />
          </Event>

          {shown.approvals.map((approval) => (
            <Event
              key={approval.id}
              when={approval.createdAt}
              title={`${approval.approver.name} ${approval.approved ? 'aprobó' : 'vetó'}`}
              tone={approval.approved ? 'ok' : 'bad'}
            >
              <p className="text-[0.8125rem] text-muted">
                {approval.approver.role === 'ADMIN' ? 'Administrador' : 'Miembro'} ·{' '}
                {approval.approver.email}
              </p>
            </Event>
          ))}

          {shown.status === 'PENDING_APPROVAL' ? (
            <Event
              when={null}
              title={`Faltan ${Math.max(shown.approvalsNeeded - shown.approvalsGiven, 0)} aprobaciones`}
              tone="warn"
            >
              <p className="text-[0.8125rem] text-muted">
                {shown.adminRequired
                  ? 'Tiene que aprobarlo un administrador.'
                  : 'De personas distintas a quien lo solicitó.'}
              </p>
            </Event>
          ) : null}

          {shown.rejectReason ? (
            <Event when={null} title="Rechazado" tone="bad" last>
              <p className="text-[0.8125rem] text-ink">{shown.rejectReason}</p>
              <p className="mt-1 text-xs text-muted">No se envió ninguna transacción.</p>
            </Event>
          ) : null}

          {shown.errorMessage ? (
            <Event when={shown.executedAt} title="La transferencia falló" tone="bad" last>
              <pre className="hash overflow-x-auto whitespace-pre-wrap rounded-[var(--radius)] bg-bad-wash px-3 py-2 text-bad">
                {shown.errorMessage}
              </pre>
            </Event>
          ) : null}

          {shown.txHash ? (
            <Event when={shown.executedAt} title="Ejecutado en Sepolia" tone="ok" last>
              <a
                href={`${explorerBase}${shown.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="hash inline-flex items-center gap-1 font-medium text-accent underline underline-offset-2"
              >
                {shortHash(shown.txHash)}
                <ArrowUpRight size={13} />
              </a>
            </Event>
          ) : null}
        </Timeline>
      </div>
    </Dialog>
  )
}

/** El rastro completo, revelado en orden: es una historia, no una lista. */
function Timeline({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.ol
      variants={reduce ? undefined : staggerContainer(0.06, 0.08)}
      initial={reduce ? undefined : 'hidden'}
      animate={reduce ? undefined : 'show'}
      className="flex flex-col"
    >
      {children}
    </motion.ol>
  )
}

function Event({
  when,
  title,
  tone = 'neutral',
  last = false,
  children,
}: {
  when: string | null
  title: string
  tone?: 'neutral' | 'ok' | 'warn' | 'bad'
  last?: boolean
  children?: React.ReactNode
}) {
  const reduce = useReducedMotion()

  return (
    <motion.li
      variants={reduce ? undefined : riseItem}
      className="relative flex gap-4 pb-6 last:pb-0"
    >
      {!last ? (
        <span className="absolute left-[5px] top-3 h-full w-px bg-line" aria-hidden />
      ) : null}
      <motion.span
        initial={reduce ? undefined : { scale: 0.3 }}
        animate={reduce ? undefined : { scale: 1 }}
        transition={spring.bouncy}
        className={cn(
          'relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-surface',
          tone === 'neutral' && 'bg-line-strong',
          tone === 'ok' && 'bg-ok',
          tone === 'warn' && 'bg-warn',
          tone === 'bad' && 'bg-bad',
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="text-[0.8125rem] font-semibold text-ink">{title}</p>
          {when ? (
            <time className="tnum text-xs text-faint">{formatDateTime(when)}</time>
          ) : null}
        </div>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </motion.li>
  )
}
