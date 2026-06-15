import { useEffect, useState } from 'react'
import { socket } from '../socket'

export default function LiveIndicator() {
  const [connected, setConnected] = useState(socket.connected)

  useEffect(() => {
    const onConnect    = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    socket.on('connect',    onConnect)
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('connect',    onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  return (
    <div style={{
      position: 'absolute', top: 10, left: 10, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', borderRadius: 12,
      padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, pointerEvents: 'none',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: connected ? '#00ff88' : '#ff4444',
        display: 'inline-block',
      }} />
      <span style={{ color: connected ? '#00ff88' : '#ff4444', fontWeight: 600 }}>
        {connected ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  )
}
