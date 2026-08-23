'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { Check, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { CheckStep } from '@/lib/types'

/** Nombres legibles. El jurado no debería tener que leer snake_case. */
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

/**
 * Revela los chequeos uno a uno. Es deliberado: en el video se ve al agente
 * razonar, y el rechazo se entiende sin narración.
 */
export function DecisionLog({
  steps,
  animate = true,
  stepDelay = 150,
  onDone,
}: {
  steps: CheckStep[]
  animate?: boolean
  stepDelay?: number
  onDone?: () => void
}) {
  const reduced = useReducedMotion()
  // Cuando no hay que animar, la lista está completa desde el primer render:
  // ponerlo con un efecto provocaría un segundo render para nada.
  const still = !animate || reduced
  const [revealed, setRevealed] = useState(0)
  const visible = still ? steps.length : revealed

  useEffect(() => {
    if (still) {
      onDone?.()
      return
    }

    const timers = steps.map((_, index) =>
      setTimeout(() => {
        setRevealed(index + 1)
        if (index === steps.length - 1) onDone?.()
      }, stepDelay * (index + 1)),
    )
    return () => timers.forEach(clearTimeout)
  }, [steps, still, stepDelay, onDone])

  return (
    <ol className="flex flex-col gap-px overflow-hidden rounded-[var(--radius)] border border-line">
      {steps.slice(0, visible).map((step, index) => (
        <li
          key={`${step.check}-${index}`}
          className={cn(
            'step-in flex items-start gap-3 bg-surface px-3 py-2.5',
            !step.passed && 'bg-bad-wash',
          )}
        >
          <span
            className={cn(
              'mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full',
              step.passed ? 'bg-ok-wash text-ok' : 'bg-bad text-white',
            )}
            aria-hidden
          >
            {step.passed ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className={cn('text-[0.8125rem] font-medium', step.passed ? 'text-ink' : 'text-bad')}>
              {CHECK_LABEL[step.check] ?? step.check}
            </p>
            <p className="tnum text-xs text-muted">{step.detail}</p>
          </div>
          <span className="sr-only">{step.passed ? 'aprobado' : 'rechazado'}</span>
        </li>
      ))}

      {/* Marcadores de los chequeos que faltan, para que la lista no salte. */}
      {steps.slice(visible).map((step, index) => (
        <li key={`ghost-${index}`} className="flex items-center gap-3 bg-surface px-3 py-2.5">
          <span className="size-[18px] shrink-0 rounded-full bg-sunken" />
          <span className="skeleton h-3 w-40" />
        </li>
      ))}
    </ol>
  )
}
