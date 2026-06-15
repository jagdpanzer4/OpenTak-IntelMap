import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('leaflet', () => {
  const layerGroup = vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
    remove: vi.fn(),
  }))
  const marker = vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    bindTooltip: vi.fn().mockReturnThis(),
    setIcon: vi.fn(),
    slideTo: vi.fn(),
    setRotationAngle: vi.fn(),
  }))
  return {
    default: {
      layerGroup,
      marker,
      divIcon: vi.fn(() => ({})),
      icon: vi.fn(() => ({})),
      polyline: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
      polygon: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis() })),
      circleMarker: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis() })),
      Point: vi.fn((x: number, y: number) => ({ x, y })),
    },
  }
})

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => children,
  TileLayer: () => null,
  WMSTileLayer: () => null,
  LayersControl: Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    {
      BaseLayer: ({ children }: { children: React.ReactNode }) => children,
      Overlay: ({ children }: { children: React.ReactNode }) => children,
    },
  ),
  ScaleControl: () => null,
  useMap: vi.fn(() => ({
    flyTo: vi.fn(),
    panTo: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  })),
}))

vi.mock('milsymbol', () => ({
  default: {
    Symbol: vi.fn(() => ({
      asSVG: vi.fn(() => '<svg></svg>'),
      getAnchor: vi.fn(() => ({ x: 12, y: 12 })),
    })),
  },
}))

vi.mock('leaflet-rotatedmarker', () => ({}))
vi.mock('leaflet.marker.slideto', () => ({}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('../socket', () => ({
  socket: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
  },
}))
