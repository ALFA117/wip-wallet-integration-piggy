import type { Transition, Variants } from 'motion/react'

/**
 * El vocabulario de movimiento del producto.
 *
 * Todo sale de aquí para que la app tenga un solo ritmo. Un muelle distinto por
 * componente se nota aunque nadie sepa decir por qué: la interfaz deja de
 * sentirse como una sola cosa.
 *
 * Muelles para lo que responde a una acción —se interrumpen y se invierten a
 * media animación, cosa que una duración fija no puede hacer sin verse rota—.
 * Duraciones para entradas pasivas, donde el tiempo fijo se lee como ritmo
 * deliberado en vez de física.
 */

export const spring = {
  /** Botones y controles: responde y para. */
  snappy: { type: 'spring', stiffness: 400, damping: 22 } satisfies Transition,
  /** Tarjetas y paneles que entran. */
  panel: { type: 'spring', stiffness: 280, damping: 26 } satisfies Transition,
  /** Diálogos y capas grandes. */
  layer: { type: 'spring', stiffness: 320, damping: 28 } satisfies Transition,
  /** El rebote que el producto usa como firma: se pasa y vuelve. */
  bouncy: { type: 'spring', stiffness: 500, damping: 17, mass: 0.8 } satisfies Transition,
} as const

export const tween = {
  fast: { duration: 0.14, ease: [0.16, 1, 0.3, 1] } satisfies Transition,
  base: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } satisfies Transition,
  /** Las salidas van a ~65% de la entrada: irse rápido se lee como agilidad. */
  exit: { duration: 0.14, ease: [0.4, 0, 1, 1] } satisfies Transition,
} as const

// ---------------------------------------------------------------------------

/** Contenedor que reparte la entrada de sus hijos. */
export const staggerContainer = (stagger = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
})

/** Hijo de una lista escalonada: sube y aparece. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring.panel },
}

/** Burbuja de conversación. Entra desde su lado, así el gesto dice de quién es. */
export const bubble = (side: 'left' | 'right'): Variants => ({
  hidden: { opacity: 0, x: side === 'left' ? -16 : 16, y: 8, scale: 0.94 },
  show: { opacity: 1, x: 0, y: 0, scale: 1, transition: spring.bouncy },
  exit: { opacity: 0, scale: 0.96, transition: tween.exit },
})

/** Un chequeo aterrizando en la lista. */
export const checkItem: Variants = {
  hidden: { opacity: 0, x: -10, scale: 0.86 },
  show: { opacity: 1, x: 0, scale: 1, transition: spring.bouncy },
}

/** El veredicto: entra girando y creciendo, porque es el momento del mensaje. */
export const verdict: Variants = {
  hidden: { opacity: 0, scale: 0.8, rotate: -3 },
  show: { opacity: 1, scale: 1, rotate: 0, transition: spring.bouncy },
  exit: { opacity: 0, scale: 0.94, transition: tween.exit },
}

/** Capa modal: el fondo se funde, el panel crece desde donde estaba. */
export const scrim: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: tween.fast },
  exit: { opacity: 0, transition: tween.exit },
}

export const panel: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 14 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.layer },
  exit: { opacity: 0, scale: 0.97, y: 8, transition: tween.exit },
}

/** Fila que desaparece de una lista al resolverse. */
export const rowExit: Variants = {
  hidden: { opacity: 0, height: 0 },
  show: { opacity: 1, height: 'auto', transition: spring.panel },
  exit: { opacity: 0, x: 24, height: 0, transition: tween.exit },
}

/** Retroalimentación al pulsar, para elementos táctiles. */
export const press = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: spring.snappy,
} as const
