import { Map as MapIcon } from 'lucide-react'
import Link from 'next/link'
import type { CSSProperties } from 'react'

import { LineShape } from '@/components/line-shape'
import { NearMe } from '@/components/near-me'
import { ServiceStatus } from '@/components/service-status'
import { SourceNote } from '@/components/source-note'
import { calendarOf, cities, lines, stationPins } from '@/lib/metro'

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-16">
      <header className="flex items-center justify-between py-2">
        <p className="font-display text-lg font-semibold tracking-tight">Horários do Metrofor</p>
        <Link
          href="/mapa"
          className="-mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-medium hover:bg-surface"
        >
          <MapIcon className="size-4" aria-hidden />
          Mapa da rede
        </Link>
      </header>

      <h1 className="mt-10 font-display text-[clamp(3.5rem,18vw,5.5rem)] leading-[0.85] font-bold tracking-tight">
        Qual linha?
      </h1>
      <p className="mt-4 max-w-sm text-lg text-muted">
        Escolha a linha para ver os próximos trens, a tabela do dia e o trajeto no mapa.
      </p>

      <div className="mt-6">
        <NearMe stations={stationPins()} />
      </div>

      {cities.map((city) => (
        <section key={city} className="mt-12" aria-labelledby={`city-${city}`}>
          <h2 id={`city-${city}`} className="font-display text-2xl font-semibold text-muted">
            {city}
          </h2>
          <ul className="mt-2 border-t-2 border-ink">
            {lines
              .filter((line) => line.city === city)
              .map((line) => (
                <li key={line.slug} className="border-b border-rule">
                  <Link
                    href={`/linha/${line.slug}`}
                    prefetch
                    style={{ '--line': line.color, '--line-ink': line.ink } as CSSProperties}
                    className="group grid grid-cols-[4.5rem_1fr] items-center gap-4 py-4"
                  >
                    <span className="grid aspect-square place-items-center rounded-xl bg-line p-2 transition-transform group-hover:-rotate-3 group-active:scale-95">
                      <LineShape
                        path={line.path}
                        color="var(--line-ink)"
                        stroke={3.5}
                        className="size-full"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-[2rem] leading-none font-bold">
                        {line.name}
                      </span>
                      <span className="mt-1 block truncate text-muted">{line.route}</span>
                      <ServiceStatus calendar={calendarOf(line)} className="mt-1.5 text-sm font-medium" />
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      ))}

      <SourceNote className="mt-14" />
    </main>
  )
}
