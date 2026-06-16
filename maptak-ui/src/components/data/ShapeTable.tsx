// maptak-ui/src/components/data/ShapeTable.tsx
import type { DataCotItem } from '../../types/maptak.types'
import DataTable from './DataTable'
import styles from '../DataManager.module.css'

const COLUMNS = [
  { key: 'name', label: 'Nazwa kształtu' },
  { key: 'color', label: 'Kolor', width: '80px' },
  { key: 'point_count', label: 'Wierzchołki', width: '100px' },
  { key: 'sender_uid', label: 'Nadawca', width: '180px' },
  { key: 'timestamp', label: 'Czas', width: '130px' },
]

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  rows: DataCotItem[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
}

export default function ShapeTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak kształtów"
      renderCell={(col, row) => {
        if (col.key === 'color') {
          return row.color ? (
            <><span className={styles.colorDot} style={{ background: row.color }} />{row.color}</>
          ) : '—'
        }
        if (col.key === 'timestamp') return fmtTime(row.timestamp)
        return String((row as Record<string, unknown>)[col.key] ?? '—')
      }}
    />
  )
}
