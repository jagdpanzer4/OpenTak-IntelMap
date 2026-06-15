import { useEffect } from 'react'
import axios from 'axios'
import { useMapStore } from './useMapStore'

export function useMapState() {
  const hydrate = useMapStore((s) => s.hydrate)

  useEffect(() => {
    axios
      .get('/api/map_state')
      .then((r) => { if (r.status === 200) hydrate(r.data) })
      .catch((err) => console.error('[MapTAK] map_state error:', err))
  }, [hydrate])
}
