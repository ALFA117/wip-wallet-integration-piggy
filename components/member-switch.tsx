'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronDown, Users } from 'lucide-react'

import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { MemberDTO } from '@/lib/types'

const HINT_SEEN = 'wip.memberSwitchSeen'

/**
 * Cambia quién eres dentro de la alcancía.
 *
 * Es la mecánica menos evidente del producto: un `<select>` con cuatro nombres
 * no explica por qué puedes ser otra persona. Y sin entenderlo, el flujo de
 * varias firmas es imposible de probar solo —hay que ser dos personas
 * distintas para aprobar un pago— así que se pierde justo lo que hay que ver.
 *
 * Por eso se explica una vez, la primera, y no vuelve a aparecer.
 */
export function MemberSwitch({
  members,
  currentId,
  onChange,
  className,
}: {
  members: MemberDTO[]
  currentId: string
  onChange: (id: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  const current = members.find((member) => member.id === currentId)

  useEffect(() => {
    if (members.length === 0) return
    if (window.localStorage.getItem(HINT_SEEN)) return
    const timer = setTimeout(() => setHint(true), 1400)
    return () => clearTimeout(timer)
  }, [members.length])

  function dismissHint() {
    setHint(false)
    window.localStorage.setItem(HINT_SEEN, '1')
  }

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <motion.button
        onClick={() => {
          setOpen((value) => !value)
          if (hint) dismissHint()
        }}
        whileTap={reduce ? undefined : { scale: 0.97 }}
        transition={spring.snappy}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex h-9 w-full min-w-0 items-center gap-1.5 rounded-[var(--radius)] border border-line',
          'bg-surface px-2.5 text-[0.8125rem] text-ink transition-colors hover:bg-sunken sm:px-3',
        )}
      >
        <Users size={14} className="shrink-0 text-faint" />
        <span className="truncate font-medium">
          {current?.name.split(' ')[0] ?? '—'}
        </span>
        {current?.role === 'ADMIN' ? (
          <span className="hidden shrink-0 text-xs text-faint sm:inline">admin</span>
        ) : null}
        <ChevronDown
          size={14}
          className={cn('ml-auto shrink-0 text-faint transition-transform', open && 'rotate-180')}
        />
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            role="listbox"
            initial={reduce ? undefined : { opacity: 0, y: -6, scale: 0.97 }}
            animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={spring.layer}
            className="absolute right-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow-pop)]"
          >
            <li className="border-b border-line px-3 py-2">
              <p className="text-xs leading-relaxed text-muted">
                Actúa como cualquiera del grupo. Es lo que te deja aprobar un pago
                que pidió otro, sin necesitar a nadie más.
              </p>
            </li>
            {members.map((member) => {
              const active = member.id === currentId
              return (
                <li key={member.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(member.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors',
                      active ? 'bg-accent-wash' : 'hover:bg-sunken',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full text-[0.6875rem] font-bold',
                        active ? 'bg-accent text-accent-ink' : 'bg-sunken text-muted',
                      )}
                    >
                      {member.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-[0.8125rem]',
                          active ? 'font-semibold text-ink' : 'text-ink',
                        )}
                      >
                        {member.name}
                      </span>
                      <span className="block truncate text-xs text-faint">
                        {member.role === 'ADMIN' ? 'Administrador' : 'Integrante'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      {/* La pista, una sola vez. Explica la mecánica que no se deduce sola. */}
      <AnimatePresence>
        {hint && !open ? (
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: -6, scale: 0.95 }}
            animate={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
            transition={spring.bouncy}
            className="absolute right-0 top-full z-40 mt-2 w-64 rounded-[var(--radius)] border border-accent/30 bg-surface p-3 shadow-[var(--shadow-pop)]"
          >
            <div
              className="absolute -top-1.5 right-6 size-3 rotate-45 border-l border-t border-accent/30 bg-surface"
              aria-hidden
            />
            <p className="text-[0.8125rem] font-semibold text-ink">
              Aquí cambias de persona
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Un pago de más de $100 necesita la firma de otros dos, y quien lo
              pide no puede aprobarlo. Cambiando de integrante pruebas ese flujo
              tú solo.
            </p>
            <button
              onClick={dismissHint}
              className="mt-2 text-xs font-medium text-accent underline underline-offset-2"
            >
              Entendido
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
