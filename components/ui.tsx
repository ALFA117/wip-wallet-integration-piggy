'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { PaymentStatus } from '@/lib/types'

// ---------------------------------------------------------------------------

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-medium',
        'transition-colors disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-[0.8125rem]' : 'h-10 px-4 text-sm',
        variant === 'primary' && 'bg-accent text-accent-ink hover:bg-accent-hover',
        variant === 'secondary' &&
          'border border-line-strong bg-surface text-ink hover:bg-sunken',
        variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-ink',
        variant === 'danger' && 'border border-bad/40 text-bad hover:bg-bad-wash',
        className,
      )}
      {...props}
    />
  )
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

// ---------------------------------------------------------------------------

const STATUS_STYLE: Record<PaymentStatus, { label: string; className: string }> = {
  PENDING_APPROVAL: { label: 'Pendiente', className: 'bg-warn-wash text-warn' },
  APPROVED: { label: 'Aprobado', className: 'bg-accent-wash text-accent' },
  EXECUTING: { label: 'Enviando', className: 'bg-accent-wash text-accent' },
  SUCCESS: { label: 'Pagado', className: 'bg-ok-wash text-ok' },
  FAILED: { label: 'Falló', className: 'bg-bad-wash text-bad' },
  REJECTED: { label: 'Rechazado', className: 'bg-bad-wash text-bad' },
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING_APPROVAL
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
        style.className,
      )}
    >
      {style.label}
    </span>
  )
}

export function PathBadge({ path }: { path: string }) {
  const labels: Record<string, string> = {
    AUTO: 'Automático',
    MULTI_SIG: 'Varias firmas',
    ADMIN_ONLY: 'Administrador',
    REJECTED: 'Bloqueado',
  }
  return (
    <span className="inline-flex items-center rounded-full border border-line px-2 py-0.5 text-[0.6875rem] font-medium text-muted">
      {labels[path] ?? path}
    </span>
  )
}

// ---------------------------------------------------------------------------

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  wide?: boolean
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        aria-label="Cerrar"
        className="fixed inset-0 bg-ink/35 backdrop-blur-[2px]"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative my-auto w-full rounded-[var(--radius)] border border-line bg-surface',
          'shadow-[var(--shadow-pop)] outline-none',
          wide ? 'max-w-3xl' : 'max-w-xl',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-[0.8125rem] text-muted">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 -mt-1 rounded p-1.5 text-faint transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[0.8125rem] font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="text-xs text-faint">{hint}</span> : null}
    </label>
  )
}

const controlClass =
  'w-full rounded-[var(--radius)] border border-line bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-faint transition-colors focus:border-accent'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, 'tnum', props.className)} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, 'resize-none', props.className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, props.className)} />
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-sm text-[0.8125rem] text-muted">{hint}</p>
    </div>
  )
}
