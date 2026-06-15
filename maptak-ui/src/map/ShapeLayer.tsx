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
        L.circleMarker(shape.points[0], { radius: 6, color, fillOpacity: 0.8 })
          .bindPopup(`<b>${shape.name}</b>`)
          .addTo(layerRef.current)
      }
    })
  }, [shapes])

  return null
}
