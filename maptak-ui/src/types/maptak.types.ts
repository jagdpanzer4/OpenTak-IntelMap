export interface EUDPoint {
  latitude: number
  longitude: number
  altitude: number | null
  speed: number | null
  course: number | null
  azimuth: number | null
  fov: number | null
  timestamp: string | null
}

export interface EUD {
  uid: string
  callsign: string
  device: string | null
  os: string | null
  platform: string | null
  version: string | null
  last_status: 'Connected' | 'Disconnected'
  last_event_time: string | null
  team: string | null
  team_color: string | null
  team_role: string | null
  username: string | null
}

export type ShapeType = 'rb_line' | 'polygon' | 'waypoint' | 'casevac'
  | 'freehand_polygon' | 'route' | 'spi'

export interface RouteWaypoint {
  callsign: string
  lat: number
  lon: number
}

export interface Shape {
  uid: string
  name: string
  type: ShapeType
  /** [lat, lng] pairs — Leaflet LatLngTuple format */
  points: [number, number][]
  meta: string | null
  color?: string
  senderUid?: string
  waypoints?: RouteWaypoint[]
}

export interface MissionUID {
  /** The CoT/EUD uid that belongs to this mission */
  data: string
  creatorUid: string
  details?: {
    type?: string
    callsign?: string
    iconsetPath?: string
    color?: string
  }
}

export interface Mission {
  name: string
  guid: string
  uids: MissionUID[]
}

export type FilterType = 'all' | 'eud' | 'mission' | 'shape'

export interface PluginConfig {
  MAPTAK_DEFAULT_LAT: number
  MAPTAK_DEFAULT_LON: number
  MAPTAK_DEFAULT_ZOOM: number
  MAPTAK_MAX_TRACK_POINTS: number
  MAPTAK_TRACK_COLOR: string
  MAPTAK_SHOW_OFFLINE_EUDS: boolean
  MAPTAK_ONLY_ATAK_EUDS: boolean
}

export const DEFAULT_CONFIG: PluginConfig = {
  MAPTAK_DEFAULT_LAT: 52.2297,
  MAPTAK_DEFAULT_LON: 21.0122,
  MAPTAK_DEFAULT_ZOOM: 6,
  MAPTAK_MAX_TRACK_POINTS: 50,
  MAPTAK_TRACK_COLOR: '#00ff88',
  MAPTAK_SHOW_OFFLINE_EUDS: true,
  MAPTAK_ONLY_ATAK_EUDS: true,
}

export interface MapStore {
  euds: Record<string, EUD>
  /** max MAPTAK_MAX_TRACK_POINTS per uid, FIFO */
  tracks: Record<string, [number, number][]>
  shapes: Shape[]
  missions: Mission[]
  config: PluginConfig

  selectedUid: string | null
  followUid: string | null
  filterQuery: string
  filterType: FilterType

  selectedMissions: string[]  // mission names used as active filters (empty = show all)

  upsertEud: (eud: EUD) => void
  appendTrack: (uid: string, point: [number, number]) => void
  upsertShape: (shape: Shape) => void
  setMissions: (missions: Mission[]) => void
  setConfig: (cfg: Partial<PluginConfig>) => void
  selectUnit: (uid: string | null) => void
  setFollowUid: (uid: string | null) => void
  setFilterQuery: (q: string) => void
  setFilterType: (t: FilterType) => void
  toggleMission: (name: string) => void
  hydrate: (data: {
    euds: EUD[]
    markers: unknown[]
    rb_lines: unknown[]
    casevacs: unknown[]
  }) => void
}
