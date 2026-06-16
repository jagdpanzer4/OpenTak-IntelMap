// maptak-ui/src/components/data/SpiTable.tsx
import type { DataCotItem } from '../../types/maptak.types'
import DataTable from './DataTable'

const COLUMNS = [
  { key: 'name', label: 'Nazwa SPI' },
  { key: 'sender_uid', label: 'Nadawca EUD', width: '180px' },
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

export default function SpiTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak punktów SPI"
      renderCell={(col, row) => {
        if (col.key === 'timestamp') return fmtTime(row.timestamp)
        return String((row as Record<string, unknown>)[col.key] ?? '—')
      }}
    />
  )
}
