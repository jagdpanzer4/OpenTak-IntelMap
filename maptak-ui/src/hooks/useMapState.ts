import { useEffect } from 'react'
import axios from 'axios'
import { useMapStore } from './useMapStore'

export function useMapState() {
  const hydrate      = useMapStore((s) => s.hydrate)
  const upsertShape  = useMapStore((s) => s.upsertShape)
  const appendTrack  = useMapStore((s) => s.appendTrack)
  const setConfig    = useMapStore((s) => s.setConfig)

  useEffect(() => {
    // 1. Load plugin config — fire event so MapController can setView
    axios
      .get('/api/plugins/ots_maptak/config')
      .then((r) => {
        if (r.status === 200) {
          setConfig(r.data)
          window.dispatchEvent(new CustomEvent('maptak:configLoaded', {
            detail: {
              lat:  r.data.MAPTAK_DEFAULT_LAT,
              lon:  r.data.MAPTAK_DEFAULT_LON,
              zoom: r.data.MAPTAK_DEFAULT_ZOOM,
            },
          }))
        }
      })
      .catch(() => { /* use defaults */ })

    // 2. Load EUDs from map_state (includes rb_lines with stale filter)
    axios
      .get('/api/map_state')
      .then((r) => {
        if (r.status === 200) {
          // Pass empty markers/casevacs — we load them separately without stale filter
          hydrate({ euds: r.data.euds ?? [], markers: [], rb_lines: r.data.rb_lines ?? [], casevacs: [] })
          console.debug('[MapTAK] map_state euds:', r.data.euds?.length, 'rb_lines:', r.data.rb_lines?.length)
        }
      })
      .catch((err) => console.error('[MapTAK] map_state error:', err))

    // 3. Load ALL markers (no stale filter — /api/markers returns everything)
    axios
      .get('/api/markers?per_page=500')
      .then((r) => {
        if (r.status !== 200) return
        const items: any[] = r.data.results ?? r.data ?? []
        console.debug('[MapTAK] markers loaded:', items.length)
        items.forEach((m) => {
          if (!m?.uid || !m?.point?.latitude) return
          upsertShape({
            uid: m.uid,
            name: m.callsign ?? m.uid,
            type: 'waypoint',
            points: [[m.point.latitude, m.point.longitude]],
            meta: m.mil_std_2525c ?? null,
          })
        })
      })
      .catch((err) => console.error('[MapTAK] markers error:', err))

    // 4. Load ALL casevacs (no stale filter)
    axios
      .get('/api/casevac?per_page=200')
      .then((r) => {
        if (r.status !== 200) return
        const items: any[] = r.data.results ?? r.data ?? []
        console.debug('[MapTAK] casevacs loaded:', items.length)
        items.forEach((c) => {
          if (!c?.uid || !c?.point?.latitude) return
          upsertShape({
            uid: c.uid,
            name: c.sender_uid ?? 'CASEVAC',
            type: 'casevac',
            points: [[c.point.latitude, c.point.longitude]],
            meta: null,
          })
        })
      })
      .catch((err) => console.error('[MapTAK] casevac error:', err))

    // 5. Seed initial track positions from recent GPS points
    axios
      .get('/api/plugins/ots_maptak/last_positions')
      .then((r) => {
        if (r.status !== 200) return
        const positions: Record<string, [number, number]> = r.data ?? {}
        console.debug('[MapTAK] last_positions loaded for', Object.keys(positions).length, 'EUDs')
        Object.entries(positions).forEach(([uid, [lat, lon]]) => {
          appendTrack(uid, [lat, lon])
        })
      })
      .catch((err) => console.error('[MapTAK] last_positions error:', err))

    // 6. Seed initial track positions from recent GPS points
    axios
      .get('/api/point?per_page=500&sort_by=timestamp&sort_direction=desc')
      .then((r) => {
        if (r.status !== 200) return
        const points: any[] = r.data.results ?? r.data ?? []
        const byEud: Record<string, any[]> = {}
        points.forEach((pt) => {
          if (!pt?.device_uid || pt?.latitude == null || !pt?.how?.startsWith('m-')) return
          byEud[pt.device_uid] ??= []
          byEud[pt.device_uid].push(pt)
        })
        Object.entries(byEud).forEach(([uid, pts]) => {
          pts.reverse().forEach((pt) => {
            appendTrack(uid, [pt.latitude, pt.longitude])
          })
        })
        console.debug('[MapTAK] seeded tracks for', Object.keys(byEud).length, 'EUDs')
      })
      .catch((err) => console.error('[MapTAK] points seed error:', err))

    // 7. Load drawn shapes from raw CoT XML
    axios
      .get('/api/plugins/ots_maptak/drawn_shapes')
      .then((r) => {
        if (r.status !== 200) return
        const items: any[] = Array.isArray(r.data) ? r.data : []
        console.debug('[MapTAK] drawn_shapes loaded:', items.length)
        items.forEach((s) => {
          if (!s?.uid || !s?.points?.length) return
          upsertShape({
            uid: s.uid,
            name: s.name ?? s.uid,
            type: s.type,
            points: s.points,
            meta: s.meta ?? null,
            color: s.color,
            senderUid: s.senderUid,
            waypoints: s.waypoints,
          })
        })
      })
      .catch((err) => console.error('[MapTAK] drawn_shapes error:', err))
  }, [hydrate, upsertShape, appendTrack, setConfig])
}
