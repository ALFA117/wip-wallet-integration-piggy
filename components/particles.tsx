'use client'

import { useEffect, useRef } from 'react'

/**
 * Campo de puntos en tres dimensiones, dibujado sobre un canvas plano.
 *
 * La proyección en perspectiva son cuatro líneas de aritmética, así que no hace
 * falta una librería 3D: Three.js pesa unos 400 kB comprimidos y esto son unos
 * pocos cientos de bytes. En una portada, ese peso se paga en tiempo hasta la
 * primera pintura.
 *
 * Lo que se ve tiene que ver con el producto: puntos sueltos que solo se unen
 * cuando están cerca. Un grupo se sostiene por las conexiones, no por las
 * partes — y cuando dos se alejan, el vínculo se apaga solo.
 */

interface Point {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  teal: boolean
}

export function Particles({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let dpr = 1
    let points: Point[] = []
    let frame = 0
    let running = true

    /** Menos puntos en pantallas pequeñas: el móvil no tiene GPU de sobra. */
    function count(): number {
      const area = width * height
      if (area < 300_000) return 34
      if (area < 900_000) return 56
      return 78
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas!.width = Math.round(width * dpr)
      canvas!.height = Math.round(height * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)

      const target = count()
      if (points.length !== target) {
        points = Array.from({ length: target }, () => ({
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
          z: Math.random(),
          vx: (Math.random() - 0.5) * 0.0007,
          vy: (Math.random() - 0.5) * 0.0007,
          vz: (Math.random() - 0.5) * 0.0005,
          // Uno de cada tres en teal: el acento aparece, no domina.
          teal: Math.random() < 0.34,
        }))
      }
    }

    /** Colores de marca, leídos del tema para que el modo noche funcione solo. */
    function palette() {
      const styles = getComputedStyle(document.documentElement)
      return {
        navy: styles.getPropertyValue('--brand-navy').trim() || '#003b6d',
        teal: styles.getPropertyValue('--brand-teal').trim() || '#00808c',
        dark: document.documentElement.getAttribute('data-theme') === 'dark' ||
          (!document.documentElement.getAttribute('data-theme') &&
            window.matchMedia('(prefers-color-scheme: dark)').matches),
      }
    }

    let colors = palette()
    const themeWatcher = window.matchMedia('(prefers-color-scheme: dark)')
    const onTheme = () => {
      colors = palette()
    }
    themeWatcher.addEventListener('change', onTheme)

    function draw() {
      if (!running) return
      frame += 1

      ctx!.clearRect(0, 0, width, height)

      const cx = width / 2
      const cy = height / 2
      // Una vuelta lenta: la escena respira sin pedir atención.
      const angle = reduced ? 0 : frame * 0.0009
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const spread = Math.min(width, height) * 0.62

      const screen: { x: number; y: number; scale: number; teal: boolean }[] = []

      for (const point of points) {
        if (!reduced) {
          point.x += point.vx
          point.y += point.vy
          point.z += point.vz
          // Rebote suave en los bordes del cubo.
          if (point.x > 1 || point.x < -1) point.vx *= -1
          if (point.y > 1 || point.y < -1) point.vy *= -1
          if (point.z > 1 || point.z < 0.05) point.vz *= -1
        }

        // Giro sobre el eje vertical y proyección en perspectiva.
        const rx = point.x * cos - (point.z - 0.5) * sin
        const rz = point.x * sin + (point.z - 0.5) * cos + 0.5
        const depth = 1 / (1.6 - rz)

        screen.push({
          x: cx + rx * spread * depth,
          y: cy + point.y * spread * depth,
          scale: depth,
          teal: point.teal,
        })
      }

      // Las uniones van primero, para que los puntos queden por encima.
      const near = Math.min(width, height) * 0.17
      for (let i = 0; i < screen.length; i += 1) {
        for (let j = i + 1; j < screen.length; j += 1) {
          const dx = screen[i].x - screen[j].x
          const dy = screen[i].y - screen[j].y
          const distance = Math.hypot(dx, dy)
          if (distance > near) continue

          // Se desvanece con la distancia: el vínculo se apaga solo.
          const strength = (1 - distance / near) * 0.5
          ctx!.strokeStyle = colors.navy
          ctx!.globalAlpha = strength * (colors.dark ? 0.34 : 0.16)
          ctx!.lineWidth = 0.7
          ctx!.beginPath()
          ctx!.moveTo(screen[i].x, screen[i].y)
          ctx!.lineTo(screen[j].x, screen[j].y)
          ctx!.stroke()
        }
      }

      for (const dot of screen) {
        const radius = Math.max(0.7, dot.scale * 2.1)
        ctx!.fillStyle = dot.teal ? colors.teal : colors.navy
        // Lo lejano se atenúa: es lo que da sensación de profundidad.
        ctx!.globalAlpha = Math.min(dot.scale * 0.62, 0.85) * (colors.dark ? 0.9 : 0.55)
        ctx!.beginPath()
        ctx!.arc(dot.x, dot.y, radius, 0, Math.PI * 2)
        ctx!.fill()
      }

      ctx!.globalAlpha = 1

      // Con movimiento reducido basta un fotograma: la imagen queda quieta.
      if (reduced) return
      raf = requestAnimationFrame(draw)
    }

    let raf = 0
    resize()
    draw()

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    // Pausa fuera de pantalla: no se gasta batería animando lo que nadie ve.
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(raf)
      } else if (!running) {
        running = true
        draw()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      running = false
      cancelAnimationFrame(raf)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      themeWatcher.removeEventListener('change', onTheme)
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden />
}
