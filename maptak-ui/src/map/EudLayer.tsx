import { useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-rotatedmarker'
import 'leaflet.marker.slideto'
import { useMapStore } from '../hooks/useMapStore'
import type { EUD } from '../types/maptak.types'

export default function EudLayer() {
  const map              = useMap()
  const euds             = useMapStore((s) => s.euds)
  const tracks           = useMapStore((s) => s.tracks)
  const config           = useMapStore((s) => s.config)
  const missions         = useMapStore((s) => s.missions)
  const selectedMissions = useMapStore((s) => s.selectedMissions)
  const selectUnit       = useMapStore((s) => s.selectUnit)
  const markersRef       = useRef<Record<string, L.Marker>>({})
  const layerRef         = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  // Compute the set of EUD UIDs from selected missions (null = no filter)
  const activeMissionEuds = useMemo<Set<string> | null>(() => {
    if (selectedMissions.length === 0) return null
    return new Set(
      missions
        .filter((m) => selectedMissions.includes(m.name))
        .flatMap((m) => m.uids.map((u) => u.data)),
    )
  }, [selectedMissions, missions])

  useEffect(() => {
    if (!layerRef.current) return

    const shouldShow = (eud: EUD) => {
      if (config.MAPTAK_ONLY_ATAK_EUDS && (!eud.device || !eud.os || !eud.platform)) return false
      if (!config.MAPTAK_SHOW_OFFLINE_EUDS && eud.last_status !== 'Connected') return false
      if (activeMissionEuds && !activeMissionEuds.has(eud.uid)) return false
      return !!tracks[eud.uid]?.at(-1)
    }

    Object.values(euds).forEach((eud) => {
      if (!shouldShow(eud)) return

      const lastPt = tracks[eud.uid]!.at(-1)!
      const latlng: L.LatLngExpression = [lastPt[0], lastPt[1]]
      const icon = buildIcon(eud)

      if (markersRef.current[eud.uid]) {
        const m = markersRef.current[eud.uid]
        ;(m as any).slideTo?.(latlng, { duration: 2000, keepAtCenter: false })
        m.setIcon(icon)
      } else {
        const m = L.marker(latlng, { icon })
        m.on('click', () => selectUnit(eud.uid))
        m.bindTooltip(eud.callsign, { permanent: false, direction: 'top' })
        m.addTo(layerRef.current!)
        markersRef.current[eud.uid] = m
      }
    })

    // Remove markers for EUDs that no longer pass filters
    Object.keys(markersRef.current).forEach((uid) => {
      const eud = euds[uid]
      if (!eud || !shouldShow(eud)) {
        markersRef.current[uid].remove()
        delete markersRef.current[uid]
      }
    })
  }, [euds, tracks, config, selectUnit, activeMissionEuds])

  return null
}

function buildIcon(eud: EUD): L.DivIcon {
  const online = eud.last_status === 'Connected'
  const label  = (eud.callsign ?? '?').slice(0, 2).toUpperCase()
  const color  = online ? '#00ff88' : '#555'
  const teamColor = eud.team_color ? teamColorToHex(eud.team_color) : color
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:4px;background:#1a2744;border:2px solid ${teamColor};display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;font-size:9px;font-weight:700;color:${teamColor}">${label}</div>`,
    iconAnchor: [14, 14],
  })
}

function teamColorToHex(teamColor: string): string {
  const map: Record<string, string> = {
    Cyan: '#00ffff', Blue: '#0000ff', Green: '#00ff00', Yellow: '#ffff00',
    Orange: '#ff8800', Red: '#ff0000', Maroon: '#800000', Purple: '#800080',
    Dark_Blue: '#00008b', Teal: '#008080', Pink: '#ff69b4', White: '#ffffff',
  }
  return map[teamColor] ?? '#00ff88'
}
