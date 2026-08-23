import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Diagnóstico del despliegue. No expone datos ni requiere sesión: solo dice si
 * las tres piezas que pueden romperse en serverless están vivas.
 *
 * La interesante es la billetera: el SDK de WDK arrastra `sodium-native`, un
 * addon nativo de C, y si la plataforma no trae binario para su arquitectura
 * todo lo demás compila y falla en tiempo de ejecución.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail: string }> = {}

  // 1 — Base de datos
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { ok: true, detail: 'conectada' }
  } catch (error) {
    checks.database = { ok: false, detail: String(error).slice(0, 200) }
  }

  // 2 — El SDK de la billetera, con su addon nativo
  try {
    const { getTreasuryAddress } = await import('@/lib/wdk-sdk')
    const address = await getTreasuryAddress(0)
    checks.wallet = { ok: true, detail: `deriva ${address.slice(0, 10)}…` }
  } catch (error) {
    checks.wallet = { ok: false, detail: String(error).slice(0, 300) }
  }

  // 3 — El nodo de la cadena
  try {
    const { getGasBalance } = await import('@/lib/wdk-sdk')
    const balance = await getGasBalance(0)
    checks.chain = { ok: true, detail: `${balance.toFixed(4)} ETH en el dispensador` }
  } catch (error) {
    checks.chain = { ok: false, detail: String(error).slice(0, 300) }
  }

  /** Host y puerto de una URL de Postgres, sin usuario ni contraseña. */
  function safeTarget(url: string | undefined): string {
    if (!url) return 'ausente'
    try {
      const parsed = new URL(url)
      return `${parsed.hostname}:${parsed.port || '5432'} (${url.length} chars)`
    } catch {
      return `ilegible (${url.length} chars, empieza "${url.slice(0, 12)}")`
    }
  }

  const configured = {
    auth: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
    masterSeedWords: process.env.MASTER_SEED?.trim().split(/\s+/).length ?? 0,
    token: process.env.TOKEN_ADDRESS?.slice(0, 10) ?? 'ausente',
    database: safeTarget(process.env.DATABASE_URL),
    rpc: process.env.EVM_RPC_URL ?? 'ausente',
  }

  const healthy = Object.values(checks).every((c) => c.ok)
  return Response.json(
    { healthy, checks, configured },
    { status: healthy ? 200 : 503 },
  )
}
