import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../hooks/useMapStore'

export default function TrackLayer() {
  const map      = useMap()
  const tracks   = useMapStore((s) => s.tracks)
  const segsRef  = useRef<Record<string, L.Polyline[]>>({})
  // Track point counts per UID to detect changes
  const ptCountRef = useRef<Record<string, number>>({})
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  useEffect(() => {
    if (!layerRef.current) return

    const currentUids = new Set(Object.keys(tracks))

    // Remove polylines for evicted UIDs
    for (const uid of Object.keys(segsRef.current)) {
      if (!currentUids.has(uid)) {
        segsRef.current[uid].forEach((p) => p.remove())
        delete segsRef.current[uid]
        delete ptCountRef.current[uid]
      }
    }

    // Only redraw tracks whose point count changed
    for (const [uid, pts] of Object.entries(tracks)) {
      if (ptCountRef.current[uid] === pts.length) continue

      // Remove old segments for this UID
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
          color: '#00ff88',
          weight: 2,
          opacity,
        }).addTo(layerRef.current!)
        segments.push(seg)
      }
      segsRef.current[uid] = segments
      ptCountRef.current[uid] = pts.length
    }
  }, [tracks])

  return null
}
