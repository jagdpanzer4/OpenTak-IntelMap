import { useEffect } from 'react'
import axios from 'axios'
import { useMapStore } from './useMapStore'
import type { Mission } from '../types/maptak.types'

export function useMissions() {
  const setMissions = useMapStore((s) => s.setMissions)

  useEffect(() => {
    const fetchMissions = () =>
      axios
        .get('/api/missions?per_page=100')
        .then((r) => {
          if (r.status === 200) {
            // API returns paginated: { results: [...], total_pages: ..., total: ... }
            const data: Mission[] = Array.isArray(r.data)
              ? r.data
              : (r.data.results ?? r.data.missions ?? [])
            setMissions(data)
          }
        })
        .catch((err) => console.error('[MapTAK] missions error:', err))

    fetchMissions()
    const id = setInterval(fetchMissions, 30_000)
    return () => clearInterval(id)
  }, [setMissions])
}
