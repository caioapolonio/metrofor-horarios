import 'server-only'

import geometry from '@/data/geometry.json'
import schedules from '@/data/schedules.json'

import type { StationPin } from '@/components/near-me'

import type { ServiceCalendar } from './schedule'
import { type DayKey, toMinutes } from './time'

type RawLine = (typeof schedules.lines)[number]

export type City = 'Fortaleza' | 'Sobral' | 'Cariri'

export type Station = {
  id: number
  name: string
  lat: number
  lng: number
}

export type Direction = {
  /** Display name of the last station, used as "sentido X" */
  towards: string
  stationIds: number[]
  /** trips[trip][stationIndex] in minutes after midnight, null when the train skips it */
  trips: (number | null)[][]
}

export type Integration = {
  slug: string
  name: string
  color: string
  fare: string | null
  /** Station of this line where people change trains, when they are close enough to walk */
  stationId: number | null
}

export type Line = {
  id: number
  slug: string
  name: string
  city: City
  color: string
  /** Text color that reads on top of `color` */
  ink: string
  route: string
  fare: string | null
  aboutUrl: string | null
  lengthKm: number
  /** Stations in the order trains run in the first direction */
  stations: Station[]
  path: [number, number][]
  /** directions[0] runs down the station list, directions[1] runs up; null when that way has no trips */
  timetables: { directions: [Direction | null, Direction | null] }[]
  weekly: Record<DayKey, number | null>
  exceptions: { date: string; timetable: number | null }[]
  integrations: Integration[]
}

// Colors come from the line icons on info.metrofor.ce.gov.br
const META: Record<number, { slug: string; name: string; city: City; color: string; ink: string }> = {
  1: { slug: 'linha-sul', name: 'Linha Sul', city: 'Fortaleza', color: '#ed1c24', ink: '#ffffff' },
  2: { slug: 'linha-oeste', name: 'Linha Oeste', city: 'Fortaleza', color: '#a6ce39', ink: '#1a2406' },
  3: { slug: 'linha-nordeste', name: 'Linha Nordeste', city: 'Fortaleza', color: '#5b54a4', ink: '#ffffff' },
  7: { slug: 'vlt-aeroporto', name: 'VLT Aeroporto', city: 'Fortaleza', color: '#5b54a4', ink: '#ffffff' },
  4: { slug: 'sobral-linha-norte', name: 'Linha Norte', city: 'Sobral', color: '#547fc0', ink: '#ffffff' },
  5: { slug: 'sobral-linha-sul', name: 'Linha Sul', city: 'Sobral', color: '#db4535', ink: '#ffffff' },
  6: { slug: 'vlt-cariri', name: 'VLT Cariri', city: 'Cariri', color: '#039d56', ink: '#ffffff' },
}

const LINE_ORDER = [1, 2, 3, 7, 4, 5, 6]

// Official names come in caps and sometimes without accents
const NAME_FIXES: Record<string, string> = {
  EXPEDICIONARIOS: 'Expedicionários',
  'EXPEDICIONARIOS - AE': 'Expedicionários',
  'PARANGABA - NE': 'Parangaba',
  'ANTONIO VIEIRA': 'Antônio Vieira',
  'ALTO DA BRASILIA': 'Alto da Brasília',
  'JUSCELINO KUBITSCHECK': 'Juscelino Kubitscheck',
}

const LOWER = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
const ROMAN = /^(I|II|III|IV|V)$/

export function stationName(raw: string) {
  if (NAME_FIXES[raw]) return NAME_FIXES[raw]
  return raw
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((word, i) => {
      if (ROMAN.test(word.toUpperCase())) return word.toUpperCase()
      if (i > 0 && LOWER.has(word)) return word
      return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
    })
    .join(' ')
}

/** "Tarifa R$ 3,60" -> "R$ 3,60"; "Passagem Gratuita" / "Integração Gratuita" -> "gratuita" */
function fareLabel(raw: string | null | undefined) {
  if (!raw) return null
  if (/gratuit/i.test(raw)) return 'gratuita'
  return raw.replace(/^Tarifa\s*/i, '')
}

function routeName(raw: string) {
  return raw
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .join(' – ')
}

/**
 * Converts "HH:MM" to minutes. Late trips run past midnight (00:19 after
 * 23:56), so those times keep counting from 24:00 of the same service day.
 */
function withRollover(trips: (string | null)[][]) {
  let lastStart = 0
  return trips.map((trip) => {
    const first = trip.find((t) => t !== null)
    let shift = first && toMinutes(first) < lastStart - 720 ? 1440 : 0
    let previous = -Infinity
    const minutes = trip.map((time) => {
      if (!time) return null
      let m = toMinutes(time) + shift
      if (m < previous) {
        shift += 1440
        m += 1440
      }
      previous = m
      return m
    })
    lastStart = minutes.find((m) => m !== null) ?? lastStart
    return minutes
  })
}

