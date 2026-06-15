import { useEffect } from 'react'
import axios from 'axios'
import { useMapStore } from './useMapStore'

export function useMapState() {
  const hydrate      = useMapStore((s) => s.hydrate)
  const appendTrack  = useMapStore((s) => s.appendTrack)
  const setConfig    = useMapStore((s) => s.setConfig)

  useEffect(() => {
    // Load plugin config from /api/plugins/ots_maptak/config
    axios
      .get('/api/plugins/ots_maptak/config')
      .then((r) => { if (r.status === 200) setConfig(r.data) })
      .catch(() => { /* use defaults */ })

    // Load EUDs and shapes from map_state
    axios
      .get('/api/map_state')
      .then((r) => { if (r.status === 200) hydrate(r.data) })
      .catch((err) => console.error('[MapTAK] map_state error:', err))

    // Seed initial track positions from recent GPS points
    // Only machine-generated points (how starts with 'm-'), newest 500
    axios
      .get('/api/point?per_page=500&sort_by=timestamp&sort_direction=desc')
      .then((r) => {
        if (r.status !== 200) return
        const points: any[] = r.data.results ?? r.data ?? []
        // Points come newest-first; collect per EUD then append oldest-first
        const byEud: Record<string, any[]> = {}
        points.forEach((pt) => {
          if (!pt?.device_uid || pt?.latitude == null || !pt?.how?.startsWith('m-')) return
          byEud[pt.device_uid] ??= []
          byEud[pt.device_uid].push(pt)
        })
        Object.entries(byEud).forEach(([uid, pts]) => {
          // pts are newest-first; reverse to append oldest-first
          pts.reverse().forEach((pt) => {
            appendTrack(uid, [pt.latitude, pt.longitude])
          })
        })
      })
      .catch((err) => console.error('[MapTAK] points seed error:', err))
  }, [hydrate, appendTrack, setConfig])
}
