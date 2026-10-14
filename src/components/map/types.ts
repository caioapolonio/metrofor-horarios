import type { DirectionIndex } from '@/lib/schedule'

export type SceneStation = { id: number; name: string; lat: number; lng: number }

export type SceneTrain = { key: string; dir: DirectionIndex; lat: number; lng: number }

export type SceneLine = {
  slug: string
  name: string
  color: string
  ink: string
  path: [number, number][]
  stations: SceneStation[]
  trains?: SceneTrain[]
  /** Draw dashed, for branches that share a color with another line */
  dashed?: boolean
}

export type Selection = { lineSlug: string; stationId: number } | null

export type SceneProps = {
  lines: SceneLine[]
  selected: Selection
  onSelect: (selection: Selection) => void
  /** Show every station name instead of only terminals and the selected one */
  allLabels?: boolean
}

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
export const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'

export function sceneBounds(lines: SceneLine[]) {
  const pts = lines.flatMap((l) => l.path)
  return {
    north: Math.max(...pts.map((p) => p[0])),
    south: Math.min(...pts.map((p) => p[0])),
    east: Math.max(...pts.map((p) => p[1])),
    west: Math.min(...pts.map((p) => p[1])),
  }
}
