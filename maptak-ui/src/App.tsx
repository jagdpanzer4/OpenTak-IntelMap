import { useState } from 'react'
import { useMapStore } from './hooks/useMapStore'
import { useSocketEvents } from './hooks/useSocketEvents'
import { useMapState } from './hooks/useMapState'
import { useMissions } from './hooks/useMissions'
import UnitSidebar from './components/UnitSidebar'
import UnitDetailPanel from './components/UnitDetailPanel'
import LiveIndicator from './components/LiveIndicator'
import MapCore from './map/MapCore'
import DataManager from './components/DataManager'
import styles from './App.module.css'

export default function App() {
  useSocketEvents()
  useMapState()
  useMissions()

  const selectedUid = useMapStore((s) => s.selectedUid)
  const [view, setView] = useState<'map' | 'data'>('map')

  return (
    <div className={styles.appShell}>
      <nav className={styles.topNav}>
        <span className={styles.topNavBrand}>MapTAK</span>
        <button
          className={`${styles.navBtn} ${view === 'map' ? styles.navBtnActive : ''}`}
          onClick={() => setView('map')}
        >
          Mapa
        </button>
        <button
          className={`${styles.navBtn} ${view === 'data' ? styles.navBtnActive : ''}`}
          onClick={() => setView('data')}
        >
          Dane
        </button>
      </nav>
      <div className={styles.viewArea}>
        {view === 'map' ? (
          <div className={`${styles.layout} ${selectedUid ? styles.layoutWithPanel : ''}`} style={{flex:1}}>
            <UnitSidebar />
            <div className={styles.mapWrapper}>
              <LiveIndicator />
              <MapCore />
            </div>
            {selectedUid && <UnitDetailPanel />}
          </div>
        ) : (
          <DataManager />
        )}
      </div>
    </div>
  )
}
