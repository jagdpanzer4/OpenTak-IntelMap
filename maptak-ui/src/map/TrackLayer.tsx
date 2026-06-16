import { useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../hooks/useMapStore'

export default function TrackLayer() {
  const map              = useMap()
  const tracks           = useMapStore((s) => s.tracks)
  const euds             = useMapStore((s) => s.euds)
  const config           = useMapStore((s) => s.config)
  const missions         = useMapStore((s) => s.missions)
  const selectedMissions = useMapStore((s) => s.selectedMissions)
  const segsRef          = useRef<Record<string, L.Polyline[]>>({})
  const ptCountRef       = useRef<Record<string, number>>({})
  const layerRef         = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  // Compute set of UIDs that should be rendered (same logic as EudLayer)
  const visibleUids = useMemo(() => {
    const activeMissionEuds: Set<string> | null = selectedMissions.length > 0
      ? new Set(
          missions
            .filter((m) => selectedMissions.includes(m.name))
            .flatMap((m) => m.uids.map((u) => u.data)),
        )
      : null

    return new Set(
      Object.values(euds)
        .filter((eud) => {
          if (config.MAPTAK_ONLY_ATAK_EUDS && (!eud.device || !eud.os || !eud.platform)) return false
          if (!config.MAPTAK_SHOW_OFFLINE_EUDS && eud.last_status !== 'Connected') return false
          if (activeMissionEuds && !activeMissionEuds.has(eud.uid)) return false
          return true
        })
        .map((eud) => eud.uid),
    )
  }, [euds, config, selectedMissions, missions])

  useEffect(() => {
    if (!layerRef.current) return

    // Remove tracks for UIDs that are no longer visible
    for (const uid of Object.keys(segsRef.current)) {
      if (!visibleUids.has(uid)) {
        segsRef.current[uid].forEach((p) => p.remove())
        delete segsRef.current[uid]
        delete ptCountRef.current[uid]
      }
    }

    // Draw/update tracks for visible UIDs
    for (const uid of visibleUids) {
      const pts = tracks[uid]
      if (!pts || pts.length < 2) {
        // If previously drawn, clear it
        if (segsRef.current[uid]) {
          segsRef.current[uid].forEach((p) => p.remove())
          segsRef.current[uid] = []
          ptCountRef.current[uid] = pts?.length ?? 0
        }
        continue
      }

      if (ptCountRef.current[uid] === pts.length) continue

      segsRef.current[uid]?.forEach((p) => p.remove())

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
  }, [tracks, visibleUids, config.MAPTAK_TRACK_COLOR])

  return null
}
