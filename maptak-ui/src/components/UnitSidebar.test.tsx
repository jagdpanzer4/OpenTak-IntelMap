import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UnitSidebar from './UnitSidebar'
import { useMapStore } from '../hooks/useMapStore'

const eudOnline = {
  uid: 'a1', callsign: 'ALPHA', last_status: 'Connected' as const,
  last_event_time: '2026-06-15T20:00:00', mil_std_2525c: null,
  team: null, role: null, type: null, icon: null,
  point: { latitude: 52, longitude: 21, altitude: null,
           speed: null, course: null, azimuth: null, fov: null, timestamp: null },
}

const eudOffline = {
  uid: 'b2', callsign: 'BRAVO', last_status: 'Disconnected' as const,
  last_event_time: '2026-06-15T19:00:00', mil_std_2525c: null,
  team: null, role: null, type: null, icon: null, point: null,
}

beforeEach(() => {
  useMapStore.setState({
    euds: { a1: eudOnline, b2: eudOffline }, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all',
  })
})

it('wyświetla callsigny EUD', () => {
  render(<UnitSidebar />)
  expect(screen.getByText('ALPHA')).toBeInTheDocument()
  expect(screen.getByText('BRAVO')).toBeInTheDocument()
})

it('online przed offline w liście', () => {
  render(<UnitSidebar />)
  const items = screen.getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('ALPHA')
  expect(items[1]).toHaveTextContent('BRAVO')
})

it('filtruje po callsign', () => {
  render(<UnitSidebar />)
  const input = screen.getByPlaceholderText(/szukaj/i)
  fireEvent.change(input, { target: { value: 'alp' } })
  expect(screen.getByText('ALPHA')).toBeInTheDocument()
  expect(screen.queryByText('BRAVO')).not.toBeInTheDocument()
})

it('klik na EUD ustawia selectedUid w store', () => {
  render(<UnitSidebar />)
  fireEvent.click(screen.getByText('ALPHA'))
  expect(useMapStore.getState().selectedUid).toBe('a1')
})

it('wyświetla licznik online/offline', () => {
  render(<UnitSidebar />)
  expect(screen.getByText(/1/)).toBeInTheDocument() // online
})
