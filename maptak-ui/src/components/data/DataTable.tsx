// maptak-ui/src/components/data/DataTable.tsx
import type { ReactNode } from 'react'
import styles from '../DataManager.module.css'

interface Column {
  key: string
  label: string
  width?: string
}

interface DataTableProps<T extends { uid: string }> {
  columns: Column[]
  rows: T[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
  renderCell: (col: Column, row: T) => ReactNode
  emptyMessage?: string
}

export default function DataTable<T extends { uid: string }>({
  columns,
  rows,
  selected,
  onToggle,
  onToggleAll,
  onDelete,
  renderCell,
  emptyMessage = 'Brak danych',
}: DataTableProps<T>) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.uid))

  return (
    <div className={styles.tableWrap}>
      {rows.length === 0 ? (
        <div className={styles.emptyState}>{emptyMessage}</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  title="Zaznacz wszystkie"
                />
              </th>
              {columns.map((col) => (
                <th key={col.key} style={col.width ? { width: col.width } : {}}>
                  {col.label}
                </th>
              ))}
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.uid}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(row.uid)}
                    onChange={() => onToggle(row.uid)}
                  />
                </td>
                {columns.map((col) => (
                  <td key={col.key}>{renderCell(col, row)}</td>
                ))}
                <td>
                  <button className={styles.deleteBtn} onClick={() => onDelete(row.uid)} title="Usuń">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
