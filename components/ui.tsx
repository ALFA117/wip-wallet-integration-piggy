'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'

import { panel, scrim } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { PaymentStatus } from '@/lib/types'

// ---------------------------------------------------------------------------

/**
 * Botón del sistema. El gesto es CSS (`.press`): se levanta 1 px y se hunde al
 * pulsar, con una sombra dura discreta. Sin escalas: en un producto de dinero
 * un botón que rebota se lee como juguete.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}: React.ComponentProps<typeof motion.button> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <motion.button
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius)] font-semibold',
        'whitespace-nowrap disabled:pointer-events-none disabled:opacity-45',
        variant !== 'ghost' && 'press',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-[0.9375rem]',
        size === 'lg' && 'h-12 px-5 text-base',
        variant === 'primary' &&
          'border border-accent bg-accent text-accent-ink shadow-[var(--shadow-card)] hover:bg-accent-hover',
        variant === 'secondary' &&
          'border border-line-strong bg-surface text-ink shadow-[var(--shadow-card)]',
        variant === 'ghost' && 'text-muted transition-colors hover:bg-sunken hover:text-ink',
        variant === 'danger' &&
          'border border-bad/50 bg-surface text-bad shadow-[var(--shadow-card)] hover:bg-bad-wash',
        className,
      )}
      {...props}
    />
  )
}

/** Enlace con forma de botón secundario. */
export function LinkButton({
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        'press inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-line-strong',
        'bg-surface px-4 text-[0.9375rem] font-semibold text-ink shadow-[var(--shadow-card)]',
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
        'rounded-[var(--radius)] border border-line-strong bg-surface shadow-[var(--shadow-card)]',
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

const STATUS_STYLE: Record<PaymentStatus, { label: string; className: string; dot: string }> = {
  PENDING_APPROVAL: {
    label: 'Pendiente',
    className: 'border-warn/35 bg-warn-wash text-warn',
    dot: 'bg-warn',
  },
  APPROVED: { label: 'Aprobado', className: 'border-accent/30 bg-accent-wash text-accent', dot: 'bg-accent' },
  EXECUTING: { label: 'Enviando', className: 'border-accent/30 bg-accent-wash text-accent', dot: 'bg-accent' },
  SUCCESS: { label: 'Pagado', className: 'border-ok/35 bg-ok-wash text-ok', dot: 'bg-ok' },
  FAILED: { label: 'Falló', className: 'border-bad/35 bg-bad-wash text-bad', dot: 'bg-bad' },
  REJECTED: { label: 'Rechazado', className: 'border-bad/35 bg-bad-wash text-bad', dot: 'bg-bad' },
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.PENDING_APPROVAL
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-0.5 text-xs font-semibold',
        style.className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden />
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
    <span className="inline-flex items-center rounded-[4px] border border-line px-2 py-0.5 text-xs font-medium text-muted">
      {labels[path] ?? path}
    </span>
  )
}

/** La red en la que vive todo. Siempre visible: el dinero no tiene valor. */
export function NetworkTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[4px] border border-teal/35 bg-teal-wash px-2 py-0.5 text-xs font-semibold text-teal',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-teal" aria-hidden />
      Sepolia testnet
    </span>
  )
}

// ---------------------------------------------------------------------------

/**
 * Diálogo con entrada y salida. El `AnimatePresence` vive aquí dentro, así que
 * quien lo use solo pasa `open`.
 */
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
  const openerRef = useRef<HTMLElement | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!open) return

    // Se recuerda quién abrió el diálogo para devolverle el foco al cerrar.
    openerRef.current = document.activeElement as HTMLElement | null

    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      // El foco no puede salir del diálogo.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(selector)
      if (!focusables || focusables.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      const opener = openerRef.current
      if (opener?.isConnected) opener.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-8">
          <motion.button
            aria-label="Cerrar"
            variants={reduce ? undefined : scrim}
            initial={reduce ? undefined : 'hidden'}
            animate={reduce ? undefined : 'show'}
            exit={reduce ? undefined : 'exit'}
            className="fixed inset-0 bg-ink/45"
            onClick={onClose}
            tabIndex={-1}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            variants={reduce ? undefined : panel}
            initial={reduce ? undefined : 'hidden'}
            animate={reduce ? undefined : 'show'}
            exit={reduce ? undefined : 'exit'}
            className={cn(
              'relative my-auto w-full rounded-[var(--radius)] border border-line-strong bg-surface',
              'shadow-[var(--shadow-pop)] outline-none',
              wide ? 'max-w-3xl' : 'max-w-xl',
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="display break-words text-xl text-ink">{title}</h2>
                {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="-mr-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-[var(--radius)] text-faint transition-colors hover:bg-sunken hover:text-ink"
              >
                <X size={18} />
              </button>
            </header>
            <div className="px-5 py-5 sm:px-6">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
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
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="text-[0.8125rem] leading-snug text-faint">{hint}</span> : null}
    </label>
  )
}

const controlClass =
  'min-h-11 w-full rounded-[var(--radius)] border border-line-strong bg-surface px-3 py-2 text-base text-ink ' +
  'placeholder:text-faint transition-colors focus:border-accent disabled:bg-sunken disabled:text-muted'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, 'mono', props.className)} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, 'resize-none', props.className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, props.className)} />
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <svg viewBox="0 0 48 48" className="size-10 text-line-strong" fill="none" aria-hidden>
        <rect x="8" y="6" width="32" height="36" rx="3" stroke="currentColor" strokeWidth="2" />
        <path
          d="M15 16h18M15 23h18M15 30h10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted">{hint}</p>
    </div>
  )
}

/**
 * La alcancía no funciona sin su base de datos. Cuando no responde se dice tal
 * cual, con lo que sí se puede hacer, en vez de un error crudo.
 */
export function OfflineState({
  offline,
  detail,
  onRetry,
  onLogout,
}: {
  /** true si /api/status confirmó que la base no responde. */
  offline: boolean
  detail: string
  onRetry: () => void
  onLogout?: () => void
}) {
  return (
    <main id="contenido" className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
      <Card className="overflow-hidden">
        <div className="flex items-start gap-4 border-b border-line bg-warn-wash px-5 py-5 sm:px-6">
          <svg viewBox="0 0 24 24" className="mt-1 size-6 shrink-0 text-warn" fill="none" aria-hidden>
            <ellipse cx="12" cy="5.5" rx="7" ry="2.5" stroke="currentColor" strokeWidth="2" />
            <path
              d="M5 5.5v12c0 1.4 3.1 2.5 7 2.5M19 5.5V11M5 11.5c0 1.4 3.1 2.5 7 2.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="M16 15l5 5M21 15l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="min-w-0">
            <h1 className="display text-2xl text-ink">
              {offline ? 'El panel está fuera de línea' : 'No pude cargar la alcancía'}
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted">
              {offline
                ? 'La base de datos del proyecto no responde ahora mismo, así que no se pueden leer alcancías, pedir pagos ni votar. No se movió ningún fondo.'
                : 'Algo falló al pedir los datos. Puedes reintentar; si se repite, el mensaje de abajo dice qué pasó.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <p className="hash break-words rounded-[4px] bg-sunken px-3 py-2 text-muted">{detail}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button onClick={onRetry}>Reintentar</Button>
            <LinkButton href="/">Volver a la portada</LinkButton>
            {onLogout ? (
              <Button variant="ghost" onClick={onLogout} className="h-11 px-4 sm:ml-auto">
                Cerrar sesión
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </main>
  )
}
