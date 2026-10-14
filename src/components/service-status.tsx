'use client'

import clsx from 'clsx'

import { type ServiceCalendar, serviceStatus } from '@/lib/schedule'
import { addDays, type ClockNow, DAY_NAMES, dayOf, formatDate, formatTime } from '@/lib/time'
import { useClock } from '@/lib/use-clock'

export function describeStatus(calendar: ServiceCalendar, now: ClockNow) {
  const status = serviceStatus(calendar, now)
  if (status.kind === 'running') return { running: true, text: `Operando até ${formatTime(status.until)}` }
  if (status.kind === 'none') return { running: false, text: 'Sem viagens programadas' }
  const at = formatTime(status.at)
  if (status.date === now.date) return { running: false, text: `Começa às ${at}` }
  if (status.date === addDays(now.date, 1)) return { running: false, text: `Volta amanhã às ${at}` }
  return {
    running: false,
    text: `Volta ${DAY_NAMES[dayOf(status.date)]}, ${formatDate(status.date)}, às ${at}`,
  }
}

export function ServiceStatus({ calendar, className }: { calendar: ServiceCalendar; className?: string }) {
  const now = useClock(30_000)
  if (!now) return <span className={clsx('inline-block h-5', className)} />
  const { running, text } = describeStatus(calendar, now)
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden
        className={clsx(
          'size-2.5 shrink-0 rounded-full',
          running ? 'train-dot bg-line' : 'border-2 border-muted',
        )}
      />
      {text}
    </span>
  )
}
