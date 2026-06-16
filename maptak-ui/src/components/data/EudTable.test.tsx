// maptak-ui/src/components/data/EudTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EudTable from './EudTable'
import type { DataEUD } from '../../types/maptak.types'

const rows: DataEUD[] = [
  { uid: 'e1', callsign: 'Alpha-1', team: 'Cyan', team_role: 'Lead', platform: 'ATAK-CIV', last_status: 'Connected', last_event_time: new Date().toISOString() },
  { uid: 'e2', callsign: 'Bravo-2', team: 'Red', team_role: 'Medic', platform: 'iTAK', last_status: 'Disconnected', last_event_time: null },
]

it('renderuje wiersze EUD', () => {
  render(<EudTable rows={rows} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByText('Alpha-1')).toBeInTheDocument()
  expect(screen.getByText('Bravo-2')).toBeInTheDocument()
})

it('wywołuje onDelete po kliknięciu przycisku', () => {
  const onDelete = vi.fn()
  render(<EudTable rows={[rows[0]]} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onDelete={onDelete} />)
  const btns = screen.getAllByRole('button')
  fireEvent.click(btns[0])
  expect(onDelete).toHaveBeenCalledWith('e1')
})

it('checkbox w nagłówku przełącza zaznaczenie wszystkich', () => {
  const onToggleAll = vi.fn()
  render(<EudTable rows={rows} selected={new Set()} onToggle={vi.fn()} onToggleAll={onToggleAll} onDelete={vi.fn()} />)
  const headerCheckbox = screen.getAllByRole('checkbox')[0]
  fireEvent.click(headerCheckbox)
  expect(onToggleAll).toHaveBeenCalled()
})

it('online EUD ma zielony callsign', () => {
  const { container } = render(<EudTable rows={[rows[0]]} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onDelete={vi.fn()} />)
  const cell = container.querySelector('td span')
  expect(cell?.className).toMatch(/online/)
})

it('pokazuje pustą informację gdy brak wierszy', () => {
  render(<EudTable rows={[]} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByText('Brak urządzeń EUD')).toBeInTheDocument()
})
