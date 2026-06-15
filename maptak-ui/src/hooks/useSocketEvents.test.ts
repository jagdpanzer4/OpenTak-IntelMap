import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSocketEvents } from './useSocketEvents'
import { useMapStore } from './useMapStore'
import { socket } from '../socket'

beforeEach(() => {
  useMapStore.setState({
    euds: {}, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all',
  })
  vi.clearAllMocks()
})

it('rejestruje listenery socket.io przy mount', () => {
  renderHook(() => useSocketEvents())
  expect(socket.on).toHaveBeenCalledWith('eud', expect.any(Function))
  expect(socket.on).toHaveBeenCalledWith('point', expect.any(Function))
  expect(socket.on).toHaveBeenCalledWith('rb_line', expect.any(Function))
  expect(socket.on).toHaveBeenCalledWith('marker', expect.any(Function))
  expect(socket.on).toHaveBeenCalledWith('casevac', expect.any(Function))
})

it('odpina listenery przy unmount', () => {
  const { unmount } = renderHook(() => useSocketEvents())
  unmount()
  expect(socket.off).toHaveBeenCalledWith('eud', expect.any(Function))
  expect(socket.off).toHaveBeenCalledWith('point', expect.any(Function))
})
