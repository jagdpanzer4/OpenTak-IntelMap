import { useState, useEffect, useCallback } from 'react'
import type { DataEUD, DataMarker, DataCotItem, DataTab } from '../types/maptak.types'
import { DATA_TAB_LABELS, DATA_TAB_COT_TYPE } from '../types/maptak.types'
import EudTable from './data/EudTable'
import MarkerTable from './data/MarkerTable'
import RouteTable from './data/RouteTable'
import ShapeTable from './data/ShapeTable'
import SpiTable from './data/SpiTable'
import styles from './DataManager.module.css'

const API = '/api/plugins/ots_maptak'

type Counts = Record<DataTab, number>

export default function DataManager() {
  const [activeTab, setActiveTab] = useState<DataTab>('euds')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [euds, setEuds] = useState<DataEUD[]>([])
  const [markers, setMarkers] = useState<DataMarker[]>([])
  const [routes, setRoutes] = useState<DataCotItem[]>([])
  const [shapes, setShapes] = useState<DataCotItem[]>([])
  const [spis, setSpis] = useState<DataCotItem[]>([])
  const [counts, setCounts] = useState<Counts>({ euds: 0, markers: 0, routes: 0, shapes: 0, spis: 0 })

  const fetchTab = useCallback(async (tab: DataTab, q: string, sf: string) => {
    try {
      const cotType = DATA_TAB_COT_TYPE[tab]
      let url = ''
      if (tab === 'euds') url = `${API}/data/euds?q=${encodeURIComponent(q)}&status=${sf}`
      else if (tab === 'markers') url = `${API}/data/markers?q=${encodeURIComponent(q)}`
      else if (cotType) url = `${API}/data/cot?type=${cotType}&q=${encodeURIComponent(q)}`
      else return

      const r = await fetch(url)
      if (!r.ok) return
      const data = await r.json()
      const results = data.results ?? []

      if (tab === 'euds') { setEuds(results); setCounts((c) => ({ ...c, euds: data.total ?? results.length })) }
      else if (tab === 'markers') { setMarkers(results); setCounts((c) => ({ ...c, markers: data.total ?? results.length })) }
      else if (tab === 'routes') { setRoutes(results); setCounts((c) => ({ ...c, routes: data.total ?? results.length })) }
      else if (tab === 'shapes') { setShapes(results); setCounts((c) => ({ ...c, shapes: data.total ?? results.length })) }
      else if (tab === 'spis') { setSpis(results); setCounts((c) => ({ ...c, spis: data.total ?? results.length })) }
    } catch {
      // network error — silent fail
    }
  }, [])

  useEffect(() => {
    setSelected(new Set())
    fetchTab(activeTab, query, statusFilter)
  }, [activeTab, query, statusFilter, fetchTab])

  const handleDelete = useCallback(async (uid: string) => {
    if (!confirm(`Usunąć ${uid}?`)) return
    const cotType = DATA_TAB_COT_TYPE[activeTab]
    let url = ''
    if (activeTab === 'euds') url = `${API}/data/euds/${uid}`
    else if (activeTab === 'markers') url = `${API}/data/markers/${uid}`
    else if (cotType) url = `${API}/data/cot/${uid}`
    else return
    try {
      const r = await fetch(url, { method: 'DELETE' })
      if (!r.ok) throw new Error(`${r.status}`)
    } catch (e) {
      alert(`Usuwanie nie powiodło się: ${e instanceof Error ? e.message : 'błąd sieci'}`)
      return
    }
    fetchTab(activeTab, query, statusFilter)
  }, [activeTab, query, statusFilter, fetchTab])

  const handleBulkDelete = useCallback(async () => {
    const uids = [...selected]
    if (uids.length === 0) return
    if (!confirm(`Usunąć ${uids.length} elementów?`)) return
    const cotType = DATA_TAB_COT_TYPE[activeTab]
    let url = ''
    if (activeTab === 'euds') url = `${API}/data/euds`
    else if (activeTab === 'markers') url = `${API}/data/markers`
    else if (cotType) url = `${API}/data/cot`
    else return
    try {
      const r = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uids }) })
      if (!r.ok) throw new Error(`${r.status}`)
    } catch (e) {
      alert(`Usuwanie nie powiodło się: ${e instanceof Error ? e.message : 'błąd sieci'}`)
      return
    }
    setSelected(new Set())
    fetchTab(activeTab, query, statusFilter)
  }, [activeTab, selected, query, statusFilter, fetchTab])

  const toggleSelect = (uid: string) => setSelected((s) => { const n = new Set(s); n.has(uid) ? n.delete(uid) : n.add(uid); return n })

  const toggleAll = () => {
    const rows = getRows()
    const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.uid))
    setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.uid)))
  }

  const getRows = (): Array<{ uid: string }> => {
    if (activeTab === 'euds') return euds
    if (activeTab === 'markers') return markers
    if (activeTab === 'routes') return routes
    if (activeTab === 'shapes') return shapes
    return spis
  }

  const tableProps = { selected, onToggle: toggleSelect, onToggleAll: toggleAll, onDelete: handleDelete }
  const TABS: DataTab[] = ['euds', 'markers', 'routes', 'shapes', 'spis']

  return (
    <div className={styles.root}>
      {/* Sub-tab navigation */}
      <div className={styles.subNav}>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`${styles.subTab} ${activeTab === tab ? styles.subTabActive : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {DATA_TAB_LABELS[tab]}
            <span className={styles.badge}>{counts[tab]}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder={`🔍 Szukaj ${DATA_TAB_LABELS[activeTab].toLowerCase()}...`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {activeTab === 'euds' && (
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'online' | 'offline')}
          >
            <option value="all">Wszystkie</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        )}
        <button
          className={styles.deleteBulkBtn}
          disabled={selected.size === 0}
          onClick={handleBulkDelete}
        >
          🗑 Usuń zaznaczone ({selected.size})
        </button>
      </div>

      <div className={styles.totalCount}>
        {getRows().length} wyników
      </div>

      {/* Active table */}
      {activeTab === 'euds' && <EudTable rows={euds} {...tableProps} />}
      {activeTab === 'markers' && <MarkerTable rows={markers} {...tableProps} />}
      {activeTab === 'routes' && <RouteTable rows={routes} {...tableProps} />}
      {activeTab === 'shapes' && <ShapeTable rows={shapes} {...tableProps} />}
      {activeTab === 'spis' && <SpiTable rows={spis} {...tableProps} />}
    </div>
  )
}
