import { useMapStore } from './hooks/useMapStore'
import { useSocketEvents } from './hooks/useSocketEvents'
import { useMapState } from './hooks/useMapState'
import { useMissions } from './hooks/useMissions'
import UnitSidebar from './components/UnitSidebar'
import UnitDetailPanel from './components/UnitDetailPanel'
import LiveIndicator from './components/LiveIndicator'
import MapCore from './map/MapCore'
import styles from './App.module.css'

export default function App() {
  useSocketEvents()
  useMapState()
  useMissions()

  const selectedUid = useMapStore((s) => s.selectedUid)

  return (
    <div className={`${styles.layout} ${selectedUid ? styles.layoutWithPanel : ''}`}>
      <UnitSidebar />
      <div className={styles.mapWrapper}>
        <LiveIndicator />
        <MapCore />
      </div>
      {selectedUid && <UnitDetailPanel />}
    </div>
  )
}
