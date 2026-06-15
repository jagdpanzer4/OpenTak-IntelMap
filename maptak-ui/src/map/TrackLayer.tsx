import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../hooks/useMapStore'

export default function TrackLayer() {
  const map      = useMap()
  const tracks   = useMapStore((s) => s.tracks)
  const config   = useMapStore((s) => s.config)
  const segsRef  = useRef<Record<string, L.Polyline[]>>({})
  const ptCountRef = useRef<Record<string, number>>({})
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  useEffect(() => {
    if (!layerRef.current) return

    const currentUids = new Set(Object.keys(tracks))

    for (const uid of Object.keys(segsRef.current)) {
      if (!currentUids.has(uid)) {
        segsRef.current[uid].forEach((p) => p.remove())
        delete segsRef.current[uid]
        delete ptCountRef.current[uid]
      }
    }

    for (const [uid, pts] of Object.entries(tracks)) {
      if (ptCountRef.current[uid] === pts.length) continue

      segsRef.current[uid]?.forEach((p) => p.remove())

      if (pts.length < 2) {
        segsRef.current[uid] = []
        ptCountRef.current[uid] = pts.length
        continue
      }

      const segments: L.Polyline[] = []
      for (let i = 1; i < pts.length; i++) {
        const opacity = 0.15 + (i / (pts.length - 1)) * 0.85
        const seg = L.polyline([pts[i - 1], pts[i]], {
          color: config.MAPTAK_TRACK_COLOR,
          weight: 2,
          opacity,
        }).addTo(layerRef.current!)
        segments.push(seg)
      }
      segsRef.current[uid] = segments
      ptCountRef.current[uid] = pts.length
    }
  }, [tracks, config.MAPTAK_TRACK_COLOR])

  return null
}
