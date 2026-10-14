'use client'

import clsx from 'clsx'
import { ArrowUpRight, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { type CSSProperties, useMemo, useState } from 'react'

import type { City } from '@/lib/metro'
import type { ServiceCalendar } from '@/lib/schedule'

import { hasGoogleMaps, MapScene } from './map/map-scene'
import type { SceneLine, Selection } from './map/types'
import { ServiceStatus } from './service-status'

type NetworkLine = SceneLine & { city: City; calendar: ServiceCalendar }

export function NetworkMap({ cities, lines }: { cities: City[]; lines: NetworkLine[] }) {
  const [city, setCity] = useState<City>('Fortaleza')
  const [selected, setSelected] = useState<Selection>(null)
  const visible = useMemo(() => lines.filter((l) => l.city === city), [lines, city])

  const line = selected && lines.find((l) => l.slug === selected.lineSlug)
  const station = line?.stations.find((s) => s.id === selected?.stationId)
  // other lines that stop at (almost) the same place
  const alsoHere = station
    ? visible.filter(
        (l) =>
          l.slug !== line?.slug &&
          l.stations.some(
            (s) => Math.abs(s.lat - station.lat) < 0.006 && Math.abs(s.lng - station.lng) < 0.006,
          ),
      )
    : []

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto w-full max-w-xl px-4 pt-[max(env(safe-area-inset-top),0.5rem)]">
        <nav className="flex items-center justify-between">
          <Link
            href="/"
            className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-full pr-3 pl-1 font-semibold"
          >
            <ChevronLeft className="size-5" aria-hidden />
            Linhas
          </Link>
        </nav>
        <h1 className="mt-4 font-display text-5xl leading-none font-bold tracking-tight">Mapa da rede</h1>
        <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Cidade">
          {cities.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={city === c}
              onClick={() => {
                setCity(c)
                setSelected(null)
              }}
              className={clsx(
                'min-h-10 rounded-full border px-4 text-sm font-semibold',
                city === c ? 'border-ink bg-ink text-bg' : 'border-rule bg-surface',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pb-3 text-sm">
          {visible.map((l) => (
            <li key={l.slug} className="flex items-center gap-1.5">
              <span
                className="h-1.5 w-5 rounded-full"
                style={{
                  background: l.dashed
                    ? `repeating-linear-gradient(90deg, ${l.color} 0 5px, transparent 5px 8px)`
                    : l.color,
                }}
              />
              {l.name}
            </li>
          ))}
        </ul>
      </header>

      {hasGoogleMaps ? (
        <div className="relative min-h-[55dvh] flex-1 border-y border-rule bg-surface">
          <div className="absolute inset-0">
            <MapScene lines={visible} selected={selected} onSelect={setSelected} />
          </div>
        </div>
      ) : (
        <div className="border-y border-rule bg-surface">
          <MapScene lines={visible} selected={selected} onSelect={setSelected} />
        </div>
      )}

      <div className="mx-auto w-full max-w-xl px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]">
        {line && station ? (
          <div>
            <p className="font-display text-3xl leading-none font-bold">{station.name}</p>
            <ul className="mt-3 grid gap-2">
              {[line, ...alsoHere].map((l) => (
                <li key={l.slug}>
                  <Link
                    href={`/linha/${l.slug}?estacao=${
                      l.slug === line.slug
                        ? station.id
                        : l.stations.reduce((best, s) =>
                            Math.hypot(s.lat - station.lat, s.lng - station.lng) <
                            Math.hypot(best.lat - station.lat, best.lng - station.lng)
                              ? s
                              : best,
                          ).id
                    }`}
                    style={{ '--line': l.color } as CSSProperties}
                    className="flex min-h-14 items-center gap-3 rounded-xl border border-rule bg-surface px-3"
                  >
                    <span className="h-8 w-2 rounded-full bg-line" />
                    <span className="flex-1">
                      <span className="block font-semibold">{l.name}</span>
                      <ServiceStatus calendar={l.calendar} className="text-sm text-muted" />
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold">
                      Horários
                      <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-muted">Toque numa estação para ver as linhas que passam por ela.</p>
        )}
      </div>
    </div>
  )
}
