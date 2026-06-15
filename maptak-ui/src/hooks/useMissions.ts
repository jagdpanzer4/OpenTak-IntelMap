import { useEffect } from 'react'
import axios from 'axios'
import { useMapStore } from './useMapStore'
import type { Mission } from '../types/maptak.types'

export function useMissions() {
  const setMissions = useMapStore((s) => s.setMissions)

  useEffect(() => {
    const fetch = () =>
      axios
        .get('/api/missions')
        .then((r) => {
          if (r.status === 200) {
            const data: Mission[] = Array.isArray(r.data) ? r.data : (r.data.missions ?? [])
            setMissions(data)
          }
        })
        .catch((err) => console.error('[MapTAK] missions error:', err))

    fetch()
    const id = setInterval(fetch, 30_000)
    return () => clearInterval(id)
  }, [setMissions])
}
