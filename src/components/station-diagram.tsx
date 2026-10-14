'use client'

import clsx from 'clsx'
import { CalendarClock, ChevronDown, ChevronUp, Footprints, MapPin } from 'lucide-react'
import Link from 'next/link'
import { type CSSProperties, useEffect, useRef } from 'react'

import { directionsUrl } from '@/lib/geo'
import { whenLabel } from '@/lib/labels'
import type { Line, Station } from '@/lib/metro'
import {
  type DirectionIndex,
  estimatedTrains,
  isTerminal,
  nextDepartures,
  type TrainPosition,
  towards,
} from '@/lib/schedule'
import { type ClockNow, formatTime } from '@/lib/time'

type Props = {
  line: Line
  now: ClockNow | null
  selected: number | null
  onSelect: (id: number | null) => void
  onShowMap: (id: number) => void
  onShowTimetable: (id: number) => void
}

const DIRS: DirectionIndex[] = [0, 1]

export function DirectionGlyph({ dir, className }: { dir: DirectionIndex; className?: string }) {
  const Icon = dir === 0 ? ChevronDown : ChevronUp
  return <Icon className={clsx('inline size-4 shrink-0', className)} strokeWidth={3} aria-hidden />
}

/** The line drawn top to bottom, with each station's next trains and the trains between them */
export function StationDiagram({ line, now, selected, onSelect, onShowMap, onShowTimetable }: Props) {
  const trains = now ? estimatedTrains(line, now) : []

  return (
    <div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-rule py-2 text-sm text-muted">
        {DIRS.map((dir) => (
          <span key={dir} className="inline-flex items-center gap-1">
            <DirectionGlyph dir={dir} className="text-ink" />
            sentido {towards(line, dir)}
          </span>
        ))}
      </div>

      <ol className="pb-4">
        {line.stations.map((station, i) => (
          <StationRow
            key={station.id}
            line={line}
            station={station}
            index={i}
            now={now}
            trains={trains.filter((t) => rowOf(t) === i)}
            open={selected === station.id}
            onToggle={() => onSelect(selected === station.id ? null : station.id)}
            onShowMap={() => onShowMap(station.id)}
            onShowTimetable={() => onShowTimetable(station.id)}
          />
        ))}
      </ol>

      {now && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <TrainMarker dir={0} />
          {trains.length
            ? `${trains.length} ${trains.length === 1 ? 'trem deve estar' : 'trens devem estar'} na linha agora, pela tabela. Não é rastreamento ao vivo.`
            : 'Nenhum trem na linha agora, pela tabela.'}
        </p>
      )}
    </div>
  )
}

/** Row whose dot the train has left behind, going down the list */
function rowOf(train: TrainPosition) {
  return Math.floor(train.from + train.progress)
}

function TrainMarker({
  dir,
  className,
  style,
}: {
  dir: DirectionIndex
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      style={style}
      className={clsx(
        'inline-grid h-6 w-5 shrink-0 place-items-center rounded-md border-2 border-ink bg-signal text-signal-ink shadow-sm',
        className,
      )}
    >
      <DirectionGlyph dir={dir} className="size-3.5" />
    </span>
  )
}

type RowProps = {
  line: Line
  station: Station
  index: number
  now: ClockNow | null
  trains: TrainPosition[]
  open: boolean
  onToggle: () => void
  onShowMap: () => void
  onShowTimetable: () => void
}

