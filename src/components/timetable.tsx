'use client'

import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { Direction, Line } from '@/lib/metro'
import { type DirectionIndex, timetableIndexFor, towards } from '@/lib/schedule'
import { addDays, type ClockNow, DAY_NAMES, type DayKey, dayOf, formatDate, formatTime } from '@/lib/time'

import { DirectionGlyph } from './station-diagram'

type Props = {
  line: Line
  now: ClockNow | null
  stationId: number
  onStationChange: (id: number) => void
  dir: DirectionIndex
  onDirChange: (dir: DirectionIndex) => void
}

type DayChoice = { key: string; label: string; note?: string; timetable: number | null; date?: string }

const WEEK: DayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
const SHORT: Record<DayKey, string> = {
  seg: 'seg',
  ter: 'ter',
  qua: 'qua',
  qui: 'qui',
  sex: 'sex',
  sab: 'sáb',
  dom: 'dom',
}

function capitalize(text: string) {
  return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1)
}

function daysLabel(days: DayKey[]) {
  if (days.length === 1) return capitalize(DAY_NAMES[days[0]])
  const idx = days.map((d) => WEEK.indexOf(d))
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  if (consecutive) return `${capitalize(SHORT[days[0]])} a ${SHORT[days.at(-1)!]}`
  return capitalize(days.map((d) => SHORT[d]).join(', '))
}

function dayChoices(line: Line, now: ClockNow | null): DayChoice[] {
  const choices: DayChoice[] = []
  if (now) {
    choices.push({ key: 'hoje', label: 'Hoje', date: now.date, timetable: timetableIndexFor(line, now.date) })
    const tomorrow = addDays(now.date, 1)
    choices.push({
      key: 'amanha',
      label: 'Amanhã',
      date: tomorrow,
      timetable: timetableIndexFor(line, tomorrow),
    })
  }
  const groups = new Map<number | null, DayKey[]>()
  for (const day of WEEK) {
    const index = line.weekly[day]
    groups.set(index, [...(groups.get(index) ?? []), day])
  }
  for (const [timetable, days] of groups) {
    choices.push({
      key: `w-${days.join('')}`,
      label: daysLabel(days),
      note: timetable === null ? 'sem trens' : undefined,
      timetable,
    })
  }
  for (const e of line.exceptions) {
    if (now && e.date < now.date) continue
    choices.push({
      key: `e-${e.date}`,
      label: `${capitalize(SHORT[dayOf(e.date)])} ${formatDate(e.date)}`,
      note: 'especial',
      timetable: e.timetable,
      date: e.date,
    })
  }
  return choices
}

/** All times a direction serves a station (arrivals at the terminal included) */
function columnTimes(direction: Direction | null, stationId: number) {
  if (!direction) return []
  const column = direction.stationIds.indexOf(stationId)
  if (column === -1) return []
  return direction.trips
    .map((trip) => trip[column])
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b)
}

