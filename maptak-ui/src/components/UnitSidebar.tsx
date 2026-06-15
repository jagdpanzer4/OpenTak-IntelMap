import { useMemo } from 'react'
import { useMapStore } from '../hooks/useMapStore'
import type { EUD, FilterType, Mission } from '../types/maptak.types'
import styles from './UnitSidebar.module.css'

export default function UnitSidebar() {
  const euds         = useMapStore((s) => s.euds)
  const missions     = useMapStore((s) => s.missions)
  const filterQuery  = useMapStore((s) => s.filterQuery)
  const filterType   = useMapStore((s) => s.filterType)
  const selectedUid  = useMapStore((s) => s.selectedUid)
  const selectUnit   = useMapStore((s) => s.selectUnit)
  const setFilterQuery = useMapStore((s) => s.setFilterQuery)
  const setFilterType  = useMapStore((s) => s.setFilterType)

  const eudList = useMemo(() => {
    return Object.values(euds)
      .filter((e) =>
        !filterQuery ||
        e.callsign.toLowerCase().includes(filterQuery.toLowerCase()),
      )
      .sort((a, b) => {
        if (a.last_status !== b.last_status) {
          return a.last_status === 'Connected' ? -1 : 1
        }
        return (b.last_event_time ?? '').localeCompare(a.last_event_time ?? '')
      })
  }, [euds, filterQuery])

  const onlineCount  = Object.values(euds).filter((e) => e.last_status === 'Connected').length
  const offlineCount = Object.values(euds).length - onlineCount

  const FILTER_LABELS: Record<FilterType, string> = {
    all: 'Wszystko', eud: 'EUD', mission: 'Misje', shape: 'Kształty',
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>JEDNOSTKI / MISJE</div>

      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Szukaj callsign..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
        <div className={styles.toggles}>
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((t) => (
            <button
              key={t}
              className={`${styles.toggle} ${filterType === t ? styles.active : ''}`}
              onClick={() => setFilterType(t)}
            >
              {FILTER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <ul className={styles.list}>
        {(filterType === 'all' || filterType === 'eud') &&
          eudList.map((eud) => (
            <EudRow
              key={eud.uid}
              eud={eud}
              selected={selectedUid === eud.uid}
              onSelect={() => selectUnit(eud.uid)}
            />
          ))}
        {(filterType === 'all' || filterType === 'mission') &&
          missions.map((m) => <MissionRow key={m.uid} mission={m} />)}
      </ul>

      <div className={styles.footer}>
        <span className={styles.online}>● {onlineCount}</span> online
        {' '}
        <span className={styles.mission}>● {missions.length}</span> misje
      </div>
    </aside>
  )
}

function EudRow({ eud, selected, onSelect }: {
  eud: EUD; selected: boolean; onSelect: () => void
}) {
  const online = eud.last_status === 'Connected'
  return (
    <li className={`${styles.eudRow} ${selected ? styles.selected : ''}`} onClick={onSelect}>
      <span className={`${styles.dot} ${online ? styles.dotOnline : styles.dotOffline}`} />
      <div>
        <div className={styles.callsign}>{eud.callsign}</div>
        <div className={styles.meta}>{eud.type ?? '—'}</div>
      </div>
    </li>
  )
}

function MissionRow({ mission }: { mission: Mission }) {
  return (
    <li className={styles.missionRow}>
      <span className={styles.missionIcon}>📋</span>
      <span className={styles.missionName}>{mission.name}</span>
    </li>
  )
}
