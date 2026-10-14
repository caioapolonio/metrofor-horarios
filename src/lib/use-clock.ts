'use client'

import { useEffect, useState } from 'react'

import { type ClockNow, clockAt } from './time'

/**
 * Current time in Fortaleza, refreshed every few seconds. It is null during
 * the server render so the static HTML never shows a stale time.
 */
export function useClock(intervalMs = 10_000) {
  const [now, setNow] = useState<ClockNow | null>(null)
  useEffect(() => {
    const tick = () => setNow(clockAt(new Date()))
    tick()
    const id = setInterval(tick, intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [intervalMs])
  return now
}
