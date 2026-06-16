// maptak-ui/src/components/data/EudTable.tsx
import type { DataEUD } from '../../types/maptak.types'
import DataTable from './DataTable'
import styles from '../DataManager.module.css'

const COLUMNS = [
  { key: 'callsign', label: 'Callsign' },
  { key: 'team', label: 'Team', width: '90px' },
  { key: 'team_role', label: 'Rola', width: '100px' },
  { key: 'platform', label: 'Platforma', width: '100px' },
  { key: 'last_event_time', label: 'Ostatni ping', width: '130px' },
  { key: 'last_status', label: 'Status', width: '80px' },
]

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'teraz'
  if (mins < 60) return `${mins} min temu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} godz. temu`
  return d.toLocaleDateString('pl-PL')
}

interface Props {
  rows: DataEUD[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
}

export default function EudTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak urządzeń EUD"
      renderCell={(col, row) => {
        if (col.key === 'callsign') {
          return (
            <span className={row.last_status === 'Connected' ? styles.online : styles.offline}>
              {row.callsign || '—'}
            </span>
          )
        }
        if (col.key === 'last_status') {
          return (
            <span className={row.last_status === 'Connected' ? styles.online : styles.offline}>
              {row.last_status === 'Connected' ? '● online' : '● offline'}
            </span>
          )
        }
        if (col.key === 'last_event_time') return formatTime(row.last_event_time)
        return (row as Record<string, unknown>)[col.key] as string || '—'
      }}
    />
  )
}
