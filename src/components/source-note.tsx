import { source } from '@/lib/metro'
import { formatDate } from '@/lib/time'

export function SourceNote({ className }: { className?: string }) {
  const fetched = source.fetchedAt.slice(0, 10)
  return (
    <footer className={className}>
      <p className="max-w-prose text-sm leading-relaxed text-muted">
        Horários copiados da{' '}
        <a href={source.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">
          tabela oficial do Metrofor
        </a>{' '}
        em {formatDate(fetched)}, com a grade de {formatDate(source.validFrom)} a{' '}
        {formatDate(source.validUntil)}. Traçado e estações do{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          className="underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
        . Este site não é do Metrofor: em caso de dúvida, confira no site oficial.
      </p>
    </footer>
  )
}
