import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../hooks/useMapStore'

export default function ShapeLayer() {
  const map              = useMap()
  const shapes           = useMapStore((s) => s.shapes)
  const tracks           = useMapStore((s) => s.tracks)
  const euds             = useMapStore((s) => s.euds)
  const layerRef         = useRef<L.LayerGroup | null>(null)
  const spiConnectorsRef = useRef(new Map<string, L.Polyline>())

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
      spiConnectorsRef.current.clear()
      layerRef.current?.remove()
    }
  }, [map])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    spiConnectorsRef.current.clear()

    shapes.forEach((shape) => {
      if (shape.type === 'rb_line' && shape.points.length >= 2) {
        L.polyline(shape.points, { color: shape.color ?? '#ffd700', weight: 2 })
          .bindPopup(`<b>${shape.name}</b>${shape.meta ? `<br>${shape.meta}` : ''}`)
          .addTo(layer)

      } else if ((shape.type === 'polygon' || shape.type === 'freehand_polygon') && shape.points.length >= 3) {
        const color = shape.color ?? '#ff4444'
        L.polygon(shape.points, {
          color,
          fillColor: color,
          fillOpacity: shape.type === 'freehand_polygon' ? 0.2 : 0.15,
          weight: 2,
          dashArray: shape.type === 'freehand_polygon' ? '6,3' : '6, 3',
        })
          .bindPopup(`<b>${shape.name}</b>`)
          .addTo(layer)

      } else if ((shape.type === 'waypoint' || shape.type === 'casevac') && shape.points.length >= 1) {
        const color = shape.color ?? (shape.type === 'casevac' ? '#ff4444' : '#ffd700')
        const label = shape.type === 'casevac' ? '🚑' : '📍'
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:#000;border-radius:4px;padding:2px 6px;font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:700;white-space:nowrap;border:1px solid rgba(0,0,0,.4)">${label} ${shape.name}</div>`,
          iconAnchor: [0, 14],
        })
        L.marker(shape.points[0], { icon })
          .bindPopup(`<b>${shape.name}</b>`)
          .addTo(layer)

      } else if (shape.type === 'route' && shape.points.length >= 2) {
        const color = shape.color ?? '#ffd700'
        L.polyline(shape.points, { color, weight: 3 })
          .bindPopup(`<b>${shape.name}</b>${shape.meta ? `<br>${shape.meta}` : ''}`)
          .addTo(layer)

        ;(shape.waypoints ?? []).forEach((waypoint, index) => {
          const icon = L.divIcon({
            className: '',
            html: `<div style="background:${color};color:#000;border-radius:999px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font:700 11px Inter,system-ui,sans-serif;border:1px solid rgba(0,0,0,.45)">${index + 1}</div>`,
            iconAnchor: [9, 9],
          })
          L.marker([waypoint.lat, waypoint.lon], { icon })
            .bindTooltip(waypoint.callsign || `WP${index + 1}`)
            .addTo(layer)
        })

      } else if (shape.type === 'spi' && shape.points.length >= 1) {
        const color = shape.color ?? '#ff4400'
        const senderName = shape.senderUid ? euds[shape.senderUid]?.callsign ?? shape.senderUid : null
        const icon = L.divIcon({
          className: '',
          html: `<svg width="28" height="28" viewBox="-14 -14 28 28" xmlns="http://www.w3.org/2000/svg">
  <line x1="-12" y1="0" x2="-4" y2="0" stroke="${color}" stroke-width="2"/>
  <line x1="4" y1="0" x2="12" y2="0" stroke="${color}" stroke-width="2"/>
  <line x1="0" y1="-12" x2="0" y2="-4" stroke="${color}" stroke-width="2"/>
  <line x1="0" y1="4" x2="0" y2="12" stroke="${color}" stroke-width="2"/>
  <circle cx="0" cy="0" r="4" fill="none" stroke="${color}" stroke-width="2"/>
</svg>`,
          iconAnchor: [14, 14],
        })
        L.marker(shape.points[0], { icon })
          .bindPopup(`<b>${shape.name}</b>${senderName ? `<br>Źródło: ${senderName}` : ''}`)
          .addTo(layer)

        const latestTrack = shape.senderUid ? tracks[shape.senderUid]?.at(-1) : undefined
        if (latestTrack) {
          const connector = L.polyline([shape.points[0], latestTrack], {
            color,
            weight: 2,
            dashArray: '4,4',
          }).addTo(layer)
          spiConnectorsRef.current.set(shape.uid, connector)
        }
      }
    })
  }, [shapes, tracks, euds])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return

    shapes
      .filter((shape) => shape.type === 'spi' && shape.points.length >= 1)
      .forEach((shape) => {
        const existing = spiConnectorsRef.current.get(shape.uid)
        const latestTrack = shape.senderUid ? tracks[shape.senderUid]?.at(-1) : undefined

        if (!latestTrack) {
          existing?.remove()
          spiConnectorsRef.current.delete(shape.uid)
          return
        }

        existing?.remove()
        const connector = L.polyline([shape.points[0], latestTrack], {
          color: shape.color ?? '#ff4400',
          weight: 2,
          dashArray: '4,4',
        }).addTo(layer)
        spiConnectorsRef.current.set(shape.uid, connector)
      })
  }, [tracks, shapes])

  return null
}
