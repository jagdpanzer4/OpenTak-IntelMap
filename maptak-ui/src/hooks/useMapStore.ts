import { create } from 'zustand'
import type { EUD, FilterType, MapStore, Mission, Shape } from '../types/maptak.types'

const MAX_TRACK_PTS = 50
const MAX_EUDS      = 500

export const useMapStore = create<MapStore>((set, get) => ({
  euds:     {},
  tracks:   {},
  shapes:   [],
  missions: [],
  selectedUid: null,
  followUid:   null,
  filterQuery: '',
  filterType:  'all',

  upsertEud: (eud: EUD) =>
    set((state) => {
      const euds = { ...state.euds, [eud.uid]: eud }
      // LRU eviction powyżej limitu — usuwa najstarzej widziane
      const keys = Object.keys(euds)
      if (keys.length > MAX_EUDS) {
        keys
          .sort((a, b) =>
            (euds[a].last_event_time ?? '').localeCompare(euds[b].last_event_time ?? ''),
          )
          .slice(0, keys.length - MAX_EUDS)
          .forEach((k) => delete euds[k])
      }
      return { euds }
    }),

  appendTrack: (uid: string, point: [number, number]) =>
    set((state) => ({
      tracks: {
        ...state.tracks,
        [uid]: [...(state.tracks[uid] ?? []), point].slice(-MAX_TRACK_PTS),
      },
    })),

  upsertShape: (shape: Shape) =>
    set((state) => ({
      shapes: state.shapes.some((s) => s.uid === shape.uid)
        ? state.shapes.map((s) => (s.uid === shape.uid ? shape : s))
        : [...state.shapes, shape],
    })),

  setMissions: (missions: Mission[]) => set({ missions }),

  selectUnit:     (uid) => set({ selectedUid: uid }),
  setFollowUid:   (uid) => set({ followUid: uid }),
  setFilterQuery: (q)   => set({ filterQuery: q }),
  setFilterType:  (t: FilterType) => set({ filterType: t }),

  hydrate: ({ euds, markers, rb_lines, casevacs }) => {
    const { upsertEud, appendTrack, upsertShape } = get()

    euds.forEach((eud) => {
      upsertEud(eud)
      if (eud.point?.latitude != null && eud.point?.longitude != null) {
        appendTrack(eud.uid, [eud.point.latitude, eud.point.longitude])
      }
    })

    ;(markers as any[]).forEach((m) => {
      if (!m?.uid || !m?.point?.latitude) return
      upsertShape({
        uid: m.uid, name: m.callsign ?? m.uid, type: 'waypoint',
        points: [[m.point.latitude, m.point.longitude]], meta: null,
      })
    })

    ;(rb_lines as any[]).forEach((rb) => {
      if (!rb?.uid || !rb?.point1 || !rb?.point2) return
      upsertShape({
        uid: rb.uid, name: rb.uid, type: 'rb_line',
        points: [[rb.point1.latitude, rb.point1.longitude],
                 [rb.point2.latitude, rb.point2.longitude]],
        meta: `${rb.bearing ?? ''}° / ${rb.distance ?? ''}m`,
      })
    })

    ;(casevacs as any[]).forEach((c) => {
      if (!c?.uid || !c?.point?.latitude) return
      upsertShape({
        uid: c.uid, name: c.callsign ?? 'CASEVAC', type: 'casevac',
        points: [[c.point.latitude, c.point.longitude]], meta: null,
      })
    })
  },
}))
