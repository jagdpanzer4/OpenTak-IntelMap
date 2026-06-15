import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import EudLayer from './EudLayer'
import { useMapStore } from '../hooks/useMapStore'
import L from 'leaflet'

beforeEach(() => {
  useMapStore.setState({
    euds: {}, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all',
  })
  vi.clearAllMocks()
})

it('nie renderuje markerów gdy brak EUD', () => {
  render(<EudLayer />)
  expect(L.marker).not.toHaveBeenCalled()
})

it('tworzy marker dla EUD z pozycją', () => {
  const eud = {
    uid: 'e-1', callsign: 'BRAVO', last_status: 'Connected' as const,
    last_event_time: '2026-06-15T20:00:00', mil_std_2525c: null,
    team: null, role: null, type: null, icon: null,
    point: { latitude: 52.2, longitude: 21.0, altitude: null,
             speed: null, course: null, azimuth: null, fov: null, timestamp: null },
  }
  useMapStore.setState({ euds: { 'e-1': eud } })
  render(<EudLayer />)
  expect(L.marker).toHaveBeenCalledWith([52.2, 21.0], expect.any(Object))
})

it('pomija EUD bez pozycji', () => {
  const eud = {
    uid: 'e-2', callsign: 'NO-POS', last_status: 'Connected' as const,
    last_event_time: null, mil_std_2525c: null,
    team: null, role: null, type: null, icon: null, point: null,
  }
  useMapStore.setState({ euds: { 'e-2': eud } })
  render(<EudLayer />)
  expect(L.marker).not.toHaveBeenCalled()
})
