// maptak-ui/src/components/data/MarkerTable.tsx
import type { DataMarker } from '../../types/maptak.types'
import DataTable from './DataTable'

const COLUMNS = [
  { key: 'callsign', label: 'Nazwa' },
  { key: 'type', label: 'Typ CoT', width: '130px' },
  { key: 'coords', label: 'Koordynaty', width: '160px' },
  { key: 'timestamp', label: 'Czas', width: '130px' },
]

function fmtCoords(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return '—'
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  rows: DataMarker[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
}

export default function MarkerTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak markerów"
      renderCell={(col, row) => {
        if (col.key === 'coords') return fmtCoords(row.latitude, row.longitude)
        if (col.key === 'timestamp') return fmtTime(row.timestamp)
        return (row as Record<string, unknown>)[col.key] as string || '—'
      }}
    />
  )
}
