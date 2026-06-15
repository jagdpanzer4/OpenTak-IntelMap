import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { useMapStore } from '../hooks/useMapStore'

/** Musi być wewnątrz <MapContainer>. Obsługuje flyTo i follow. */
export default function MapController() {
  const map      = useMap()
  const euds     = useMapStore((s) => s.euds)
  const followUid = useMapStore((s) => s.followUid)

  // Centrowanie przez CustomEvent z UnitDetailPanel
  useEffect(() => {
    const handler = (e: CustomEvent<{ uid: string }>) => {
      const eud = euds[e.detail.uid]
      if (eud?.point?.latitude != null && eud?.point?.longitude != null) {
        map.flyTo([eud.point.latitude, eud.point.longitude], 14)
      }
    }
    window.addEventListener('maptak:flyto', handler as EventListener)
    return () => window.removeEventListener('maptak:flyto', handler as EventListener)
  }, [map, euds])

  // Auto-follow wybranej jednostki
  useEffect(() => {
    if (!followUid) return
    const eud = euds[followUid]
    if (eud?.point?.latitude != null && eud?.point?.longitude != null) {
      map.panTo([eud.point.latitude, eud.point.longitude])
    }
  }, [map, euds, followUid])

  return null
}
