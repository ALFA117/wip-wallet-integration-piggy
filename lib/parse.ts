/**
 * Traduce texto libre a una intención estructurada.
 *
 * El parser NUNCA decide si un pago se ejecuta. Solo traduce. La decisión la
 * toma lib/rules.ts, que es código determinista y testeado. Esa separación es
 * lo que distingue este proyecto de uno que le entrega las llaves a un modelo
 * de lenguaje.
 *
 * Implementación: regex y heurísticas. No puede alucinar un monto. Si el texto
 * es ambiguo devuelve un error pidiendo reformular — un agente que pregunta
 * vale más que uno que inventa una cifra.
 */

export interface ParsedIntent {
  amount: number
  toEmail: string
  reason: string
}

export interface Member {
  email: string
  name: string
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

/**
 * Montos: `$1,234.56`, `1234.56 USDT`, `50 dólares`, `$50`.
 * Se exige `$` o una unidad explícita para no confundir un número suelto
 * (una fecha, un número de factura) con una cantidad de dinero.
 */
const AMOUNT_RE =
  /(?:\$\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?))|(?:(\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:usdt|usd₮|usd|dólares|dolares|pesos))/gi

function normalizeAmount(raw: string): number {
  return Number(raw.replace(/[,\s]/g, ''))
}

/** Quita acentos y baja a minúsculas, para comparar nombres. */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

function extractAmount(text: string): number {
  const matches = [...text.matchAll(AMOUNT_RE)]
  if (matches.length === 0) {
    throw new ParseError(
      'No encontré un monto. Escríbelo con signo de dólar, por ejemplo: "paga $50 a sofia@wip.demo por el café".',
    )
  }
  const amounts = matches.map((m) => normalizeAmount(m[1] ?? m[2]))
  const unique = [...new Set(amounts)]
  if (unique.length > 1) {
    throw new ParseError(
      `Encontré más de un monto (${unique.map((a) => `$${a}`).join(', ')}). Deja solo el que quieres pagar.`,
    )
  }
  return unique[0]
}

function extractBeneficiary(text: string, members: Member[]): string {
  const emails = [...new Set(text.match(EMAIL_RE) ?? [])]

  if (emails.length > 1) {
    throw new ParseError(
      `Encontré más de un correo (${emails.join(', ')}). Deja solo el del beneficiario.`,
    )
  }
  if (emails.length === 1) return emails[0].toLowerCase()

  // Sin correo explícito: resolvemos por nombre contra los miembros conocidos.
  const folded = fold(text)
  const hits = members.filter((member) => {
    const first = fold(member.name).split(/\s+/)[0]
    return first.length >= 3 && new RegExp(`\\b${first}\\b`).test(folded)
  })

  if (hits.length === 1) return hits[0].email.toLowerCase()
  if (hits.length > 1) {
    throw new ParseError(
      `El nombre coincide con varios miembros (${hits.map((h) => h.name).join(', ')}). Usa el correo completo.`,
    )
  }
  throw new ParseError(
    'No encontré a quién pagarle. Escribe el correo del beneficiario, por ejemplo: "paga $50 a sofia@wip.demo por el café".',
  )
}

function extractReason(text: string, amountMatchers: RegExp, email: string, members: Member[]): string {
  let rest = text.replace(amountMatchers, ' ').replace(EMAIL_RE, ' ')

  // Quita el nombre del beneficiario si se usó en vez del correo.
  const member = members.find((m) => m.email.toLowerCase() === email)
  if (member) {
    for (const part of member.name.split(/\s+/)) {
      if (part.length >= 3) {
        rest = rest.replace(new RegExp(part, 'gi'), ' ')
      }
    }
  }

  const reason = rest
    // Verbos y conectores que sobran una vez extraídos monto y beneficiario.
    .replace(/\b(paga(?:le)?|pagar|transfiere|transferir|manda(?:le)?|mandar|env[íi]a(?:le)?|enviar)\b/gi, ' ')
    .replace(/\b(a|al|para|por|de|el|la|los|las|un|una|concepto|motivo)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s.,'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (reason.length < 3) {
    throw new ParseError(
      'No encontré el motivo del pago. Agrégalo al final, por ejemplo: "paga $50 a sofia@wip.demo por el café de la oficina".',
    )
  }
  return reason.charAt(0).toUpperCase() + reason.slice(1)
}

/**
 * Convierte `"paga $50 a sofia@wip.demo por el café"` en
 * `{ amount: 50, toEmail: "sofia@wip.demo", reason: "café oficina" }`.
 *
 * @throws {ParseError} cuando el texto es ambiguo. No adivina nunca.
 */
export function parseIntent(text: string, members: Member[] = []): ParsedIntent {
  const trimmed = (text ?? '').trim()
  if (trimmed.length === 0) {
    throw new ParseError('Escribe la solicitud, por ejemplo: "paga $50 a sofia@wip.demo por el café".')
  }

  const amount = extractAmount(trimmed)
  const toEmail = extractBeneficiary(trimmed, members)
  const reason = extractReason(trimmed, new RegExp(AMOUNT_RE.source, 'gi'), toEmail, members)

  return { amount, toEmail, reason }
}
