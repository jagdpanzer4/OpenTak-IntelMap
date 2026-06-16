import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import axios from 'axios'
import { useMapState } from './useMapState'
import { useMapStore } from './useMapStore'
import { DEFAULT_CONFIG } from '../types/maptak.types'

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}))

const mockedAxios = vi.mocked(axios, true)

beforeEach(() => {
  useMapStore.setState({
    euds: {}, tracks: {}, shapes: [], missions: [],
    config: DEFAULT_CONFIG,
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all', selectedMissions: [],
  })
  vi.clearAllMocks()
})

describe('useMapState', () => {
  it('ładuje last_positions przed seedem /api/point i dodaje tracki', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === '/api/plugins/ots_maptak/config') return Promise.resolve({ status: 200, data: DEFAULT_CONFIG })
      if (url === '/api/map_state') return Promise.resolve({ status: 200, data: { euds: [], rb_lines: [] } })
      if (url === '/api/markers?per_page=500') return Promise.resolve({ status: 200, data: [] })
      if (url === '/api/casevac?per_page=200') return Promise.resolve({ status: 200, data: [] })
      if (url === '/api/plugins/ots_maptak/last_positions') return Promise.resolve({ status: 200, data: { alpha: [52.2, 21.2] } })
      if (url === '/api/point?per_page=500&sort_by=timestamp&sort_direction=desc') {
        return Promise.resolve({ status: 200, data: [{ device_uid: 'alpha', latitude: 52.3, longitude: 21.3, how: 'm-g' }] })
      }
      if (url === '/api/plugins/ots_maptak/drawn_shapes') return Promise.resolve({ status: 200, data: [] })
      return Promise.reject(new Error(`unexpected URL: ${url}`))
    })

    renderHook(() => useMapState())

    await waitFor(() => {
      expect(useMapStore.getState().tracks.alpha).toEqual([[52.2, 21.2], [52.3, 21.3]])
    })

    const urls = mockedAxios.get.mock.calls.map(([url]) => url)
    expect(urls.indexOf('/api/plugins/ots_maptak/last_positions'))
      .toBeLessThan(urls.indexOf('/api/point?per_page=500&sort_by=timestamp&sort_direction=desc'))
  })

  it('ładuje drawn_shapes i zapisuje route oraz spi do store', async () => {
    mockedAxios.get.mockImplementation((url: string) => {
      if (url === '/api/plugins/ots_maptak/config') return Promise.resolve({ status: 200, data: DEFAULT_CONFIG })
      if (url === '/api/map_state') return Promise.resolve({ status: 200, data: { euds: [], rb_lines: [] } })
      if (url === '/api/markers?per_page=500') return Promise.resolve({ status: 200, data: [] })
      if (url === '/api/casevac?per_page=200') return Promise.resolve({ status: 200, data: [] })
      if (url === '/api/plugins/ots_maptak/last_positions') return Promise.resolve({ status: 200, data: {} })
      if (url === '/api/point?per_page=500&sort_by=timestamp&sort_direction=desc') return Promise.resolve({ status: 200, data: [] })
      if (url === '/api/plugins/ots_maptak/drawn_shapes') {
        return Promise.resolve({
          status: 200,
          data: [
            { uid: 'route-1', name: 'Route', type: 'route', points: [[52, 21], [52.1, 21.1]], meta: '2 WP', color: '#00ff00', waypoints: [{ callsign: 'WP1', lat: 52.1, lon: 21.1 }] },
            { uid: 'spi-1', name: 'SPI', type: 'spi', points: [[52.2, 21.2]], color: '#ff4400', senderUid: 'alpha' },
          ],
        })
      }
      return Promise.reject(new Error(`unexpected URL: ${url}`))
    })

    renderHook(() => useMapState())

    await waitFor(() => {
      expect(useMapStore.getState().shapes).toEqual(expect.arrayContaining([
        expect.objectContaining({ uid: 'route-1', type: 'route', color: '#00ff00' }),
        expect.objectContaining({ uid: 'spi-1', type: 'spi', senderUid: 'alpha' }),
      ]))
    })
  })
})
