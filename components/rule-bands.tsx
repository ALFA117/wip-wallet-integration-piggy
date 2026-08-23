'use client'

import { motion, useReducedMotion } from 'motion/react'

import { spring } from '@/lib/motion'
import { money } from '@/lib/utils'
import type { RuleDTO } from '@/lib/types'

/**
 * El reglamento visto como lo que es: una recta de dinero partida en tramos.
 *
 * Seis campos numéricos obligan a reconstruir mentalmente en qué se convierte
 * cada monto. Dibujarlo lo hace evidente —dónde acaba lo automático, dónde
 * empieza a hacer falta un administrador, dónde ya no pasa nada— y de paso
 * enseña un error que los números sueltos esconden: cuando un tramo desaparece
 * porque dos topes se cruzan.
 *
 * La escala es proporcional a la raíz cuadrada, no lineal: con un tope
 * automático de $100 y uno duro de $2 000, en escala lineal el primer tramo
 * sería una franja de dos píxeles.
 */
export function RuleBands({ rules }: { rules: RuleDTO }) {
  const reduce = useReducedMotion()

  const auto = Number(rules.autoApproveUnder) || 0
  const admin = Number(rules.adminOnlyOver) || 0
  const max = Number(rules.maxSingleTx) || 0

  // La raíz cuadrada da aire a los tramos bajos, que son los más frecuentes.
  const scale = (value: number) => (max > 0 ? Math.sqrt(Math.max(value, 0) / max) * 100 : 0)

  const bands = [
    {
      key: 'auto',
      label: 'Se paga solo',
      from: 0,
      to: auto,
      width: scale(auto),
      color: 'var(--ok)',
      wash: 'var(--ok-wash)',
      note: 'sin votos',
    },
    {
      key: 'multi',
      label: `${rules.requireApprovals} firmas`,
      from: auto,
      to: admin,
      width: scale(admin) - scale(auto),
      color: 'var(--teal)',
      wash: 'var(--teal-wash)',
      note: 'de otras personas',
    },
    {
      key: 'admin',
      label: 'Administrador',
      from: admin,
      to: max,
      width: scale(max) - scale(admin),
      color: 'var(--warn)',
      wash: 'var(--warn-wash)',
      note: 'obligatorio',
    },
  ].filter((band) => band.width > 0.5)

  /** Un tramo desaparecido significa que dos topes se cruzaron. */
  const missing = auto >= admin || admin > max

  return (
    <div className="flex flex-col gap-3">
      <div className="flex overflow-hidden rounded-[var(--radius)] border border-line">
        {bands.map((band) => (
          <motion.div
            key={band.key}
            initial={reduce ? undefined : { flexGrow: 0, opacity: 0 }}
            animate={{ flexGrow: band.width, opacity: 1 }}
            transition={spring.panel}
            className="min-w-0 border-r border-line px-2.5 py-2.5 last:border-r-0"
            style={{ background: band.wash, flexBasis: 0 }}
          >
            <p
              className="truncate text-[0.6875rem] font-bold uppercase tracking-wide"
              style={{ color: band.color }}
            >
              {band.label}
            </p>
            <p className="tnum mt-0.5 truncate text-xs text-ink">
              {money(band.from)}
              <span className="text-faint"> – </span>
              {money(band.to)}
            </p>
            <p className="truncate text-[0.6875rem] text-muted">{band.note}</p>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="tnum text-faint">$0</span>
        <span className="text-muted">
          Por encima de{' '}
          <span className="tnum font-semibold text-bad">{money(max)}</span> no pasa
          nada, con votos o sin ellos
        </span>
      </div>

      {missing ? (
        <p className="rounded-[var(--radius)] border border-warn/30 bg-warn-wash px-3 py-2 text-[0.8125rem] text-warn">
          Los topes se cruzan y hay un tramo que nunca se usa. Revisa que el
          automático sea menor que el de administrador, y este menor que el tope
          por transacción.
        </p>
      ) : null}
    </div>
  )
}
