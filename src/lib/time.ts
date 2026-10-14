export const DAY_KEYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'] as const
export type DayKey = (typeof DAY_KEYS)[number]

export const DAY_NAMES: Record<DayKey, string> = {
  dom: 'domingo',
  seg: 'segunda',
  ter: 'terça',
  qua: 'quarta',
  qui: 'quinta',
  sex: 'sexta',
  sab: 'sábado',
}

const TIME_ZONE = 'America/Fortaleza'

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export type ClockNow = {
  /** ISO date (yyyy-mm-dd) in Fortaleza */
  date: string
  day: DayKey
  /** Minutes after midnight, with seconds as a fraction */
  minutes: number
}

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
})

const WEEKDAY_FROM_EN: Record<string, DayKey> = {
  Sun: 'dom',
  Mon: 'seg',
  Tue: 'ter',
  Wed: 'qua',
  Thu: 'qui',
  Fri: 'sex',
  Sat: 'sab',
}

export function clockAt(at: Date): ClockNow {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, x.value]))
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    day: WEEKDAY_FROM_EN[p.weekday],
    minutes: Number(p.hour) * 60 + Number(p.minute) + Number(p.second) / 60,
  }
}

export function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function dayOf(isoDate: string): DayKey {
  return DAY_KEYS[new Date(`${isoDate}T12:00:00Z`).getUTCDay()]
}

export function formatDate(isoDate: string) {
  const [, m, d] = isoDate.split('-')
  return `${d}/${m}`
}

/** "agora", "1 min", "12 min", "1 h 05" */
export function formatWait(minutes: number) {
  if (minutes < 1) return 'agora'
  const total = Math.floor(minutes)
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}
