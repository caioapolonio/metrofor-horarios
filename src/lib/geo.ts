import type { Line } from './metro'

type LatLng = { lat: number; lng: number }

export function meters(a: LatLng, b: LatLng) {
  const kx = 111_320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180)
  return Math.hypot((b.lng - a.lng) * kx, (b.lat - a.lat) * 110_540)
}

type Track = { cumulative: number[]; stationAt: number[] }

const tracks = new WeakMap<Line, Track>()

/** Distance along the path of every vertex and of every station */
function track(line: Line): Track {
  const cached = tracks.get(line)
  if (cached) return cached
  const pts = line.path.map(([lat, lng]) => ({ lat, lng }))
  const cumulative = [0]
  for (let i = 1; i < pts.length; i++) cumulative.push(cumulative[i - 1] + meters(pts[i - 1], pts[i]))
  const stationAt = line.stations.map((s) => {
    let best = 0
    for (let i = 1; i < pts.length; i++) if (meters(pts[i], s) < meters(pts[best], s)) best = i
    return cumulative[best]
  })
  const result = { cumulative, stationAt }
  tracks.set(line, result)
  return result
}

/** Coordinates of a fractional station index (2.5 = halfway between stations 2 and 3) */
export function positionOnLine(line: Line, index: number): LatLng {
  const { cumulative, stationAt } = track(line)
  const i = Math.max(0, Math.min(line.stations.length - 1, Math.floor(index)))
  const frac = index - i
  const a = stationAt[i]
  const b = stationAt[Math.min(i + 1, stationAt.length - 1)]
  const target = a + (b - a) * frac
  let k = cumulative.findIndex((c) => c >= target)
  if (k <= 0) k = 1
  const [lat1, lng1] = line.path[k - 1]
  const [lat2, lng2] = line.path[Math.min(k, line.path.length - 1)]
  const span = cumulative[k] - cumulative[k - 1] || 1
  const t = Math.max(0, Math.min(1, (target - cumulative[k - 1]) / span))
  return { lat: lat1 + (lat2 - lat1) * t, lng: lng1 + (lng2 - lng1) * t }
}

export function directionsUrl(to: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}&travelmode=walking`
}

export function placeUrl(to: LatLng) {
  return `https://www.google.com/maps/search/?api=1&query=${to.lat},${to.lng}`
}
