'use client'

import { ArrowUpRight } from 'lucide-react'

import { Dialog, PathBadge, StatusBadge } from '@/components/ui'
import { DecisionLog } from '@/components/decision-log'
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
  if (!payment) return null

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${money(payment.amount, 2)} USD₮ a ${payment.toEmail}`}
      description={payment.reason}
      wide
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={payment.status} />
          <PathBadge path={payment.decisionPath} />
          <span className="hash text-faint">{shortAddress(payment.toAddress)}</span>
        </div>

        <ol className="flex flex-col">
          <Event
            when={payment.createdAt}
            title={`${payment.requestedBy.name} solicitó el pago`}
          >
            <p className="rounded-[var(--radius)] bg-sunken px-3 py-2 text-[0.8125rem] text-muted italic">
              “{payment.rawRequest}”
            </p>
          </Event>

          <Event when={payment.createdAt} title="El agente evaluó el reglamento">
            <DecisionLog steps={payment.decisionLog} animate={false} />
          </Event>

          {payment.approvals.map((approval) => (
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

          {payment.status === 'PENDING_APPROVAL' ? (
            <Event
              when={null}
              title={`Faltan ${Math.max(payment.approvalsNeeded - payment.approvalsGiven, 0)} aprobaciones`}
              tone="warn"
            >
              <p className="text-[0.8125rem] text-muted">
                {payment.adminRequired
                  ? 'Tiene que aprobarlo un administrador.'
                  : 'De personas distintas a quien lo solicitó.'}
              </p>
            </Event>
          ) : null}

          {payment.rejectReason ? (
            <Event when={null} title="Rechazado" tone="bad" last>
              <p className="text-[0.8125rem] text-ink">{payment.rejectReason}</p>
              <p className="mt-1 text-xs text-muted">No se envió ninguna transacción.</p>
            </Event>
          ) : null}

          {payment.errorMessage ? (
            <Event when={payment.executedAt} title="La transferencia falló" tone="bad" last>
              <pre className="hash overflow-x-auto whitespace-pre-wrap rounded-[var(--radius)] bg-bad-wash px-3 py-2 text-bad">
                {payment.errorMessage}
              </pre>
            </Event>
          ) : null}

          {payment.txHash ? (
            <Event when={payment.executedAt} title="Ejecutado en Sepolia" tone="ok" last>
              <a
                href={`${explorerBase}${payment.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="hash inline-flex items-center gap-1 font-medium text-accent underline underline-offset-2"
              >
                {shortHash(payment.txHash)}
                <ArrowUpRight size={13} />
              </a>
            </Event>
          ) : null}
        </ol>
      </div>
    </Dialog>
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
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last ? (
        <span className="absolute left-[5px] top-3 h-full w-px bg-line" aria-hidden />
      ) : null}
      <span
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
    </li>
  )
}
