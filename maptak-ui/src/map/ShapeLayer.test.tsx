import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import ShapeLayer from './ShapeLayer'
import { useMapStore } from '../hooks/useMapStore'
import L from 'leaflet'

beforeEach(() => {
  useMapStore.setState({ euds: {}, tracks: {}, shapes: [], missions: [],
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

it('renderuje waypoint jako circleMarker', () => {
  useMapStore.setState({ shapes: [{
    uid: 's3', name: 'WP1', type: 'waypoint',
    points: [[52, 21]], meta: null,
  }]})
  render(<ShapeLayer />)
  expect(L.circleMarker).toHaveBeenCalledOnce()
})
