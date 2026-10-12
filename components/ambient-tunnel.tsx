'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Fondo de toda la app (receta 4 de /diseno: túnel warp de anillos), dibujado
 * en un canvas plano, sin librería 3D, por la misma razón que el campo de
 * partículas anterior: unas líneas de aritmética de perspectiva bastan.
 *
 * Lo que se ve es el producto: cada anillo es una regla del grupo (navy y teal
 * alternados) y las monedas viajan hacia la cámara cruzándolos. Casi todas
 * pasan y terminan en verde (aprobado); de vez en cuando una choca con un
 * anillo, se pone roja y rebota (rechazado, con la regla que rompió). El
 * guardián no se soborna: nadie atraviesa un anillo que no cumple.
 *
 * Completo en la portada; tranquilo en la app y el reglamento. El centro del
 * túnel sigue al puntero y el scroll lo desplaza. Pausa con la pestaña oculta,
 * menos anillos en celular, DPR ≤ 2 y un solo cuadro con movimiento reducido.
 */
export function AmbientTunnel() {
  const ref = useRef<HTMLCanvasElement>(null)
  const full = usePathname() === '/'

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ctx = el.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const mobile = window.matchMedia('(max-width: 767px)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const N = mobile ? 12 : 20
    const GAP = 90
    const rings = Array.from({ length: N }, (_, i) => ({ z: (i + 1) * GAP, i }))
    type Coin = { a: number; r: number; z: number; v: number; reject: number | null; bounce: number }
    const coins: Coin[] = []
    let w = 0, h = 0, raf = 0, last = 0, spawn = 0
    let px = 0, py = 0, tx = 0, ty = 0, scroll = 0
    const col = { navy: '', teal: '', ok: '', bad: '' }
    const readColors = () => {
      const css = getComputedStyle(document.documentElement)
      col.navy = css.getPropertyValue('--brand-overlay').trim() || '#005c82'
      col.teal = css.getPropertyValue('--teal').trim() || '#00707a'
      col.ok = css.getPropertyValue('--ok').trim() || '#1b7f4b'
      col.bad = css.getPropertyValue('--bad').trim() || '#b4271f'
    }
    readColors()
    const obs = new MutationObserver(readColors)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', readColors)

    function draw(dt: number) {
      ctx!.clearRect(0, 0, w, h)
      const k0 = full ? 1 : 0.45
      const speed = full ? 1.2 : 0.6
      const cx = w * (mobile ? 0.5 : 0.72) + px * 70
      const cy = h * (mobile ? 0.62 : 0.5) + py * 50 - Math.min(scroll * 0.12, h * 0.2)
      const base = Math.min(w, h) * 0.5

      for (const r of [...rings].sort((a, b) => b.z - a.z)) {
        if (dt) { r.z -= speed * dt * 60; if (r.z < 1) r.z += N * GAP }
        const k = 420 / r.z
        ctx!.strokeStyle = r.i % 2 ? col.teal : col.navy
        ctx!.lineWidth = Math.min(3, 0.5 + k * 0.7)
        ctx!.globalAlpha = Math.min(1, k * 0.6) * 0.5 * k0
        ctx!.beginPath()
        ctx!.arc(cx, cy, base * k * 0.55, 0, Math.PI * 2)
        ctx!.stroke()
      }

      if (dt && !reduce) {
        spawn += dt
        if (spawn > (full ? 0.35 : 0.9) && coins.length < (mobile ? 10 : 20)) {
          spawn = 0
          // ~1 de cada 6 rompe una regla y rebota en un anillo intermedio.
          const reject = Math.random() < 0.17 ? N * GAP * (0.3 + Math.random() * 0.4) : null
          coins.push({ a: Math.random() * Math.PI * 2, r: 0.1 + Math.random() * 0.25, z: N * GAP, v: 1.5 + Math.random(), reject, bounce: 0 })
        }
      }
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i]!
        if (dt) {
          if (c.reject !== null && c.z <= c.reject && c.bounce === 0) c.bounce = 0.001
          if (c.bounce > 0) { c.bounce += dt; c.z += speed * 2.5 * dt * 60 } else c.z -= speed * c.v * dt * 60
          if (c.z < 30 || c.bounce > 1.2) { coins.splice(i, 1); continue }
        }
        const k = 420 / c.z
        const rejected = c.bounce > 0
        const near = 1 - c.z / (N * GAP)
        ctx!.globalAlpha = Math.min(1, k * 0.9) * (rejected ? 1 - c.bounce / 1.2 : 1) * 0.9 * k0
        ctx!.fillStyle = rejected ? col.bad : near > 0.7 ? col.ok : col.teal
        const x = cx + Math.cos(c.a) * base * k * c.r
        const y = cy + Math.sin(c.a) * base * k * c.r
        ctx!.beginPath()
        ctx!.arc(x, y, Math.min(9, 1.5 + k * 2.4), 0, Math.PI * 2)
        ctx!.fill()
      }
      ctx!.globalAlpha = 1
    }

    const resize = () => {
      w = el.clientWidth; h = el.clientHeight
      el.width = w * dpr; el.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (reduce) draw(0)
    }
    resize()
    window.addEventListener('resize', resize)
    const onMove = (e: PointerEvent) => { tx = (e.clientX / innerWidth - 0.5) * 2; ty = (e.clientY / innerHeight - 0.5) * 2 }
    const onScroll = () => { scroll = window.scrollY }
    if (!reduce && window.matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    const loop = (t: number) => {
      const dt = last ? Math.min((t - last) / 1000, 0.05) : 0.016
      last = t
      px += (tx - px) * 0.05; py += (ty - py) * 0.05
      draw(dt)
      raf = requestAnimationFrame(loop)
    }
    const onVis = () => { cancelAnimationFrame(raf); last = 0; if (!document.hidden && !reduce) raf = requestAnimationFrame(loop) }
    if (!reduce) { raf = requestAnimationFrame(loop); document.addEventListener('visibilitychange', onVis) }

    return () => {
      cancelAnimationFrame(raf)
      obs.disconnect()
      mq.removeEventListener('change', readColors)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [full])

  return (
    <div aria-hidden className="wip-amb">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      <div className="wip-amb-veil" />
    </div>
  )
}
