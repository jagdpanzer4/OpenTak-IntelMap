import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../hooks/useMapStore'

export default function TrackLayer() {
  const map      = useMap()
  const tracks   = useMapStore((s) => s.tracks)
  const segsRef  = useRef<Record<string, L.Polyline[]>>({})
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  useEffect(() => {
    if (!layerRef.current) return

    // Usuń poprzednie segmenty
    Object.values(segsRef.current).flat().forEach((p) => p.remove())
    segsRef.current = {}

    Object.entries(tracks).forEach(([uid, pts]) => {
      if (pts.length < 2) return
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
    })
  }, [tracks])

  return null
}
