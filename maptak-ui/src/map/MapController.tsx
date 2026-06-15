import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { useMapStore } from '../hooks/useMapStore'

/** Musi być wewnątrz <MapContainer>. Obsługuje flyTo i follow. */
export default function MapController() {
  const map      = useMap()
  const euds     = useMapStore((s) => s.euds)
  const tracks   = useMapStore((s) => s.tracks)
  const followUid = useMapStore((s) => s.followUid)

  // Centrowanie przez CustomEvent z UnitDetailPanel
  useEffect(() => {
    const handler = (e: CustomEvent<{ uid: string }>) => {
      const lastPt = tracks[e.detail.uid]?.at(-1)
      if (lastPt != null) {
        map.flyTo(lastPt, 14)
      }
    }
    window.addEventListener('maptak:flyto', handler as EventListener)
    return () => window.removeEventListener('maptak:flyto', handler as EventListener)
  }, [map, tracks])

  // Auto-follow wybranej jednostki
  useEffect(() => {
    if (!followUid) return
    const lastPt = tracks[followUid]?.at(-1)
    if (lastPt != null) {
      map.panTo(lastPt)
    }
  }, [map, tracks, followUid])

  return null
}
