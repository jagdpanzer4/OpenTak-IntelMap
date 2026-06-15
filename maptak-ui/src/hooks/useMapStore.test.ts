import { describe, it, expect, beforeEach } from 'vitest'
import { useMapStore } from './useMapStore'
import { DEFAULT_CONFIG } from '../types/maptak.types'

const baseEud = {
  uid: 'test-1', callsign: 'ALPHA', last_status: 'Connected' as const,
  last_event_time: null, device: 'ATAK', os: '35', platform: 'ATAK-CIV',
  version: null, team: null, team_color: null, team_role: null, username: null,
}

// Reset store przed każdym testem
beforeEach(() => {
  useMapStore.setState({
    euds: {}, tracks: {}, shapes: [], missions: [],
    config: DEFAULT_CONFIG,
    selectedUid: null, followUid: null,
    filterQuery: '', filterType: 'all',
  })
})

describe('upsertEud', () => {
  it('dodaje nową jednostkę', () => {
    useMapStore.getState().upsertEud(baseEud)
    expect(useMapStore.getState().euds['test-1']).toEqual(baseEud)
  })

  it('nadpisuje istniejącą jednostkę', () => {
    useMapStore.getState().upsertEud(baseEud)
    useMapStore.getState().upsertEud({ ...baseEud, callsign: 'ALPHA-UPDATED' })
    expect(useMapStore.getState().euds['test-1'].callsign).toBe('ALPHA-UPDATED')
  })
})

describe('appendTrack', () => {
  it('dodaje punkt do śladu', () => {
    useMapStore.getState().appendTrack('uid-1', [52.23, 21.01])
    expect(useMapStore.getState().tracks['uid-1']).toEqual([[52.23, 21.01]])
  })

  it('ogranicza ślad do 50 punktów (FIFO)', () => {
    for (let i = 0; i < 55; i++) {
      useMapStore.getState().appendTrack('uid-1', [i, i])
    }
    const track = useMapStore.getState().tracks['uid-1']
    expect(track).toHaveLength(50)
    expect(track[0]).toEqual([5, 5])   // pierwsze 5 wypadło
    expect(track[49]).toEqual([54, 54]) // ostatni dodany
  })
})

describe('upsertShape', () => {
  it('dodaje nowy kształt', () => {
    const shape = { uid: 'shape-1', name: 'Strefa', type: 'polygon' as const,
      points: [[52, 21], [53, 21], [53, 22]] as [number,number][], meta: null }
    useMapStore.getState().upsertShape(shape)
    expect(useMapStore.getState().shapes).toHaveLength(1)
  })

  it('aktualizuje istniejący kształt', () => {
    const shape = { uid: 'shape-1', name: 'Strefa', type: 'polygon' as const,
      points: [[52, 21]] as [number,number][], meta: null }
    useMapStore.getState().upsertShape(shape)
    useMapStore.getState().upsertShape({ ...shape, name: 'Strefa-Updated' })
    expect(useMapStore.getState().shapes).toHaveLength(1)
    expect(useMapStore.getState().shapes[0].name).toBe('Strefa-Updated')
  })
})

describe('selectUnit', () => {
  it('ustawia selectedUid', () => {
    useMapStore.getState().selectUnit('uid-42')
    expect(useMapStore.getState().selectedUid).toBe('uid-42')
  })

  it('czyści selectedUid gdy null', () => {
    useMapStore.getState().selectUnit('uid-42')
    useMapStore.getState().selectUnit(null)
    expect(useMapStore.getState().selectedUid).toBeNull()
  })
})

describe('hydrate', () => {
  it('ładuje EUD z /api/map_state (bez pozycji — pozycje z /api/point)', () => {
    const eud = { uid: 'h-1', callsign: 'HOTEL', last_status: 'Connected' as const,
      last_event_time: null, device: 'ATAK', os: '35', platform: 'ATAK-CIV',
      version: null, team: null, team_color: null, team_role: null, username: null }
    useMapStore.getState().hydrate({ euds: [eud], markers: [], rb_lines: [], casevacs: [] })
    expect(useMapStore.getState().euds['h-1'].callsign).toBe('HOTEL')
    // tracks not seeded by hydrate — come from /api/point
    expect(useMapStore.getState().tracks['h-1']).toBeUndefined()
  })
})
