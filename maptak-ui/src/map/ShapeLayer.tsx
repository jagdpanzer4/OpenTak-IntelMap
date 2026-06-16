import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../hooks/useMapStore'

export default function ShapeLayer() {
  const map      = useMap()
  const shapes   = useMapStore((s) => s.shapes)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  useEffect(() => {
    if (!layerRef.current) return
    layerRef.current.clearLayers()

    shapes.forEach((shape) => {
      if (!layerRef.current) return

      if (shape.type === 'rb_line' && shape.points.length >= 2) {
        L.polyline(shape.points, { color: '#ffd700', weight: 2 })
          .bindPopup(`<b>${shape.name}</b>${shape.meta ? `<br>${shape.meta}` : ''}`)
          .addTo(layerRef.current)

      } else if ((shape.type === 'polygon') && shape.points.length >= 3) {
        L.polygon(shape.points, { color: '#ff4444', fillOpacity: 0.15, dashArray: '6, 3' })
          .bindPopup(`<b>${shape.name}</b>`)
          .addTo(layerRef.current)

      } else if ((shape.type === 'waypoint' || shape.type === 'casevac') && shape.points.length >= 1) {
        const color = shape.type === 'casevac' ? '#ff4444' : '#ffd700'
        const label = shape.type === 'casevac' ? '🚑' : '📍'
        const icon = L.divIcon({
          className: '',
          html: `<div style="background:${color};color:#000;border-radius:4px;padding:1px 4px;font-family:Inter,system-ui,sans-serif;font-size:10px;font-weight:700;white-space:nowrap;border:1px solid rgba(0,0,0,.4)">${label} ${shape.name}</div>`,
          iconAnchor: [0, 12],
        })
        L.marker(shape.points[0], { icon })
          .bindPopup(`<b>${shape.name}</b>`)
          .addTo(layerRef.current)
      }
    })
  }, [shapes])

  return null
}
