'use client'

import clsx from 'clsx'
import { Footprints, List } from 'lucide-react'
import { useMemo } from 'react'

import { directionsUrl, positionOnLine } from '@/lib/geo'
import { whenLabel } from '@/lib/labels'
import type { Line } from '@/lib/metro'
import { estimatedTrains, isTerminal, nextDepartures, towards, trainIndex } from '@/lib/schedule'
import { type ClockNow, formatTime } from '@/lib/time'

import { hasGoogleMaps, MapScene } from './map/map-scene'
import type { SceneLine } from './map/types'
import { DirectionGlyph } from './station-diagram'

type Props = {
  line: Line
  now: ClockNow | null
  selected: number | null
  onSelect: (id: number | null) => void
  onShowList: (id: number) => void
}

export function LineMap({ line, now, selected, onSelect, onShowList }: Props) {
  const trains = now ? estimatedTrains(line, now) : []
  const trainKey = trains.map((t) => `${t.key}:${trainIndex(t).toFixed(3)}`).join()

  const scene = useMemo<SceneLine[]>(
    () => [
      {
        slug: line.slug,
        name: line.name,
        color: line.color,
        ink: line.ink,
        path: line.path,
        stations: line.stations,
        trains: trains.map((t) => ({ key: t.key, dir: t.dir, ...positionOnLine(line, trainIndex(t)) })),
      },
    ],
    // trains are recomputed every tick; only rebuild the scene when they move
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [line, trainKey],
  )

  const station = line.stations.find((s) => s.id === selected)

  return (
    <div className="-mx-4">
      <div
        className={clsx(
          'relative overflow-hidden border-y border-rule bg-surface',
          hasGoogleMaps && 'h-[min(68dvh,36rem)]',
        )}
      >
        <MapScene
          lines={scene}
          selected={selected === null ? null : { lineSlug: line.slug, stationId: selected }}
          onSelect={(s) => onSelect(s?.stationId ?? null)}
        />
      </div>

      <div className="px-4 pt-4">
        {station && now ? (
          <div>
            <p className="font-display text-3xl leading-none font-bold">{station.name}</p>
            <div className="mt-3 grid gap-2">
              {([0, 1] as const)
                .filter((dir) => !isTerminal(line, station.id, dir))
                .map((dir) => {
                  const next = nextDepartures(line, station.id, dir, now, 3)
                  return (
                    <div key={dir} className="flex items-center gap-3">
                      <span className="flex min-w-0 flex-1 items-center gap-1 text-sm text-muted">
                        <DirectionGlyph dir={dir} className="text-ink" />
                        <span className="truncate">{towards(line, dir)}</span>
                      </span>
                      {next.length ? (
                        next.map((d, k) => (
                          <span key={`${d.date}-${d.minutes}`} className="text-right">
                            <span
                              className={
                                k === 0
                                  ? 'rounded bg-signal px-1 font-display text-xl font-bold text-signal-ink'
                                  : 'font-display text-xl font-medium'
                              }
                            >
                              {formatTime(d.minutes)}
                            </span>
                            {k === 0 && (
                              <span className="ml-1 text-xs font-semibold">{whenLabel(d, now)}</span>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted">sem trens</span>
                      )}
                    </div>
                  )
                })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={directionsUrl(station)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-bg"
              >
                <Footprints className="size-4" aria-hidden />
                Como chegar
              </a>
              <button
                type="button"
                onClick={() => onShowList(station.id)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ink px-4 text-sm font-semibold"
              >
                <List className="size-4" aria-hidden />
                Ver na lista
              </button>
            </div>
          </div>
        ) : (
          <p className="text-muted">
            Toque numa estação para ver os próximos trens. Os trens amarelos mostram onde cada viagem deve
            estar agora segundo a tabela.
          </p>
        )}
        {!hasGoogleMaps && process.env.NODE_ENV === 'development' && (
          <p className="mt-4 rounded-lg border border-dashed border-rule p-3 text-sm text-muted">
            Mapa esquemático: defina NEXT_PUBLIC_GOOGLE_MAPS_API_KEY no .env.local para usar o Google Maps.
          </p>
        )}
      </div>
    </div>
  )
}
