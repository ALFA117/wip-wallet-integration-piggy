'use client'

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'

import { Button, Dialog, Field, Input, Select, Textarea } from '@/components/ui'
import { DecisionLog } from '@/components/decision-log'
import { api } from '@/lib/api'
import { cn, money, shortHash } from '@/lib/utils'
import type { MemberDTO, RequestOutcome } from '@/lib/types'

type Mode = 'natural' | 'form'

export function RequestDialog({
  open,
  onClose,
  currentUser,
  members,
  explorerBase,
  onSettled,
}: {
  open: boolean
  onClose: () => void
  currentUser: MemberDTO | null
  members: MemberDTO[]
  explorerBase: string
  onSettled: () => void
}) {
  const [mode, setMode] = useState<Mode>('natural')
  const [rawText, setRawText] = useState('')
  const [amount, setAmount] = useState('')
  const [toEmail, setToEmail] = useState('')
  const [reason, setReason] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState<RequestOutcome | null>(null)
  const [logDone, setLogDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allowlisted = members.filter(
    (member) => member.inAllowlist && member.id !== currentUser?.id,
  )

  function reset() {
    setRawText('')
    setAmount('')
    setToEmail('')
    setReason('')
    setOutcome(null)
    setLogDone(false)
    setError(null)
    setSubmitting(false)
  }

  function close() {
    if (outcome) onSettled()
    reset()
    onClose()
  }

  async function submit() {
    if (!currentUser) return
    setSubmitting(true)
    setError(null)
    setLogDone(false)

    const payload =
      mode === 'natural'
        ? { requesterId: currentUser.id, rawText }
        : {
            requesterId: currentUser.id,
            amount: Number(amount),
            toEmail,
            reason,
          }

    try {
      setOutcome(await api.post<RequestOutcome>('/api/payments/request', payload))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    mode === 'natural'
      ? rawText.trim().length > 3
      : Number(amount) > 0 && toEmail.length > 0 && reason.trim().length > 2

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Solicitar pago"
      description={
        outcome
          ? 'El agente evaluó la solicitud contra el reglamento.'
          : 'El agente la valida contra el reglamento antes de mover un centavo.'
      }
      wide
    >
      {!outcome ? (
        <div className="flex flex-col gap-5">
          <div className="flex gap-1 rounded-[var(--radius)] bg-sunken p-1" role="tablist">
            {(
              [
                ['natural', 'Lenguaje natural'],
                ['form', 'Formulario'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'flex-1 rounded-[4px] px-3 py-1.5 text-[0.8125rem] font-medium transition-colors',
                  mode === value
                    ? 'bg-surface text-ink shadow-[var(--shadow-card)]'
                    : 'text-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === 'natural' ? (
            <Field
              label="¿Qué hay que pagar?"
              hint="Si algo queda ambiguo, el agente pide que lo reformules en vez de adivinar."
            >
              <Textarea
                rows={3}
                value={rawText}
                onChange={(event) => setRawText(event.target.value)}
                placeholder="paga $50 a juan@wip.demo por el café de la oficina"
              />
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monto (USD₮)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="50"
                />
              </Field>
              <Field label="Beneficiario">
                <Select value={toEmail} onChange={(event) => setToEmail(event.target.value)}>
                  <option value="">Elige a un miembro…</option>
                  {allowlisted.map((member) => (
                    <option key={member.id} value={member.email}>
                      {member.name} · {member.email}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Motivo">
                  <Input
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Café de la oficina"
                  />
                </Field>
              </div>
            </div>
          )}

          {error ? (
            <p className="rounded-[var(--radius)] border border-bad/30 bg-bad-wash px-3 py-2 text-[0.8125rem] text-bad">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!canSubmit || submitting || !currentUser}>
              {submitting ? 'Evaluando…' : 'Enviar solicitud'}
            </Button>
          </div>
        </div>
      ) : (
        <Outcome
          outcome={outcome}
          logDone={logDone}
          onLogDone={() => {
            setLogDone(true)
            if (outcome.status === 'SUCCESS') toast.success('Pago ejecutado')
            if (outcome.decision === 'REJECTED') toast.error('Solicitud rechazada')
          }}
          explorerBase={explorerBase}
          onClose={close}
        />
      )}
    </Dialog>
  )
}

function Outcome({
  outcome,
  logDone,
  onLogDone,
  explorerBase,
  onClose,
}: {
  outcome: RequestOutcome
  logDone: boolean
  onLogDone: () => void
  explorerBase: string
  onClose: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <DecisionLog steps={outcome.decisionLog} onDone={onLogDone} />

      {logDone ? (
        <div className="step-in flex flex-col gap-4">
          {outcome.decision === 'REJECTED' ? (
            <Verdict tone="bad" title="Rechazado">
              {outcome.rejectReason}. No se envió ninguna transacción.
            </Verdict>
          ) : null}

          {outcome.decision === 'AUTO' && outcome.status === 'SUCCESS' && outcome.txHash ? (
            <Verdict tone="ok" title="Aprobado automáticamente y enviado">
              <a
                href={`${explorerBase}${outcome.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="hash inline-flex items-center gap-1 font-medium text-accent underline underline-offset-2"
              >
                {shortHash(outcome.txHash)}
                <ArrowUpRight size={13} />
              </a>
            </Verdict>
          ) : null}

          {outcome.status === 'FAILED' ? (
            <Verdict tone="bad" title="La transferencia falló">
              {outcome.errorMessage}. No se reintenta automáticamente.
            </Verdict>
          ) : null}

          {outcome.decision === 'MULTI_SIG' && outcome.status === 'PENDING_APPROVAL' ? (
            <Verdict tone="warn" title={`Requiere ${outcome.approvalsNeeded} aprobaciones`}>
              De personas distintas a quien la solicitó. Aparece en la banda de pendientes.
            </Verdict>
          ) : null}

          {outcome.decision === 'ADMIN_ONLY' && outcome.status === 'PENDING_APPROVAL' ? (
            <Verdict tone="warn" title="Requiere aprobación de un administrador">
              Por el monto, un miembro no basta.
            </Verdict>
          ) : null}

          <div className="flex justify-end">
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Verdict({
  tone,
  title,
  children,
}: {
  tone: 'ok' | 'warn' | 'bad'
  title: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border px-4 py-3',
        tone === 'ok' && 'border-ok/30 bg-ok-wash',
        tone === 'warn' && 'border-warn/30 bg-warn-wash',
        tone === 'bad' && 'border-bad/30 bg-bad-wash',
      )}
    >
      <p
        className={cn(
          'text-sm font-semibold',
          tone === 'ok' && 'text-ok',
          tone === 'warn' && 'text-warn',
          tone === 'bad' && 'text-bad',
        )}
      >
        {title}
      </p>
      <div className="mt-1 text-[0.8125rem] text-ink">{children}</div>
    </div>
  )
}

export { money }
