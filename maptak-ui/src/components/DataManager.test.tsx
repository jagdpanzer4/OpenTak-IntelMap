// maptak-ui/src/components/DataManager.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DataManager from './DataManager'

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [], total: 0 }),
  })
})

it('renderuje sub-zakładki', () => {
  render(<DataManager />)
  expect(screen.getByRole('button', { name: /EUD/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Markery/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Trasy/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Kształty/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /SPI/i })).toBeInTheDocument()
})

it('przełącza się do zakładki Markery', async () => {
  render(<DataManager />)
  fireEvent.click(screen.getByRole('button', { name: /Markery/i }))
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/data/markers')
    )
  })
})

it('przycisk bulk-delete wyłączony gdy brak zaznaczonych', () => {
  render(<DataManager />)
  const btn = screen.getByRole('button', { name: /Usuń zaznaczone/i })
  expect(btn).toBeDisabled()
})

it('wyszukiwarka wywołuje fetch z parametrem q', async () => {
  render(<DataManager />)
  const input = screen.getByPlaceholderText(/Szukaj eud/i)
  fireEvent.change(input, { target: { value: 'alpha' } })
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('q=alpha'))
  })
})

it('filtr statusu widoczny tylko dla zakładki EUD', () => {
  render(<DataManager />)
  expect(screen.getByDisplayValue('Wszystkie')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Markery/i }))
  expect(screen.queryByDisplayValue('Wszystkie')).not.toBeInTheDocument()
})
