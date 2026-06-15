import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import EudLayer from './EudLayer'
import { useMapStore } from '../hooks/useMapStore'
import { DEFAULT_CONFIG } from '../types/maptak.types'
import L from 'leaflet'

beforeEach(() => {
  useMapStore.setState({
    euds: {}, tracks: {}, shapes: [], missions: [],
    config: DEFAULT_CONFIG,
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all',
  })
  vi.clearAllMocks()
})

it('nie renderuje markerów gdy brak EUD', () => {
  render(<EudLayer />)
  expect(L.marker).not.toHaveBeenCalled()
})

it('tworzy marker dla EUD z pozycją w tracks', () => {
  const eud = {
    uid: 'e-1', callsign: 'BRAVO', last_status: 'Connected' as const,
    last_event_time: '2026-06-15T20:00:00',
    device: 'ATAK', os: '35', platform: 'ATAK-CIV',
    version: null, team: null, team_color: null, team_role: null, username: null,
  }
  useMapStore.setState({
    euds: { 'e-1': eud },
    tracks: { 'e-1': [[52.2, 21.0]] },
  })
  render(<EudLayer />)
  expect(L.marker).toHaveBeenCalledWith([52.2, 21.0], expect.any(Object))
})

it('pomija EUD bez pozycji w tracks', () => {
  const eud = {
    uid: 'e-2', callsign: 'NO-POS', last_status: 'Connected' as const,
    last_event_time: null,
    device: 'ATAK', os: '35', platform: 'ATAK-CIV',
    version: null, team: null, team_color: null, team_role: null, username: null,
  }
  useMapStore.setState({ euds: { 'e-2': eud }, tracks: {} })
  render(<EudLayer />)
  expect(L.marker).not.toHaveBeenCalled()
})
