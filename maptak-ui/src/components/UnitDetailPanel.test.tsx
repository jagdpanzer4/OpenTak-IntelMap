import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UnitDetailPanel from './UnitDetailPanel'
import { useMapStore } from '../hooks/useMapStore'
import { DEFAULT_CONFIG } from '../types/maptak.types'

const eud = {
  uid: 'x1', callsign: 'XRAY', last_status: 'Connected' as const,
  last_event_time: null,
  device: 'ATAK', os: '35', platform: 'SFGP',
  version: null, team: 'Cyan', team_color: 'Cyan', team_role: 'TL', username: 'john',
}

beforeEach(() => {
  useMapStore.setState({
    euds: { x1: eud },
    tracks: { x1: [[52.2297, 21.0122]] },
    shapes: [], missions: [],
    config: DEFAULT_CONFIG,
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