export function Timetable({ line, now, stationId, onStationChange, dir, onDirChange }: Props) {
  const choices = useMemo(() => dayChoices(line, now), [line, now])
  const [choiceKey, setChoiceKey] = useState('hoje')
  const [view, setView] = useState<'hora' | 'grade'>('hora')
  const choice = choices.find((c) => c.key === choiceKey) ?? choices[0]
  const isToday = choice?.key === 'hoje'

  const direction =
    choice && choice.timetable !== null ? line.timetables[choice.timetable].directions[dir] : null
  const times = columnTimes(direction, stationId)
  const terminal = direction?.stationIds.at(-1) === stationId
  const nextTime = isToday && now ? times.find((t) => t >= now.minutes) : undefined

  return (
    <div className="pb-6">
      <div className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4">
        <div className="flex w-max gap-2 py-3" role="radiogroup" aria-label="Dia">
          {choices.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={c.key === choice?.key}
              onClick={() => setChoiceKey(c.key)}
              className={clsx(
                'min-h-10 rounded-full border px-4 text-sm font-semibold whitespace-nowrap',
                c.key === choice?.key ? 'border-ink bg-ink text-bg' : 'border-rule bg-surface',
              )}
            >
              {c.label}
              {c.note && <span className="ml-1 font-normal opacity-70">{c.note}</span>}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1"
        role="radiogroup"
        aria-label="Sentido"
      >
        {([0, 1] as const).map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={dir === d}
            onClick={() => onDirChange(d)}
            className={clsx(
              'flex min-h-12 items-center gap-1.5 rounded-lg px-3 text-left text-sm leading-tight font-semibold',
              dir === d ? 'bg-line text-line-ink shadow-sm' : 'text-muted',
            )}
          >
            <DirectionGlyph dir={d} />
            <span>
              <span className="block text-xs font-normal opacity-80">sentido</span>
              {towards(line, d)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-end gap-3">
        <label className="min-w-0 flex-1">
          <span className="text-sm text-muted">Estação</span>
          <select
            value={stationId}
            onChange={(e) => onStationChange(Number(e.target.value))}
            className="mt-1 block min-h-12 w-full rounded-xl border border-rule bg-surface px-3 font-display text-xl font-semibold"
          >
            {line.stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div
          className="flex rounded-xl border border-rule p-0.5 text-sm font-semibold"
          role="radiogroup"
          aria-label="Formato"
        >
          {(
            [
              ['hora', 'Por hora'],
              ['grade', 'Grade'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={view === key}
              onClick={() => setView(key)}
              className={clsx('min-h-11 rounded-[0.625rem] px-3', view === key && 'bg-ink text-bg')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!direction ? (
        <p className="mt-6 text-lg">
          Sem trens programados {choice?.date ? `em ${formatDate(choice.date)}` : 'nesses dias'}.
        </p>
      ) : view === 'hora' ? (
        <>
          <p className="mt-5 text-sm text-muted">
            {terminal
              ? `${line.stations.find((s) => s.id === stationId)?.name} é o fim da linha nesse sentido: horários de chegada.`
              : `${times.length} partidas${choice?.date ? ` em ${formatDate(choice.date)}` : ''}.`}
          </p>
          <ByHour times={times} now={isToday ? now : null} nextTime={nextTime} />
        </>
      ) : (
        <FullGrid line={line} direction={direction} stationId={stationId} now={isToday ? now : null} />
      )}
    </div>
  )
}

function ByHour({ times, now, nextTime }: { times: number[]; now: ClockNow | null; nextTime?: number }) {
  const hours = new Map<number, number[]>()
  for (const t of times) {
    const h = Math.floor(t / 60)
    hours.set(h, [...(hours.get(h) ?? []), t])
  }
  return (
    <div className="mt-2 border-t-2 border-ink">
      {[...hours].map(([hour, list]) => (
        <div key={hour} className="grid grid-cols-[3.25rem_1fr] border-b border-rule">
          <span className="py-2 font-display text-2xl leading-8 font-bold">
            {String(hour % 24).padStart(2, '0')}
          </span>
          <span className="flex flex-wrap gap-x-1 gap-y-1 py-2">
            {list.map((t) => (
              <span
                key={t}
                className={clsx(
                  'rounded-md px-1.5 font-display text-2xl leading-8 font-medium',
                  t === nextTime && 'bg-signal font-bold text-signal-ink',
                  now && t < now.minutes && 'text-muted/60 line-through decoration-1',
                )}
              >
                {String(t % 60).padStart(2, '0')}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Stations down the side, trains across: the official table turned for a phone */
function FullGrid({
  line,
  direction,
  stationId,
  now,
}: {
  line: Line
  direction: Direction
  stationId: number
  now: ClockNow | null
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const names = new Map(line.stations.map((s) => [s.id, s.name]))
  const starts = direction.trips.map((trip) => trip.find((t) => t !== null) ?? 0)
  const lastTimes = direction.trips.map((trip) => trip.findLast((t) => t !== null) ?? 0)
  const nextTrip = now ? lastTimes.findIndex((t) => t >= now.minutes) : -1

  useEffect(() => {
    const el = scroller.current
    const cell = el?.querySelector<HTMLElement>('[data-next]')
    if (el && cell) el.scrollLeft = cell.offsetLeft - 160
  }, [nextTrip, direction])

  return (
    <div ref={scroller} className="-mx-4 mt-5 overflow-x-auto border-y-2 border-ink">
      <table className="border-separate border-spacing-0 font-display text-lg">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-bg px-4 py-1 text-left text-sm font-medium text-muted">
              Viagem
            </th>
            {starts.map((_, k) => (
              <th
                key={k}
                data-next={k === nextTrip || undefined}
                className={clsx(
                  'px-2 py-1 text-sm font-medium',
                  k === nextTrip ? 'bg-signal text-signal-ink' : 'text-muted',
                )}
              >
                {k + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {direction.stationIds.map((id, row) => (
            <tr key={id} className={clsx(id === stationId && 'bg-surface')}>
              <th
                scope="row"
                className={clsx(
                  'sticky left-0 z-10 max-w-[9.5rem] truncate border-t border-rule px-4 py-1.5 text-left font-semibold',
                  id === stationId ? 'bg-surface' : 'bg-bg',
                )}
              >
                {names.get(id)}
              </th>
              {direction.trips.map((trip, k) => {
                const t = trip[row]
                return (
                  <td
                    key={k}
                    className={clsx(
                      'border-t border-rule px-2 py-1.5 text-center tabular-nums',
                      k === nextTrip && 'bg-signal/25',
                      now && k < nextTrip && 'text-muted/60',
                    )}
                  >
                    {t === null ? '–' : formatTime(t)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
