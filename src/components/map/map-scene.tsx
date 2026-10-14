'use client'

import clsx from 'clsx'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

import { SchematicScene } from './schematic-scene'
import { GOOGLE_MAPS_KEY, type SceneProps } from './types'

const GoogleScene = dynamic(() => import('./google-scene').then((m) => m.GoogleScene), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-surface" />,
})

export const hasGoogleMaps = GOOGLE_MAPS_KEY !== ''

declare global {
  interface Window {
    gm_authFailure?: () => void
  }
}

let authFailed = false

export function MapScene(props: SceneProps) {
  const [failed, setFailed] = useState(authFailed)

  // Google calls this global when the key is rejected (wrong key, domain not allowed...)
  useEffect(() => {
    if (!hasGoogleMaps) return
    window.gm_authFailure = () => {
      authFailed = true
      setFailed(true)
    }
  }, [])

  if (!hasGoogleMaps) return <SchematicScene {...props} natural />
  // The Google map stays mounted with the same tree even after a failure:
  // unmounting it while its script is still setting up throws inside the library
  return (
    <div className="relative size-full">
      <div className={clsx('absolute inset-0', failed && 'invisible')} aria-hidden={failed || undefined}>
        <GoogleScene {...props} />
      </div>
      {failed && (
        <div className="absolute inset-0 bg-surface">
          <SchematicScene {...props} />
        </div>
      )}
    </div>
  )
}
