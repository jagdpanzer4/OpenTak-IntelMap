import { MapContainer, ScaleControl } from 'react-leaflet'
import LayerControl from '../components/LayerControl'
import EudLayer from './EudLayer'
import TrackLayer from './TrackLayer'
import ShapeLayer from './ShapeLayer'
import MapController from './MapController'

export default function MapCore() {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={3}
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
