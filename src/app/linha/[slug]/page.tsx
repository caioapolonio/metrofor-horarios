import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { LineView } from '@/components/line-view'
import { SourceNote } from '@/components/source-note'
import { calendarOf, getLine, lines } from '@/lib/metro'

export function generateStaticParams() {
  return lines.map((line) => ({ slug: line.slug }))
}

export async function generateMetadata({ params }: PageProps<'/linha/[slug]'>) {
  const { slug } = await params
  const line = getLine(slug)
  if (!line) return {}
  return {
    title:
      line.city === 'Fortaleza' || line.name.includes(line.city) ? line.name : `${line.name} (${line.city})`,
    description: `Próximos trens, tabela de horários e mapa da ${line.name}, ${line.route}.`,
  }
}

export default function LinePage({ params }: PageProps<'/linha/[slug]'>) {
  return (
    <Suspense fallback={<LineSkeleton />}>
      <LineContent params={params} />
    </Suspense>
  )
}

async function LineContent({ params }: Pick<PageProps<'/linha/[slug]'>, 'params'>) {
  const { slug } = await params
  const line = getLine(slug)
  if (!line) notFound()
  return <LineView line={line} calendar={calendarOf(line)} footer={<SourceNote />} />
}

function LineSkeleton() {
  return (
    <div aria-busy="true">
      <div className="h-64 animate-pulse bg-surface" />
      <div className="mx-auto max-w-xl space-y-4 px-4 pt-20">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    </div>
  )
}
