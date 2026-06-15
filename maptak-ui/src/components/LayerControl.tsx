import { LayersControl, TileLayer, WMSTileLayer } from 'react-leaflet'

const SAVED_LAYER_KEY = 'maptak:baseLayer'

const BASE_LAYERS = [
  { name: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  { name: 'Google Streets',
    url: 'http://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attribution: '' },
  { name: 'Google Hybrid',
    url: 'http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga', attribution: '' },
  { name: 'Google Terrain',
    url: 'http://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', attribution: '' },
  { name: 'ESRI Imagery',
    url: 'http://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '' },
  { name: 'ESRI Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '' },
]

const savedLayer = (() => {
  try { return localStorage.getItem(SAVED_LAYER_KEY) ?? 'OSM' } catch { return 'OSM' }
})()

export default function LayerControl() {
  return (
    <LayersControl position="topright">
      {BASE_LAYERS.map((layer) => (
        <LayersControl.BaseLayer
          key={layer.name}
          name={layer.name}
          checked={layer.name === savedLayer}
        >
          <TileLayer
            attribution={layer.attribution}
            url={layer.url}
            maxZoom={20}
            eventHandlers={{ add: () => {
              try { localStorage.setItem(SAVED_LAYER_KEY, layer.name) } catch { /* */ }
            }}}
          />
        </LayersControl.BaseLayer>
      ))}
      <LayersControl.Overlay name="Pogoda (NEXRAD)">
        <WMSTileLayer
          url="http://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi"
          params={{ layers: 'nexrad-n0r-900913', format: 'image/png', transparent: true }}
          attribution="Weather © IEM"
          pane="overlayPane"
        />
      </LayersControl.Overlay>
      <LayersControl.Overlay name="Google Roads Overlay">
        <TileLayer
          url="http://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}"
          pane="overlayPane"
        />
      </LayersControl.Overlay>
    </LayersControl>
  )
}
