/**
 * El logotipo de WIP.
 *
 * Una W y una P que se cruzan: donde se solapan aparece un tercer tono, el azul
 * de intersección. La idea de marca es literal —dos partes que se superponen y
 * producen algo que ninguna tiene por separado— y es la misma que sostiene el
 * producto: nadie manda solo.
 *
 * El solape se consigue con `mix-blend-multiply` sobre la P, no pintando a mano
 * la zona común, así que el tercer color sale solo y sigue siendo correcto si se
 * cambian los otros dos.
 */

export function Logo({
  className,
  title = 'WIP',
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 200 96"
      className={className}
      role="img"
      aria-label={title}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* W — el trazo grueso, en azul marino */}
      <path
        d="M4 8 L30 8 L48 62 L66 8 L86 8 L104 62 L122 8 L148 8 L116 88 L94 88 L76 34 L58 88 L36 88 Z"
        fill="var(--brand-navy)"
      />

      {/* P — cruza a la W por la derecha. El multiply crea el tono de solape. */}
      <g style={{ mixBlendMode: 'multiply' }}>
        <path
          d="M112 8 L154 8 C176 8 192 22 192 40 C192 58 176 72 154 72 L136 72 L136 88 L112 88 Z M136 28 L136 52 L152 52 C160 52 166 47 166 40 C166 33 160 28 152 28 Z"
          fill="var(--brand-teal)"
        />
      </g>
    </svg>
  )
}

/** Marca completa: logotipo más nombre, para cabeceras. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <Logo className="h-6 w-auto" />
      <span className="sr-only">WIP — Wallet Integration Piggy</span>
    </span>
  )
}

/**
 * Versión compacta para espacios cuadrados: favicon, avatar, pestañas.
 * A tamaños pequeños las letras se empastan, así que solo va la W.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="WIP"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="14" fill="var(--brand-navy)" />
      <path
        d="M10 20 L20 20 L27 43 L34 20 L42 20 L49 43 L56 20 L56 20 L44 50 L36 50 L32 36 L28 50 L20 50 Z"
        fill="#fff"
        opacity="0.96"
      />
      <path d="M40 20 L54 20 L44 50 L36 50 Z" fill="var(--brand-teal)" opacity="0.85" />
    </svg>
  )
}
