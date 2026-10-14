type Point = { lat: number; lng: number }

type Props = {
  path: [number, number][]
  stations?: Point[]
  color: string
  /** Stroke width in px at the rendered size */
  stroke?: number
  stationRadius?: number
  stationFill?: string
  className?: string
  /** Padding inside the box, in px */
  pad?: number
  size?: number
}

/**
 * The real shape of a line (from OpenStreetMap), drawn as a small signature.
 * Uses a local equirectangular projection, which is accurate at city scale.
 */
export function LineShape({
  path,
  stations = [],
  color,
  stroke = 3,
  stationRadius = 0,
  stationFill = 'var(--bg)',
  className,
  pad = 4,
  size = 100,
}: Props) {
  const lat0 = path.reduce((sum, p) => sum + p[0], 0) / path.length
  const kx = Math.cos((lat0 * Math.PI) / 180)
  const project = (lat: number, lng: number) => [lng * kx, -lat] as const
  const pts = path.map(([lat, lng]) => project(lat, lng))
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const w = Math.max(...xs) - minX || 1e-9
  const h = Math.max(...ys) - minY || 1e-9
  const scale = (size - pad * 2) / Math.max(w, h)
  const offX = (size - w * scale) / 2
  const offY = (size - h * scale) / 2
  const fit = ([x, y]: readonly [number, number]) =>
    [offX + (x - minX) * scale, offY + (y - minY) * scale] as const

  const d = pts
    .map((p, i) => {
      const [x, y] = fit(p)
      return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join('')

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {stationRadius > 0 &&
        stations.map((s, i) => {
          const [x, y] = fit(project(s.lat, s.lng))
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={stationRadius}
              fill={stationFill}
              stroke={color}
              strokeWidth={stroke * 0.6}
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
    </svg>
  )
}
