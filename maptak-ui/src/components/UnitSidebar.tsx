import { useMemo } from 'react'
import { useMapStore } from '../hooks/useMapStore'
import type { EUD, FilterType, Mission, Shape } from '../types/maptak.types'
import styles from './UnitSidebar.module.css'

export default function UnitSidebar() {
  const euds             = useMapStore((s) => s.euds)
  const shapes           = useMapStore((s) => s.shapes)
  const missions         = useMapStore((s) => s.missions)
  const filterQuery      = useMapStore((s) => s.filterQuery)
  const filterType       = useMapStore((s) => s.filterType)
  const selectedUid      = useMapStore((s) => s.selectedUid)
  const selectedMissions = useMapStore((s) => s.selectedMissions)
  const selectUnit       = useMapStore((s) => s.selectUnit)
  const setFilterQuery   = useMapStore((s) => s.setFilterQuery)
  const setFilterType    = useMapStore((s) => s.setFilterType)
  const toggleMission    = useMapStore((s) => s.toggleMission)
  const config           = useMapStore((s) => s.config)

  const eudList = useMemo(() => {
    return Object.values(euds)
      .filter((e) => {
        if (config.MAPTAK_ONLY_ATAK_EUDS && (!e.device || !e.os || !e.platform)) return false
        if (!config.MAPTAK_SHOW_OFFLINE_EUDS && e.last_status !== 'Connected') return false
        if (filterQuery && !e.callsign.toLowerCase().includes(filterQuery.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        if (a.last_status !== b.last_status) return a.last_status === 'Connected' ? -1 : 1
        return (b.last_event_time ?? '').localeCompare(a.last_event_time ?? '')
      })
  }, [euds, filterQuery, config])

  const onlineCount  = Object.values(euds).filter((e) => e.last_status === 'Connected').length

  const FILTER_LABELS: Record<FilterType, string> = {
    all: 'Wszystko', eud: 'EUD', mission: 'Misje', shape: `Kształty (${shapes.length})`,
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
          missions.map((m) => (
            <MissionRow
              key={m.name}
              mission={m}
              checked={selectedMissions.includes(m.name)}
              onToggle={() => toggleMission(m.name)}
            />
          ))}
        {(filterType === 'all' || filterType === 'shape') &&
          shapes.map((s) => <ShapeRow key={s.uid} shape={s} />)}
      </ul>

      <div className={styles.footer}>
        <span className={styles.online}>● {onlineCount}</span> online
        {' '}
        <span className={styles.mission}>● {missions.length}</span> misje
        {' '}
        <span className={styles.shapeCount}>◆ {shapes.length}</span> kształty
        {selectedMissions.length > 0 && (
          <span
            className={styles.missionFilter}
            title="Filtrujesz wg misji — kliknij, aby wyczyścić"
            onClick={() => selectedMissions.forEach((n) => toggleMission(n))}
          >
            {' '}🔍 {selectedMissions.length}
          </span>
        )}
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
        <div className={styles.meta}>{eud.team_role ?? '—'}</div>
      </div>
    </li>
  )
}

function MissionRow({ mission, checked, onToggle }: {
  mission: Mission; checked: boolean; onToggle: () => void
}) {
  return (
    <li className={`${styles.missionRow} ${checked ? styles.missionActive : ''}`} onClick={onToggle}>
      <input
        type="checkbox"
        className={styles.missionCheck}
        checked={checked}
        onChange={onToggle}
        onClick={(e) => e.stopPropagation()}
      />
      <span className={styles.missionIcon}>📋</span>
      <div>
        <div className={styles.missionName}>{mission.name}</div>
        <div className={styles.meta}>{mission.uids.length} EUD</div>
      </div>
    </li>
  )
}

const SHAPE_ICONS: Record<string, string> = {
  waypoint: '📍', casevac: '🚑', rb_line: '📏', polygon: '⬡',
}

function ShapeRow({ shape }: { shape: Shape }) {
  const icon = SHAPE_ICONS[shape.type] ?? '◆'
  const typeLabel = shape.type === 'rb_line' ? 'RB Line'
    : shape.type === 'casevac' ? 'CASEVAC'
    : shape.type === 'waypoint' ? 'Marker'
    : shape.type === 'polygon' ? 'Obszar'
    : shape.type
  return (
    <li className={styles.shapeRow}>
      <span className={styles.shapeIcon}>{icon}</span>
      <div>
        <div className={styles.callsign}>{shape.name}</div>
        <div className={styles.meta}>{typeLabel}{shape.meta ? ` · ${shape.meta}` : ''}</div>
      </div>
    </li>
  )
}
