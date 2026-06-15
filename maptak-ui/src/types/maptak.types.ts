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
  last_status: 'Connected' | 'Disconnected'
  last_event_time: string | null
  mil_std_2525c: string | null
  team: string | null
  role: string | null
  type: string | null
  icon: { bitmap: string; shadow: string } | null
  point: EUDPoint | null
}

export type ShapeType = 'rb_line' | 'polygon' | 'waypoint' | 'casevac'

export interface Shape {
  uid: string
  name: string
  type: ShapeType
  /** [lat, lng] pairs — Leaflet LatLngTuple format */
  points: [number, number][]
  meta: string | null
}

export interface MissionItem {
  uid: string
  name: string
  type: string
  latitude: number | null
  longitude: number | null
}

export interface Mission {
  uid: string
  name: string
  items: MissionItem[]
}

export type FilterType = 'all' | 'eud' | 'mission' | 'shape'

export interface MapStore {
  // --- dane ---
  euds:     Record<string, EUD>
  /** max 50 punktów per uid, FIFO */
  tracks:   Record<string, [number, number][]>
  shapes:   Shape[]
  missions: Mission[]

  // --- UI state ---
  selectedUid: string | null
  followUid:   string | null
  filterQuery: string
  filterType:  FilterType

  // --- actions ---
  upsertEud:    (eud: EUD) => void
  appendTrack:  (uid: string, point: [number, number]) => void
  upsertShape:  (shape: Shape) => void
  setMissions:  (missions: Mission[]) => void
  selectUnit:   (uid: string | null) => void
  setFollowUid: (uid: string | null) => void
  setFilterQuery: (q: string) => void
  setFilterType:  (t: FilterType) => void
  hydrate: (data: {
    euds: EUD[]
    markers: unknown[]
    rb_lines: unknown[]
    casevacs: unknown[]
  }) => void
}
