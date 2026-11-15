export const dynamic = 'force-dynamic'

/**
 * Estado público y barato para la interfaz: ¿responde la base de datos?
 *
 * `/api/health` es el diagnóstico completo (deriva la billetera, consulta el
 * nodo) y responde 503 cuando algo falla. Esto es lo que la portada y el panel
 * necesitan para decir con honestidad si el panel está en línea, siempre con
 * 200 para no ensuciar la consola del visitante, y con un tope de 5 s porque un
 * host que ya no resuelve puede tardar mucho en fallar.
 */
export async function GET() {
  let database = false
  try {
    const { prisma } = await import('@/lib/prisma')
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ])
    database = true
  } catch {
    database = false
  }

  return Response.json(
    { database, checkedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