function buildLine(raw: RawLine): Line {
  const meta = META[raw.id]
  const geo = geometry.lines[String(raw.id) as keyof typeof geometry.lines]
  const coords = new Map(geo.stations.map((s) => [s.id, s]))
  const names = new Map(raw.stations.map((s) => [s.id, stationName(s.name)]))

  const parsed = raw.timetables.map((t) =>
    t.directions.map((d): Direction => ({
      towards: names.get(d.stationIds.at(-1)!) ?? stationName(d.to),
      stationIds: d.stationIds,
      trips: withRollover(d.trips),
    })),
  )

  // Show stations in the order trains run in the first direction we know
  const order = parsed[0]?.[0]?.stationIds ?? raw.stations.map((s) => s.id)
  const last = order.at(-1)
  const timetables = parsed.map((directions) => ({
    directions: [
      directions.find((d) => d.stationIds.at(-1) === last) ?? null,
      directions.find((d) => d.stationIds.at(-1) !== last) ?? null,
    ] as [Direction | null, Direction | null],
  }))

  const stations = order.map((id) => {
    const c = coords.get(id)
    if (!c) throw new Error(`Missing coordinates for station ${id} on line ${raw.id}`)
    return { id, name: names.get(id)!, lat: c.lat, lng: c.lng }
  })

  const path = geo.path as [number, number][]
  const first = stations[0]
  const startsAtFirst =
    Math.hypot(path[0][0] - first.lat, path[0][1] - first.lng) <
    Math.hypot(path.at(-1)![0] - first.lat, path.at(-1)![1] - first.lng)

  return {
    id: raw.id,
    slug: meta.slug,
    name: meta.name,
    city: meta.city,
    color: meta.color,
    ink: meta.ink,
    route: routeName(raw.route),
    fare: fareLabel(raw.fare),
    aboutUrl: raw.aboutUrl,
    lengthKm: geo.lengthKm,
    stations,
    path: startsAtFirst ? path : [...path].reverse(),
    timetables,
    weekly: raw.weekly as Record<DayKey, number | null>,
    exceptions: raw.exceptions.map((e) => ({ date: e.date, timetable: e.variant })),
    integrations: [],
  }
}

/** Meters between two coordinates; good enough at city scale */
export function distance(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const kx = 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  return Math.hypot((b.lng - a.lng) * kx, (b.lat - a.lat) * 110_540)
}

const TRANSFER_WALK = 700

function linkIntegrations(all: Line[]) {
  for (const line of all) {
    const raw = schedules.lines.find((l) => l.id === line.id)!
    line.integrations = raw.integrations.flatMap((i) => {
      const otherRaw = schedules.lines.find((l) => l.name === i.line)
      const other = otherRaw && all.find((l) => l.id === otherRaw.id)
      if (!other) return []
      let best: { id: number; meters: number } | null = null
      for (const a of line.stations) {
        for (const b of other.stations) {
          const meters = distance(a, b)
          if (meters < TRANSFER_WALK && (!best || meters < best.meters)) best = { id: a.id, meters }
        }
      }
      return [
        {
          slug: other.slug,
          name: other.name,
          color: other.color,
          fare: fareLabel(i.fare),
          stationId: best?.id ?? null,
        },
      ]
    })
  }
  return all
}

export const lines: Line[] = linkIntegrations(
  LINE_ORDER.map((id) => buildLine(schedules.lines.find((l) => l.id === id)!)),
)

export const source = {
  url: schedules.source,
  fetchedAt: schedules.fetchedAt,
  validFrom: schedules.validFrom,
  validUntil: schedules.validUntil,
}

export function getLine(slug: string) {
  return lines.find((l) => l.slug === slug)
}

export const cities: City[] = ['Fortaleza', 'Sobral', 'Cariri']

export function calendarOf(line: Line): ServiceCalendar {
  return {
    weekly: line.weekly,
    exceptions: line.exceptions,
    spans: line.timetables.map(({ directions }) => {
      const times = directions.flatMap(
        (d) => d?.trips.flatMap((t) => t.filter((x): x is number => x !== null)) ?? [],
      )
      return times.length ? [Math.min(...times), Math.max(...times)] : null
    }),
  }
}

export function stationPins(): StationPin[] {
  return lines.flatMap((line) =>
    line.stations.map((s) => ({
      lineSlug: line.slug,
      lineName: line.name,
      city: line.city,
      color: line.color,
      ink: line.ink,
      stationId: s.id,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
    })),
  )
}
