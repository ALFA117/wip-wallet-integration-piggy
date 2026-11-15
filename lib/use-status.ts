'use client'

import { useEffect, useState } from 'react'

export type PanelStatus = 'checking' | 'online' | 'offline'

/** Pregunta una vez a `/api/status` si el panel puede funcionar. */
export function usePanelStatus(enabled = true): PanelStatus {
  const [status, setStatus] = useState<PanelStatus>('checking')

  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetch('/api/status', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { database?: boolean }) => {
        if (alive) setStatus(data.database ? 'online' : 'offline')
      })
      .catch(() => {
        if (alive) setStatus('offline')
      })
    return () => {
      alive = false
    }
  }, [enabled])

  return status
}
