import { MapContainer, ScaleControl } from 'react-leaflet'
import LayerControl from '../components/LayerControl'
import EudLayer from './EudLayer'
import TrackLayer from './TrackLayer'
import ShapeLayer from './ShapeLayer'
import MapController from './MapController'
import { useMapStore } from '../hooks/useMapStore'

export default function MapCore() {
  const config = useMapStore((s) => s.config)

  return (
    <MapContainer
      center={[config.MAPTAK_DEFAULT_LAT, config.MAPTAK_DEFAULT_LON]}
      zoom={config.MAPTAK_DEFAULT_ZOOM}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <LayerControl />
      <EudLayer />
      <TrackLayer />
      <ShapeLayer />
      <MapController />
      <ScaleControl position="bottomright" />
    </MapContainer>
  )
}
