import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UnitDetailPanel from './UnitDetailPanel'
import { useMapStore } from '../hooks/useMapStore'

const eud = {
  uid: 'x1', callsign: 'XRAY', last_status: 'Connected' as const,
  last_event_time: null, mil_std_2525c: null,
  team: 'Cyan', role: 'TL', type: 'SFGP', icon: null,
  point: { latitude: 52.2297, longitude: 21.0122, altitude: 112,
           speed: 34, course: 47, azimuth: null, fov: null, timestamp: null },
}

beforeEach(() => {
  useMapStore.setState({
    euds: { x1: eud }, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all',
  })
})

it('nie renderuje gdy brak selectedUid', () => {
  const { container } = render(<UnitDetailPanel />)
  expect(container.firstChild).toBeNull()
})

it('wyświetla dane EUD gdy selectedUid ustawiony', () => {
  useMapStore.setState({ selectedUid: 'x1' })
  render(<UnitDetailPanel />)
  expect(screen.getByText('XRAY')).toBeInTheDocument()
  expect(screen.getByText('52.229700°')).toBeInTheDocument()
  expect(screen.getByText('Cyan')).toBeInTheDocument()
})

it('przycisk Zamknij czyści selectedUid', () => {
  useMapStore.setState({ selectedUid: 'x1' })
  render(<UnitDetailPanel />)
  fireEvent.click(screen.getByText('✕'))
  expect(useMapStore.getState().selectedUid).toBeNull()
})

it('przycisk Śledź ustawia followUid', () => {
  useMapStore.setState({ selectedUid: 'x1' })
  render(<UnitDetailPanel />)
  fireEvent.click(screen.getByText('Śledź'))
  expect(useMapStore.getState().followUid).toBe('x1')
})

it('drugi klik Śledź wyłącza śledzenie', () => {
  useMapStore.setState({ selectedUid: 'x1', followUid: 'x1' })
  render(<UnitDetailPanel />)
  fireEvent.click(screen.getByText(/Śledź/))
  expect(useMapStore.getState().followUid).toBeNull()
})
