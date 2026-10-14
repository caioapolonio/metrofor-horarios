'use client'

import { AdvancedMarker, APIProvider, ColorScheme, Map, Polyline, useMap } from '@vis.gl/react-google-maps'
import clsx from 'clsx'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo } from 'react'

import { GOOGLE_MAP_ID, GOOGLE_MAPS_KEY, type SceneProps, sceneBounds } from './types'

const DASH = [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 4 }, offset: '0', repeat: '14px' }]

export function GoogleScene({ lines, selected, onSelect, allLabels }: SceneProps) {
  const bounds = useMemo(() => sceneBounds(lines), [lines])

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY} language="pt-BR" region="BR">
      <Map
        mapId={GOOGLE_MAP_ID}
        defaultBounds={{ ...bounds, padding: 48 }}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        colorScheme={ColorScheme.FOLLOW_SYSTEM}
        onClick={() => onSelect(null)}
        className="size-full"
      >
        {lines.map((line) => (
          <LinePath key={line.slug} path={line.path} color={line.color} dashed={line.dashed} />
        ))}

        {lines.flatMap((line) =>
          line.stations.map((station, i) => {
            const isSelected = selected?.lineSlug === line.slug && selected.stationId === station.id
            const isEnd = i === 0 || i === line.stations.length - 1
            return (
              <AdvancedMarker
                key={`${line.slug}-${station.id}`}
                position={station}
                anchorLeft="-50%"
                anchorTop="-50%"
                zIndex={isSelected ? 50 : isEnd ? 20 : 10}
                title={station.name}
                onClick={() => onSelect({ lineSlug: line.slug, stationId: station.id })}
              >
                <span className="relative block">
                  <span
                    className={clsx(
                      'block rounded-full border-solid bg-white transition-transform',
                      isSelected ? 'size-6 border-[6px]' : 'size-4 border-4',
                    )}
                    style={{ borderColor: line.color }}
                  />
                  {(isSelected || isEnd || allLabels) && (
                    <span
                      className={clsx(
                        'absolute top-1/2 left-full ml-1.5 -translate-y-1/2 rounded px-1.5 py-0.5 font-display whitespace-nowrap shadow',
                        isSelected
                          ? 'bg-ink text-base font-bold text-bg'
                          : 'bg-white/95 text-sm font-semibold text-[#16181b]',
                      )}
                    >
                      {station.name}
                    </span>
                  )}
                </span>
              </AdvancedMarker>
            )
          }),
        )}

        {lines.flatMap((line) =>
          (line.trains ?? []).map((train) => (
            <AdvancedMarker
              key={train.key}
              position={train}
              anchorLeft="-50%"
              anchorTop="-50%"
              zIndex={30}
              clickable={false}
            >
              <span className="train-dot grid h-6 w-5 place-items-center rounded-md border-2 border-[#16181b] bg-[#ffcc00] text-[#16181b] shadow">
                {train.dir === 0 ? (
                  <ChevronDown className="size-3.5" strokeWidth={3} aria-hidden />
                ) : (
                  <ChevronUp className="size-3.5" strokeWidth={3} aria-hidden />
                )}
              </span>
            </AdvancedMarker>
          )),
        )}

        <FollowSelection lines={lines} selected={selected} />
      </Map>
    </APIProvider>
  )
}

function LinePath({ path, color, dashed }: { path: [number, number][]; color: string; dashed?: boolean }) {
  const points = useMemo(() => path.map(([lat, lng]) => ({ lat, lng })), [path])
  return (
    <>
      <Polyline
        path={points}
        strokeColor="#ffffff"
        strokeWeight={11}
        strokeOpacity={0.95}
        zIndex={1}
        clickable={false}
      />
      {dashed ? (
        <Polyline
          path={points}
          strokeColor={color}
          strokeOpacity={0}
          icons={DASH}
          strokeWeight={6}
          zIndex={2}
          clickable={false}
        />
      ) : (
        <Polyline path={points} strokeColor={color} strokeWeight={6} zIndex={2} clickable={false} />
      )}
    </>
  )
}

/** Brings the selected station into view, and refits when the set of lines changes */
function FollowSelection({ lines, selected }: Pick<SceneProps, 'lines' | 'selected'>) {
  const map = useMap()
  const key = lines.map((l) => l.slug).join()

  useEffect(() => {
    if (!map) return
    map.fitBounds(sceneBounds(lines), 48)
    // only when the lines on screen change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])

  const target = selected
    ? lines.find((l) => l.slug === selected.lineSlug)?.stations.find((s) => s.id === selected.stationId)
    : undefined
  const lat = target?.lat
  const lng = target?.lng

  useEffect(() => {
    if (!map || lat === undefined || lng === undefined) return
    map.panTo({ lat, lng })
    if ((map.getZoom() ?? 0) < 14) map.setZoom(15)
  }, [map, lat, lng])

  return null
}
