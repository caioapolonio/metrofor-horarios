'use client'

import { LocateFixed, LoaderCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { meters } from '@/lib/geo'

export type StationPin = {
  lineSlug: string
  lineName: string
  city: string
  color: string
  ink: string
  stationId: number
  name: string
  lat: number
  lng: number
}

type State =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'error'; message: string }
  | { kind: 'found'; results: (StationPin & { meters: number })[] }

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

/** Finds the closest station of each line around the person */
export function NearMe({ stations }: { stations: StationPin[] }) {
  const [state, setState] = useState<State>({ kind: 'idle' })

  function locate() {
    if (!('geolocation' in navigator)) {
      setState({ kind: 'error', message: 'Este navegador não informa a localização.' })
      return
    }
    setState({ kind: 'locating' })
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = { lat: coords.latitude, lng: coords.longitude }
        const byLine = new Map<string, StationPin & { meters: number }>()
        for (const s of stations) {
          const m = meters(here, s)
          const best = byLine.get(s.lineSlug)
          if (!best || m < best.meters) byLine.set(s.lineSlug, { ...s, meters: m })
        }
        const results = [...byLine.values()].sort((a, b) => a.meters - b.meters)
        const closest = results[0]
        // Keep lines that are a reasonable walk compared to the closest one
        const near = results.filter((r) => r.meters < Math.max(1500, closest.meters * 1.6)).slice(0, 3)
        setState({ kind: 'found', results: near.length ? near : [closest] })
      },
      (error) =>
        setState({
          kind: 'error',
          message:
            error.code === error.PERMISSION_DENIED
              ? 'Sem permissão de localização. Libere nas configurações do navegador e tente de novo.'
              : 'Não deu para achar sua localização agora. Tente de novo em instantes.',
        }),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={locate}
        disabled={state.kind === 'locating'}
        className="inline-flex min-h-12 items-center gap-2.5 rounded-full border-2 border-ink px-5 font-semibold transition-colors hover:bg-ink hover:text-bg disabled:opacity-60"
      >
        {state.kind === 'locating' ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
        ) : (
          <LocateFixed className="size-5" aria-hidden />
        )}
        {state.kind === 'locating' ? 'Procurando…' : 'Estação mais perto de mim'}
      </button>

      {state.kind === 'error' && <p className="mt-3 max-w-prose text-muted">{state.message}</p>}

      {state.kind === 'found' && (
        <ul className="mt-4 divide-y divide-rule border-y border-rule" aria-live="polite">
          {state.results.map((r) => (
            <li key={r.lineSlug}>
              <Link
                href={`/linha/${r.lineSlug}?estacao=${r.stationId}`}
                className="flex items-center gap-3 py-3"
              >
                <span
                  className="rounded px-2 py-0.5 font-display text-sm font-semibold whitespace-nowrap"
                  style={{ background: r.color, color: r.ink }}
                >
                  {r.city === 'Fortaleza' ? r.lineName : `${r.lineName} (${r.city})`}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                <span className="text-muted tabular-nums">{formatDistance(r.meters)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
