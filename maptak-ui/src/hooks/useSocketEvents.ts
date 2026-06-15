import { useEffect } from 'react'
import { socket } from '../socket'
import { useMapStore } from './useMapStore'
import type { EUD } from '../types/maptak.types'

export function useSocketEvents() {
  const upsertEud   = useMapStore((s) => s.upsertEud)
  const appendTrack = useMapStore((s) => s.appendTrack)
  const upsertShape = useMapStore((s) => s.upsertShape)

  useEffect(() => {
    socket.connect()

    const onEud = (eud: EUD) => upsertEud(eud)

    const onPoint = (pt: any) => {
      // Only add GPS-originated points to tracks (how starts with 'm-')
      // Skip human-placed marker points (how = 'h-e', 'h-g-i-g-o', etc.)
      if (!pt?.device_uid || pt?.latitude == null || pt?.longitude == null) return
      if (!pt?.how?.startsWith('m-')) return
      appendTrack(pt.device_uid, [pt.latitude, pt.longitude])
    }

    const onRBLine = (rb: any) => {
      if (!rb?.uid || !rb?.point1 || !rb?.point2) return
      upsertShape({
        uid: rb.uid, name: rb.uid, type: 'rb_line',
        points: [[rb.point1.latitude, rb.point1.longitude],
                 [rb.point2.latitude, rb.point2.longitude]],
        meta: `${rb.bearing ?? ''}° / ${rb.distance ?? ''}m`,
      })
    }

    const onMarker = (m: any) => {
      if (!m?.uid || !m?.point?.latitude) return
      upsertShape({
        uid: m.uid, name: m.callsign ?? m.uid, type: 'waypoint',
        points: [[m.point.latitude, m.point.longitude]], meta: null,
      })
    }

    const onCasevac = (c: any) => {
      if (!c?.uid || !c?.point?.latitude) return
      upsertShape({
        uid: c.uid, name: c.callsign ?? 'CASEVAC', type: 'casevac',
        points: [[c.point.latitude, c.point.longitude]], meta: null,
      })
    }

    socket.on('eud',     onEud)
    socket.on('point',   onPoint)
    socket.on('rb_line', onRBLine)
    socket.on('marker',  onMarker)
    socket.on('casevac', onCasevac)

    return () => {
      socket.off('eud',     onEud)
      socket.off('point',   onPoint)
      socket.off('rb_line', onRBLine)
      socket.off('marker',  onMarker)
      socket.off('casevac', onCasevac)
      socket.disconnect()
    }
  }, [upsertEud, appendTrack, upsertShape])
}
