import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-rotatedmarker'
import 'leaflet.marker.slideto'
import * as milsymbolLib from 'milsymbol'
import { useMapStore } from '../hooks/useMapStore'
import type { EUD } from '../types/maptak.types'

const milsymbol = (milsymbolLib as any).default ?? milsymbolLib

export default function EudLayer() {
  const map       = useMap()
  const euds      = useMapStore((s) => s.euds)
  const selectUnit = useMapStore((s) => s.selectUnit)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const layerRef   = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  useEffect(() => {
    if (!layerRef.current) return

    Object.values(euds).forEach((eud) => {
      if (!eud.point?.latitude || !eud.point?.longitude) return

      const latlng: L.LatLngExpression = [eud.point.latitude, eud.point.longitude]
      const icon = buildIcon(eud)

      if (markersRef.current[eud.uid]) {
        const m = markersRef.current[eud.uid]
        ;(m as any).slideTo?.(latlng, { duration: 2000, keepAtCenter: false })
        m.setIcon(icon)
        if (eud.point.course != null) {
          ;(m as any).setRotationAngle?.(eud.point.course)
        }
      } else {
        const m = L.marker(latlng, { icon })
        if (eud.point.course != null) {
          ;(m.options as any).rotationAngle = eud.point.course
        }
        m.on('click', () => selectUnit(eud.uid))
        m.bindTooltip(eud.callsign, { permanent: false, direction: 'top' })
        m.addTo(layerRef.current!)
        markersRef.current[eud.uid] = m
      }
    })
  }, [euds, selectUnit])

  return null
}

function buildIcon(eud: EUD): L.DivIcon | L.Icon {
  if (eud.mil_std_2525c) {
    const opts: { size: number; direction?: number } = { size: 25 }
    if (eud.point?.course != null) opts.direction = eud.point.course
    try {
      const sym = new milsymbol.Symbol(eud.mil_std_2525c, opts)
      return L.divIcon({
        className: '',
        html: sym.asSVG(),
        iconAnchor: new L.Point(sym.getAnchor().x, sym.getAnchor().y),
      })
    } catch { /* fallback */ }
  }

  if (eud.icon?.bitmap) {
    return L.icon({
      iconUrl: eud.icon.bitmap,
      shadowUrl: eud.icon.shadow,
      iconAnchor: [12, 24],
    })
  }

  const online = eud.last_status === 'Connected'
  const label  = (eud.callsign ?? '?').slice(0, 2).toUpperCase()
  const color  = online ? '#00ff88' : '#555'
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:4px;background:#1a2744;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;font-size:9px;font-weight:700;color:${color}">${label}</div>`,
    iconAnchor: [12, 12],
  })
}
