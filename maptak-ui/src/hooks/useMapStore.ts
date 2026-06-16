import { create } from 'zustand'
import type { EUD, FilterType, MapStore, Mission, PluginConfig, Shape } from '../types/maptak.types'
import { DEFAULT_CONFIG } from '../types/maptak.types'

const MAX_EUDS = 500

export const useMapStore = create<MapStore>((set, get) => ({
  euds: {},
  tracks: {},
  shapes: [],
  missions: [],
  config: DEFAULT_CONFIG,
  selectedUid: null,
  followUid: null,
  filterQuery: '',
  filterType: 'all',
  selectedMissions: [],

  upsertEud: (eud: EUD) =>
    set((state) => {
      const euds = { ...state.euds, [eud.uid]: eud }
      const keys = Object.keys(euds)
      let tracks = state.tracks
      if (keys.length > MAX_EUDS) {
        const evicted = keys
          .sort((a, b) =>
            (euds[a].last_event_time ?? '').localeCompare(euds[b].last_event_time ?? ''),
          )
          .slice(0, keys.length - MAX_EUDS)
        evicted.forEach((k) => delete euds[k])
        if (evicted.length > 0) {
          tracks = { ...state.tracks }
          evicted.forEach((k) => delete tracks[k])
        }
      }
      return { euds, tracks }
    }),

  appendTrack: (uid: string, point: [number, number]) =>
    set((state) => {
      const maxPts = state.config.MAPTAK_MAX_TRACK_POINTS
      return {
        tracks: {
          ...state.tracks,
          [uid]: [...(state.tracks[uid] ?? []), point].slice(-maxPts),
        },
      }
    }),

  upsertShape: (shape: Shape) =>
    set((state) => ({
      shapes: state.shapes.some((s) => s.uid === shape.uid)
        ? state.shapes.map((s) => (s.uid === shape.uid ? shape : s))
        : [...state.shapes, shape],
    })),

  setMissions: (missions: Mission[]) => set({ missions }),

  setConfig: (cfg: Partial<PluginConfig>) =>
    set((state) => ({ config: { ...state.config, ...cfg } })),

  selectUnit: (uid) => set({ selectedUid: uid }),
  setFollowUid: (uid) => set({ followUid: uid }),
  setFilterQuery: (q) => set({ filterQuery: q }),
  setFilterType: (t: FilterType) => set({ filterType: t }),

  toggleMission: (name: string) =>
    set((state) => ({
      selectedMissions: state.selectedMissions.includes(name)
        ? state.selectedMissions.filter((n) => n !== name)
        : [...state.selectedMissions, name],
    })),

  hydrate: ({ euds, markers, rb_lines, casevacs }) => {
    const { upsertEud, upsertShape } = get()

    // EUDs from map_state — last_point is always null, positions come from /api/point separately
    euds.forEach((eud) => upsertEud(eud))

    // Markers: { uid, callsign, point: { latitude, longitude }, mil_std_2525c, ... }
    ;(markers as any[]).forEach((m) => {
      if (!m?.uid || !m?.point?.latitude) return
      upsertShape({
        uid: m.uid,
        name: m.callsign ?? m.uid,
        type: 'waypoint',
        points: [[m.point.latitude, m.point.longitude]],
        meta: m.mil_std_2525c ?? null,
      })
    })

    // RBLines: { uid, point: { latitude, longitude }, end_latitude, end_longitude, bearing, range, ... }
    ;(rb_lines as any[]).forEach((rb) => {
      if (!rb?.uid || !rb?.point?.latitude || rb?.end_latitude == null) return
      upsertShape({
        uid: rb.uid,
        name: rb.callsign ?? rb.uid,
        type: 'rb_line',
        points: [
          [rb.point.latitude, rb.point.longitude],
          [rb.end_latitude, rb.end_longitude],
        ],
        meta: `${rb.bearing ?? ''}° / ${rb.range ?? ''}m`,
      })
    })

    ;(casevacs as any[]).forEach((c) => {
      if (!c?.uid || !c?.point?.latitude) return
      upsertShape({
        uid: c.uid,
        name: c.callsign ?? 'CASEVAC',
        type: 'casevac',
        points: [[c.point.latitude, c.point.longitude]],
        meta: null,
      })
    })
  },
}))
