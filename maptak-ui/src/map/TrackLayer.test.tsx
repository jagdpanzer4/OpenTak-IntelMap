import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import TrackLayer from './TrackLayer'
import { useMapStore } from '../hooks/useMapStore'
import { DEFAULT_CONFIG } from '../types/maptak.types'
import L from 'leaflet'

beforeEach(() => {
  useMapStore.setState({ euds: {}, tracks: {}, shapes: [], missions: [],
    config: DEFAULT_CONFIG,
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all' })
  vi.clearAllMocks()
})

it('nie tworzy polyline gdy ślad < 2 punkty', () => {
  useMapStore.setState({ tracks: { 'u1': [[52, 21]] } })
  render(<TrackLayer />)
  expect(L.polyline).not.toHaveBeenCalled()
})

it('tworzy N-1 segmentów dla N punktów', () => {
  useMapStore.setState({
    tracks: { 'u1': [[52, 21], [52.1, 21.1], [52.2, 21.2]] },
  })
  render(<TrackLayer />)
  expect(L.polyline).toHaveBeenCalledTimes(2) // 3 pkt → 2 segmenty
})

it('ostatni segment ma najwyższą opacity (≥ 0.9)', () => {
  useMapStore.setState({
    tracks: { 'u1': [[52, 21], [52.1, 21.1], [52.2, 21.2]] },
  })
  render(<TrackLayer />)
  const calls = (L.polyline as ReturnType<typeof vi.fn>).mock.calls
  const lastOpacity = calls[calls.length - 1][1].opacity
  expect(lastOpacity).toBeGreaterThanOrEqual(0.9)
})
