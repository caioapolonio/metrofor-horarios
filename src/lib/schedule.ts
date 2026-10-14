import type { Direction, Line } from './metro'
import { addDays, type ClockNow, dayOf } from './time'

export type DirectionIndex = 0 | 1

/** How far ahead to look for the next train; covers the whole published timetable */
const LOOKAHEAD_DAYS = 35

export function timetableIndexFor(line: Line, date: string) {
  const exception = line.exceptions.find((e) => e.date === date)
  if (exception) return exception.timetable
  return line.weekly[dayOf(date)]
}

export function directionsFor(line: Line, date: string) {
  const index = timetableIndexFor(line, date)
  return index === null ? null : line.timetables[index].directions
}

/** Departure times (minutes) from a station; null when the station ends that direction */
export function departures(direction: Direction | null, stationId: number) {
  if (!direction) return null
  const column = direction.stationIds.indexOf(stationId)
  if (column === -1 || column === direction.stationIds.length - 1) return null
  return direction.trips
    .map((trip) => trip[column])
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b)
}

export type Departure = { date: string; minutes: number; wait: number }

/**
 * Next trains from a station, looking ahead into the next days when service
 * is over for today. `wait` is in minutes from now.
 */
export function nextDepartures(
  line: Line,
  stationId: number,
  dir: DirectionIndex,
  now: ClockNow,
  count = 4,
): Departure[] {
  const result: Departure[] = []
  // Start from yesterday: its late trips may still run after midnight
  for (let offset = -1; offset < LOOKAHEAD_DAYS && result.length < count; offset++) {
    const date = addDays(now.date, offset)
    const times = departures(directionsFor(line, date)?.[dir] ?? null, stationId)
    if (!times) continue
    for (const minutes of times) {
      const wait = minutes + offset * 1440 - now.minutes
      if (wait < 0) continue
      result.push({ date, minutes, wait })
      if (result.length === count) break
    }
  }
  return result
}

/** Whether the station is the end of the line for trains going that way */
export function isTerminal(line: Line, stationId: number, dir: DirectionIndex) {
  const ids = line.stations.map((s) => s.id)
  return dir === 0 ? ids.at(-1) === stationId : ids[0] === stationId
}

export function towards(line: Line, dir: DirectionIndex) {
  return dir === 0 ? line.stations.at(-1)!.name : line.stations[0].name
}

export type ServiceStatus =
  { kind: 'running'; until: number } | { kind: 'later'; date: string; at: number } | { kind: 'none' }

/** Just enough of a line to know when it runs: first and last train of each timetable */
export type ServiceCalendar = Pick<Line, 'weekly' | 'exceptions'> & {
  spans: ([number, number] | null)[]
}

function spanIndexFor(calendar: ServiceCalendar, date: string) {
  const exception = calendar.exceptions.find((e) => e.date === date)
  if (exception) return exception.timetable
  return calendar.weekly[dayOf(date)]
}

/** Is any train scheduled right now, and if not, when does service start? */
export function serviceStatus(calendar: ServiceCalendar, now: ClockNow): ServiceStatus {
  for (let offset = -1; offset < LOOKAHEAD_DAYS; offset++) {
    const date = addDays(now.date, offset)
    const index = spanIndexFor(calendar, date)
    const span = index === null ? null : calendar.spans[index]
    if (!span) continue
    const [first, last] = span
    const minutes = now.minutes - offset * 1440
    if (minutes >= first && minutes <= last) return { kind: 'running', until: last }
    if (minutes > last) continue
    return { kind: 'later', date, at: first }
  }
  return { kind: 'none' }
}

export type TrainPosition = {
  key: string
  dir: DirectionIndex
  /** Index in line.stations of the station the train left (or is at) */
  from: number
  /** 0..1 between `from` and the next station in its direction */
  progress: number
  /** Minutes until it reaches the next station */
  nextIn: number
}

/** Where trains should be now according to the timetable (not live tracking) */
export function estimatedTrains(line: Line, now: ClockNow): TrainPosition[] {
  const order = new Map(line.stations.map((s, i) => [s.id, i]))
  const trains: TrainPosition[] = []
  // Yesterday's late trips are still on the line right after midnight
  for (const [date, minutes] of [
    [now.date, now.minutes],
    [addDays(now.date, -1), now.minutes + 1440],
  ] as const) {
    const directions = directionsFor(line, date)
    if (directions) addTrains(directions, { ...now, minutes }, order, trains, date)
  }
  return trains
}

function addTrains(
  directions: [Direction | null, Direction | null],
  now: ClockNow,
  order: Map<number, number>,
  trains: TrainPosition[],
  date: string,
) {
  directions.forEach((direction, d) => {
    if (!direction) return
    const dir = d as DirectionIndex
    direction.trips.forEach((trip, t) => {
      const stops = trip
        .map((time, i) => ({ time, index: order.get(direction.stationIds[i])! }))
        .filter((s): s is { time: number; index: number } => s.time !== null)
      if (stops.length < 2) return
      if (now.minutes < stops[0].time || now.minutes > stops.at(-1)!.time) return
      for (let i = 0; i < stops.length - 1; i++) {
        const a = stops[i]
        const b = stops[i + 1]
        if (now.minutes >= a.time && now.minutes <= b.time) {
          const span = Math.max(b.time - a.time, 0.5)
          const progress = Math.min(1, (now.minutes - a.time) / span)
          // Express progress along the station list order
          trains.push({
            key: `${date}-${dir}-${t}`,
            dir,
            from: a.index,
            progress: b.index > a.index ? progress : -progress,
            nextIn: b.time - now.minutes,
          })
          return
        }
      }
    })
  })
}

/** Position of a train along the station list, as a fractional station index */
export function trainIndex(train: TrainPosition) {
  return train.from + train.progress
}