function StationRow({
  line,
  station,
  index,
  now,
  trains,
  open,
  onToggle,
  onShowMap,
  onShowTimetable,
}: RowProps) {
  const ref = useRef<HTMLLIElement>(null)
  const first = index === 0
  const last = index === line.stations.length - 1
  const transfers = line.integrations.filter((i) => i.stationId === station.id)

  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [open])

  return (
    <li ref={ref} className="relative grid scroll-mt-28 grid-cols-[2.75rem_1fr]">
      {/* track */}
      <div className="relative" aria-hidden>
        <span
          className={clsx(
            'absolute left-1/2 w-2 -translate-x-1/2 bg-line',
            first ? 'top-7' : 'top-0',
            last ? 'h-7' : 'bottom-0',
          )}
        />
        <span
          className={clsx(
            'absolute top-7 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-line bg-bg transition-transform',
            first || last ? 'size-6 border-[6px]' : 'size-5 border-[5px]',
            open && 'scale-125',
          )}
        />
        {trains.map((train) => {
          const position = train.from + train.progress - index
          return (
            <TrainMarker
              key={train.key}
              dir={train.dir}
              className="train-dot absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
              // the next dot sits one full row below this one
              style={{ top: `calc(1.75rem + ${position * 100}%)` }}
            />
          )
        })}
      </div>

      <div className={clsx('min-w-0 border-b border-rule', last && 'border-b-0')}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-14 w-full flex-col items-start justify-center gap-1 py-2.5 text-left"
        >
          <span className="flex w-full items-baseline justify-between gap-3">
            <span className="font-display text-[1.375rem] leading-tight font-semibold">{station.name}</span>
            {transfers.length > 0 && (
              <span className="flex shrink-0 gap-1">
                {transfers.map((t) => (
                  <span
                    key={t.slug}
                    className="size-3 rounded-full ring-2 ring-bg"
                    style={{ background: t.color }}
                    title={`Integração com ${t.name}`}
                  />
                ))}
              </span>
            )}
          </span>
          <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
            {now ? (
              DIRS.filter((dir) => !isTerminal(line, station.id, dir)).map((dir) => {
                const [next] = nextDepartures(line, station.id, dir, now, 1)
                return (
                  <span key={dir} className="inline-flex items-center gap-1">
                    <DirectionGlyph dir={dir} />
                    {next ? (
                      <>
                        <span className="font-semibold">{whenLabel(next, now)}</span>
                        <span className="text-muted">{formatTime(next.minutes)}</span>
                      </>
                    ) : (
                      <span className="text-muted">sem trens</span>
                    )}
                  </span>
                )
              })
            ) : (
              <span className="h-5" />
            )}
          </span>
        </button>

        {open && (
          <StationDetail
            line={line}
            station={station}
            now={now}
            transfers={transfers}
            onShowMap={onShowMap}
            onShowTimetable={onShowTimetable}
          />
        )}
      </div>
    </li>
  )
}

function StationDetail({
  line,
  station,
  now,
  transfers,
  onShowMap,
  onShowTimetable,
}: {
  line: Line
  station: Station
  now: ClockNow | null
  transfers: Line['integrations']
  onShowMap: () => void
  onShowTimetable: () => void
}) {
  return (
    <div className="pb-4">
      {now &&
        DIRS.filter((dir) => !isTerminal(line, station.id, dir)).map((dir) => {
          const next = nextDepartures(line, station.id, dir, now, 4)
          return (
            <div key={dir} className="mt-2 first:mt-0">
              <p className="flex items-center gap-1 text-sm text-muted">
                <DirectionGlyph dir={dir} className="text-ink" />
                Sentido {towards(line, dir)}
              </p>
              {next.length ? (
                <ol className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {next.map((d, k) => (
                    <li
                      key={`${d.date}-${d.minutes}`}
                      className={clsx(
                        'rounded-lg px-2 py-1.5',
                        k === 0 ? 'bg-signal text-signal-ink' : 'bg-surface',
                      )}
                    >
                      <span className="block font-display text-xl leading-none font-semibold">
                        {formatTime(d.minutes)}
                      </span>
                      <span className={clsx('text-xs', k === 0 ? 'font-semibold' : 'text-muted')}>
                        {whenLabel(d, now)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-1">Sem trens programados nos próximos dias.</p>
              )}
            </div>
          )
        })}

      {transfers.length > 0 && (
        <p className="mt-3 text-sm">
          Integração com{' '}
          {transfers.map((t, k) => (
            <span key={t.slug}>
              {k > 0 && (k === transfers.length - 1 ? ' e ' : ', ')}
              <Link href={`/linha/${t.slug}`} className="font-semibold underline underline-offset-2">
                {t.name}
              </Link>
              {t.fare && <span className="text-muted"> ({t.fare})</span>}
            </span>
          ))}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
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
          onClick={onShowMap}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ink px-4 text-sm font-semibold"
        >
          <MapPin className="size-4" aria-hidden />
          Ver no mapa
        </button>
        <button
          type="button"
          onClick={onShowTimetable}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ink px-4 text-sm font-semibold"
        >
          <CalendarClock className="size-4" aria-hidden />
          Horários do dia
        </button>
      </div>
    </div>
  )
}
