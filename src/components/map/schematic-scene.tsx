'use client'

import clsx from 'clsx'

import type { SceneProps } from './types'

const SIZE = 1000
const PAD = 70
// station names are drawn to the right of the dots
const LABEL_ROOM = 230

/**
 * Map drawn from the OpenStreetMap geometry alone, used when no Google Maps
 * key is configured. Same interactions as the Google map, no tiles.
 */
export function SchematicScene({
  lines,
  selected,
  onSelect,
  allLabels = lines.length === 1,
  natural,
}: SceneProps & { natural?: boolean }) {
  const pts = lines.flatMap((l) => l.path)
  const lat0 = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const kx = Math.cos((lat0 * Math.PI) / 180)
  const xs = pts.map((p) => p[1] * kx)
  const ys = pts.map((p) => -p[0])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const w = Math.max(...xs) - minX || 1e-9
  const h = Math.max(...ys) - minY || 1e-9
  const scale = (SIZE - PAD * 2) / Math.max(w, h)
  const vw = w * scale + PAD * 2 + LABEL_ROOM
  const vh = h * scale + PAD * 2
  const xy = (lat: number, lng: number) =>
    [PAD + (lng * kx - minX) * scale, PAD + (-lat - minY) * scale] as const

  // Decide which names fit, most important first: selected, terminals, then the rest.
  // Two lines can have stations a few meters apart, and their names would overlap.
  const candidates = lines.flatMap((line) =>
    line.stations.map((station, i) => {
      const isSelected = selected?.lineSlug === line.slug && selected.stationId === station.id
      const isEnd = i === 0 || i === line.stations.length - 1
      return {
        key: `${line.slug}-${station.id}`,
        station,
        rank: isSelected ? 0 : isEnd ? 1 : allLabels ? 2 : 3,
      }
    }),
  )
  const placed: [number, number][] = []
  const labeled = new Set<string>()
  for (const c of candidates.filter((c) => c.rank < 3).sort((a, b) => a.rank - b.rank)) {
    const [x, y] = xy(c.station.lat, c.station.lng)
    const width = c.station.name.length * 15
    const hit = placed.some(([px, py]) => Math.abs(py - y) < 36 && x < px + width && px < x + width)
    if (hit && c.rank > 0) continue
    placed.push([x, y])
    labeled.add(c.key)
  }

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      className={clsx('touch-manipulation', natural ? 'block h-auto max-h-[75dvh] w-full' : 'size-full')}
      role="img"
      aria-label="Mapa esquemático das linhas"
      onClick={() => onSelect(null)}
    >
      {lines.map((line) => {
        const d = line.path.map(([lat, lng], i) => `${i ? 'L' : 'M'}${xy(lat, lng).join(' ')}`).join('')
        return (
          <g key={line.slug}>
            <path
              d={d}
              fill="none"
              stroke="var(--bg)"
              strokeWidth={22}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={d}
              fill="none"
              stroke={line.color}
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={line.dashed ? '18 12' : undefined}
            />
          </g>
        )
      })}

      {lines.flatMap((line) =>
        line.stations.map((station) => {
          const [x, y] = xy(station.lat, station.lng)
          const isSelected = selected?.lineSlug === line.slug && selected.stationId === station.id
          const showLabel = labeled.has(`${line.slug}-${station.id}`)
          return (
            <g
              key={`${line.slug}-${station.id}`}
              role="button"
              tabIndex={0}
              aria-label={station.name}
              className="cursor-pointer outline-none"
              onClick={(e) => {
                e.stopPropagation()
                onSelect({ lineSlug: line.slug, stationId: station.id })
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect({ lineSlug: line.slug, stationId: station.id })
                }
              }}
            >
              {/* generous hit area for fingers */}
              <circle cx={x} cy={y} r={26} fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 17 : 11}
                fill="var(--bg)"
                stroke={isSelected ? 'var(--ink)' : line.color}
                strokeWidth={isSelected ? 8 : 6}
              />
              {showLabel && (
                <text
                  x={x + (isSelected ? 26 : 20)}
                  y={y}
                  dominantBaseline="central"
                  className={clsx('font-display', isSelected ? 'font-bold' : 'font-semibold')}
                  fontSize={isSelected ? 44 : 32}
                  fill="var(--ink)"
                  stroke="var(--bg)"
                  strokeWidth={8}
                  paintOrder="stroke"
                >
                  {station.name}
                </text>
              )}
            </g>
          )
        }),
      )}

      {lines.flatMap((line) =>
        (line.trains ?? []).map((train) => {
          const [x, y] = xy(train.lat, train.lng)
          return (
            <g key={train.key} transform={`translate(${x} ${y})`} pointerEvents="none">
              <rect
                x={-13}
                y={-16}
                width={26}
                height={32}
                rx={6}
                fill="var(--signal)"
                stroke="var(--ink)"
                strokeWidth={4}
              />
              <path
                d={train.dir === 0 ? 'M-6 -3 L0 4 L6 -3' : 'M-6 3 L0 -4 L6 3'}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )
        }),
      )}
    </svg>
  )
}
