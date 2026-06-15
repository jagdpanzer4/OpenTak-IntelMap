import { useMapStore } from '../hooks/useMapStore'
import styles from './UnitDetailPanel.module.css'

export default function UnitDetailPanel() {
  const euds        = useMapStore((s) => s.euds)
  const selectedUid = useMapStore((s) => s.selectedUid)
  const followUid   = useMapStore((s) => s.followUid)
  const selectUnit  = useMapStore((s) => s.selectUnit)
  const setFollowUid = useMapStore((s) => s.setFollowUid)

  const eud = selectedUid ? euds[selectedUid] : null
  if (!eud) return null

  const online = eud.last_status === 'Connected'

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={`${styles.dot} ${online ? styles.online : styles.offline}`} />
        {eud.callsign}
        <button className={styles.close} onClick={() => selectUnit(null)}>✕</button>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Pozycja</div>
          <dl className={styles.grid}>
            <dt className={styles.label}>Lat</dt>
            <dd className={styles.value}>{eud.point?.latitude?.toFixed(6) ?? '—'}°</dd>
            <dt className={styles.label}>Lon</dt>
            <dd className={styles.value}>{eud.point?.longitude?.toFixed(6) ?? '—'}°</dd>
            <dt className={styles.label}>Alt</dt>
            <dd className={styles.value}>
              {eud.point?.altitude != null ? `${eud.point.altitude} m` : '—'}
            </dd>
            <dt className={styles.label}>Speed</dt>
            <dd className={styles.value}>
              {eud.point?.speed != null ? `${eud.point.speed.toFixed(1)} km/h` : '—'}
            </dd>
            <dt className={styles.label}>Course</dt>
            <dd className={styles.value}>
              {eud.point?.course != null ? `${eud.point.course}°` : '—'}
            </dd>
          </dl>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Szczegóły</div>
          <dl className={styles.grid}>
            <dt className={styles.label}>Status</dt>
            <dd className={styles.value} style={{ color: online ? '#00ff88' : '#ff4444' }}>
              {eud.last_status}
            </dd>
            <dt className={styles.label}>Typ</dt>
            <dd className={styles.value}>{eud.type ?? '—'}</dd>
            <dt className={styles.label}>Team</dt>
            <dd className={styles.value}>{eud.team ?? '—'}</dd>
            <dt className={styles.label}>Rola</dt>
            <dd className={styles.value}>{eud.role ?? '—'}</dd>
          </dl>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.btn}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('maptak:flyto', { detail: { uid: eud.uid } }),
            )
          }
        >
          Centruj
        </button>
        <button
          className={`${styles.btn} ${followUid === eud.uid ? styles.btnActive : ''}`}
          onClick={() => setFollowUid(followUid === eud.uid ? null : eud.uid)}
        >
          {followUid === eud.uid ? 'Śledź ✓' : 'Śledź'}
        </button>
      </div>
    </aside>
  )
}
