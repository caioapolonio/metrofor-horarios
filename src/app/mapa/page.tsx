import type { Metadata } from 'next'

import { NetworkMap } from '@/components/network-map'
import { calendarOf, cities, lines } from '@/lib/metro'

export const metadata: Metadata = {
  title: 'Mapa da rede',
  description: 'Todas as linhas e estações do Metrofor no mapa: Fortaleza, Sobral e Cariri.',
}

export default function NetworkPage() {
  return (
    <NetworkMap
      cities={cities}
      lines={lines.map((line) => ({
        slug: line.slug,
        name: line.name,
        city: line.city,
        color: line.color,
        ink: line.ink,
        path: line.path,
        stations: line.stations,
        calendar: calendarOf(line),
        // the airport branch shares the Nordeste purple
        dashed: line.slug === 'vlt-aeroporto',
      }))}
    />
  )
}
