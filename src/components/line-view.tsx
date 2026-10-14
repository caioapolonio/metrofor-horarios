'use client'

import clsx from 'clsx'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { type CSSProperties, type ReactNode, useEffect, useState } from 'react'

import type { Line } from '@/lib/metro'
import { type DirectionIndex, type ServiceCalendar, timetableIndexFor } from '@/lib/schedule'
import { formatDate } from '@/lib/time'
import { useClock } from '@/lib/use-clock'

import { LineMap } from './line-map'
import { LineShape } from './line-shape'
import { ServiceStatus } from './service-status'
import { StationDiagram } from './station-diagram'
import { Timetable } from './timetable'

type Tab = 'estacoes' | 'mapa' | 'horarios'

const TABS: { id: Tab; label: string }[] = [
  { id: 'estacoes', label: 'Estações' },
  { id: 'mapa', label: 'Mapa' },
  { id: 'horarios', label: 'Horários' },
]

type Props = { line: Line; calendar: ServiceCalendar; footer: ReactNode }

export function LineView({ line, calendar, footer }: Props) {
  const now = useClock()
  const [tab, setTab] = useState<Tab>('estacoes')
  const [selected, setSelected] = useState<number | null>(null)
  const [timetableStation, setTimetableStation] = useState(line.stations[0].id)
  const [dir, setDir] = useState<DirectionIndex>(0)

  // Deep links: /linha/x?estacao=5&aba=mapa
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = Number(params.get('estacao'))
    const aba = params.get('aba')
    /* eslint-disable react-hooks/set-state-in-effect -- reading the URL once after hydration */
    if (line.stations.some((s) => s.id === id)) {
      setSelected(id)
      setTimetableStation(id)
    }
    if (aba === 'mapa' || aba === 'horarios') setTab(aba)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [line])

  useEffect(() => {
    const params = new URLSearchParams()
    if (selected !== null) params.set('estacao', String(selected))
    if (tab !== 'estacoes') params.set('aba', tab)
    const query = params.toString()
    window.history.replaceState(window.history.state, '', query ? `?${query}` : window.location.pathname)
  }, [selected, tab])

  function select(id: number | null) {
    setSelected(id)
    if (id !== null) setTimetableStation(id)
  }

  function go(next: Tab, stationId?: number) {
    if (stationId !== undefined) select(stationId)
    setTab(next)
    window.scrollTo({ top: document.getElementById('abas')?.offsetTop ?? 0, behavior: 'smooth' })
  }

  const todayIndex = now ? timetableIndexFor(line, now.date) : undefined
  const special = now ? line.exceptions.some((e) => e.date === now.date) : false

  return (
    <div style={{ '--line': line.color, '--line-ink': line.ink } as CSSProperties}>
      <header className="relative overflow-hidden bg-line text-line-ink">
        <LineShape
          path={line.path}
          color="currentColor"
          stroke={14}
          className="pointer-events-none absolute -top-4 -right-10 size-72 opacity-20"
        />
        <div className="relative mx-auto max-w-xl px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-6">
          <nav className="flex items-center justify-between">
            <Link
              href="/"
              className="-ml-2 inline-flex min-h-11 items-center gap-0.5 rounded-full pr-3 pl-1 font-semibold"
            >
              <ChevronLeft className="size-5" aria-hidden />
              Linhas
            </Link>
            <span className="font-medium opacity-80">{line.city}</span>
          </nav>
          <h1 className="mt-8 font-display text-[clamp(3.25rem,17vw,5rem)] leading-[0.85] font-bold tracking-tight">
            {line.name}
          </h1>
          <p className="mt-3 text-lg font-medium">{line.route}</p>
          <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <div className="flex gap-1">
              <dd className="font-semibold">{line.stations.length}</dd>
              <dt>estações</dt>
            </div>
            <div className="flex gap-1">
              <dd className="font-semibold">{line.lengthKm.toLocaleString('pt-BR')} km</dd>
              <dt className="sr-only">de extensão</dt>
            </div>
            {line.fare && (
              <div className="flex gap-1">
                <dt>Tarifa</dt>
                <dd className="font-semibold">{line.fare}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      <div id="abas" className="sticky top-0 z-30 border-b border-rule bg-bg/90 backdrop-blur-md">
        <div className="mx-auto grid max-w-xl grid-cols-3 px-2" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="painel"
              onClick={() => setTab(t.id)}
              className={clsx(
                'relative min-h-13 font-display text-lg font-semibold transition-colors',
                tab === t.id ? 'text-ink' : 'text-muted',
              )}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-4 bottom-0 h-1 rounded-t-full bg-ink" />}
            </button>
          ))}
        </div>
      </div>

      <main id="painel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="mx-auto max-w-xl px-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-4 pb-1">
          <ServiceStatus calendar={calendar} className="font-semibold" />
          {now && (
            <span className="text-sm text-muted">
              {todayIndex === null
                ? 'Sem operação hoje'
                : special
                  ? 'Hoje com horário especial'
                  : 'Grade normal de hoje'}
            </span>
          )}
        </div>

        {Object.values(line.weekly).every((t) => t === null) && (
          <p className="mt-2 rounded-xl border-l-4 border-line bg-surface p-3 text-sm">
            Sem operação regular na grade publicada pelo Metrofor.
            {line.exceptions.some((e) => e.timetable !== null) &&
              ` Há viagens em ${line.exceptions
                .filter((e) => e.timetable !== null)
                .map((e) => formatDate(e.date))
                .join(' e ')}.`}
          </p>
        )}

        {tab === 'estacoes' && (
          <StationDiagram
            line={line}
            now={now}
            selected={selected}
            onSelect={select}
            onShowMap={(id) => go('mapa', id)}
            onShowTimetable={(id) => go('horarios', id)}
          />
        )}
        {tab === 'mapa' && (
          <div className="pt-3">
            <LineMap
              line={line}
              now={now}
              selected={selected}
              onSelect={select}
              onShowList={(id) => go('estacoes', id)}
            />
          </div>
        )}
        {tab === 'horarios' && (
          <Timetable
            line={line}
            now={now}
            stationId={timetableStation}
            onStationChange={setTimetableStation}
            dir={dir}
            onDirChange={setDir}
          />
        )}

        <section className="mt-10 border-t-2 border-ink pt-4 pb-14">
          {line.integrations.length > 0 && (
            <>
              <h2 className="font-display text-2xl font-semibold">Integrações</h2>
              <ul className="mt-2 divide-y divide-rule">
                {line.integrations.map((i) => (
                  <li key={i.slug}>
                    <Link href={`/linha/${i.slug}`} className="flex min-h-12 items-center gap-3 py-2">
                      <span className="h-6 w-2 rounded-full" style={{ background: i.color }} />
                      <span className="flex-1">
                        <span className="font-semibold">{i.name}</span>
                        {i.stationId !== null && (
                          <span className="block text-sm text-muted">
                            em {line.stations.find((s) => s.id === i.stationId)?.name}
                          </span>
                        )}
                      </span>
                      {i.fare && <span className="text-sm text-muted">{i.fare}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {line.aboutUrl && (
            <a
              href={line.aboutUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 font-semibold underline underline-offset-2"
            >
              Sobre a linha no site do Metrofor
              <ExternalLink className="size-4" aria-hidden />
            </a>
          )}
          <div className="mt-8">{footer}</div>
        </section>
      </main>
    </div>
  )
}
