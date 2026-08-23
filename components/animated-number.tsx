'use client'

import { useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'motion/react'

/**
 * Un número que cuenta hasta su valor.
 *
 * Sirve para algo concreto: cuando el balance baja tras un pago, verlo bajar
 * conecta la cifra con lo que acaba de pasar. Un salto seco deja al ojo sin
 * saber si cambió.
 *
 * Se anima el texto del nodo directamente, sin estado de React, para no
 * repintar el árbol sesenta veces por segundo.
 */
export function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number
  format: (value: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const from = previous.current
    previous.current = value

    if (reduce || from === value) {
      node.textContent = format(value)
      return
    }

    const controls = animate(from, value, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest)
      },
    })
    return () => controls.stop()
  }, [value, format, reduce])

  // El valor inicial se pinta en el servidor para que no haya un hueco vacío
  // antes de que el efecto corra.
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  )
}
