import type { Departure } from './schedule'
import { addDays, type ClockNow, DAY_NAMES, dayOf, formatWait } from './time'

/** Short label for when a train leaves: "4 min", "2 h 10", "amanhã", "sábado" */
export function whenLabel(departure: Departure, now: ClockNow) {
  const day = addDays(departure.date, Math.floor(departure.minutes / 1440))
  if (day === now.date || departure.wait < 120) return formatWait(departure.wait)
  if (day === addDays(now.date, 1)) return 'amanhã'
  return DAY_NAMES[dayOf(day)]
}
