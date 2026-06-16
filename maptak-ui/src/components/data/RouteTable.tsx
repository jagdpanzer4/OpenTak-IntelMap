// maptak-ui/src/components/data/RouteTable.tsx
import type { DataCotItem } from '../../types/maptak.types'
import DataTable from './DataTable'

const COLUMNS = [
  { key: 'name', label: 'Nazwa trasy' },
  { key: 'point_count', label: 'Punkty WP', width: '90px' },
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

export default function RouteTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak tras"
      renderCell={(col, row) => {
        if (col.key === 'timestamp') return fmtTime(row.timestamp)
        return String((row as unknown as Record<string, unknown>)[col.key] ?? '—')
      }}
    />
  )
}
