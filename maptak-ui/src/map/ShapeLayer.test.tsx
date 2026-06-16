import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import ShapeLayer from './ShapeLayer'
import { useMapStore } from '../hooks/useMapStore'
import { DEFAULT_CONFIG } from '../types/maptak.types'
import L from 'leaflet'

beforeEach(() => {
  useMapStore.setState({ euds: {}, tracks: {}, shapes: [], missions: [],
    config: DEFAULT_CONFIG, selectedMissions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all' })
  vi.clearAllMocks()
})

it('renderuje rb_line jako polyline', () => {
  useMapStore.setState({ shapes: [{
    uid: 's1', name: 'RB', type: 'rb_line',
    points: [[52, 21], [52.1, 21.1]], meta: '45° / 500m',
  }]})
  render(<ShapeLayer />)
  expect(L.polyline).toHaveBeenCalledOnce()
})

it('renderuje polygon jako L.polygon', () => {
  useMapStore.setState({ shapes: [{
    uid: 's2', name: 'Zone', type: 'polygon',
    points: [[52, 21], [53, 21], [53, 22]], meta: null,
  }]})
  render(<ShapeLayer />)
  expect(L.polygon).toHaveBeenCalledOnce()
})

it('renderuje waypoint jako L.marker z divIcon', () => {
  useMapStore.setState({ shapes: [{
    uid: 's3', name: 'WP1', type: 'waypoint',
    points: [[52, 21]], meta: null,
  }]})
  render(<ShapeLayer />)
  expect(L.divIcon).toHaveBeenCalled()
  expect(L.marker).toHaveBeenCalledWith([52, 21], expect.objectContaining({ icon: expect.anything() }))
})

it('renderuje freehand_polygon jako zamknięty L.polygon z kolorem CoT', () => {
  useMapStore.setState({ shapes: [{
    uid: 's4', name: 'Freehand', type: 'freehand_polygon',
    points: [[52, 21], [52.1, 21.1], [52.2, 21.2], [52, 21]], meta: null,
    color: '#ff0000',
  }]})
  render(<ShapeLayer />)
  expect(L.polygon).toHaveBeenCalledWith(
    [[52, 21], [52.1, 21.1], [52.2, 21.2], [52, 21]],
    expect.objectContaining({ color: '#ff0000', fillColor: '#ff0000', dashArray: '6,3' }),
  )
})

it('renderuje route jako polyline i waypointy z etykietami', () => {
  useMapStore.setState({ shapes: [{
    uid: 'route-1', name: 'Route', type: 'route',
    points: [[52, 21], [52.1, 21.1]], meta: '2 WP', color: '#00ff00',
    waypoints: [
      { callsign: 'Start', lat: 52, lon: 21 },
      { callsign: 'WP1', lat: 52.1, lon: 21.1 },
    ],
  }]})
  render(<ShapeLayer />)
  expect(L.polyline).toHaveBeenCalledWith(
    [[52, 21], [52.1, 21.1]],
    expect.objectContaining({ color: '#00ff00', weight: 3 }),
  )
  expect(L.marker).toHaveBeenCalledTimes(2)
})

it('renderuje spi jako marker i łącznik do pozycji EUD', () => {
  useMapStore.setState({
    tracks: { alpha: [[52.3, 21.3]] },
    shapes: [{
      uid: 'spi-1', name: 'SPI', type: 'spi',
      points: [[52.2, 21.2]], meta: null, color: '#ff4400', senderUid: 'alpha',
    }],
  })
  render(<ShapeLayer />)
  expect(L.marker).toHaveBeenCalledWith([52.2, 21.2], expect.objectContaining({ icon: expect.anything() }))
  expect(L.polyline).toHaveBeenCalledWith(
    [[52.2, 21.2], [52.3, 21.3]],
    expect.objectContaining({ color: '#ff4400', dashArray: '4,4' }),
  )
})
