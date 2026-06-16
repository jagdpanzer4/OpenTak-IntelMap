# Data Management Tab — Design Spec
**Date:** 2026-06-16  
**Plugin:** ots-maptak v1.0.x  
**Branch:** data-management

---

## Overview

Add a top-level "Dane" view to the MapTAK plugin UI allowing the operator to **list, filter, and delete** five categories of objects stored on the OpenTAK server: EUDs, Markers, Routes, Shapes (drawn polygons), and SPIs.

No creation or editing of objects is in scope. The feature is purely read + delete.

---

## Architecture

### Navigation change

`App.tsx` gains a top-level view switch (state: `'map' | 'data'`). A slim top-bar renders two buttons — **Mapa** and **Dane** — using existing design tokens (`#0f3460` active, `#16213e` inactive). When `view === 'data'` the sidebar+map grid is replaced by `<DataManager />` full-width.

### New frontend components

| File | Purpose |
|------|---------|
| `src/components/DataManager.tsx` | Root: sub-tab state, shared search/filter toolbar, renders active sub-tab panel |
| `src/components/data/EudTable.tsx` | EUD rows: callsign, team, role, platform, last seen, status badge, delete |
| `src/components/data/MarkerTable.tsx` | Marker rows: name, type, coords, timestamp, delete |
| `src/components/data/RouteTable.tsx` | Route rows: name, waypoint count, timestamp, delete |
| `src/components/data/ShapeTable.tsx` | Shape rows: name, color swatch, vertex count, timestamp, delete |
| `src/components/data/SpiTable.tsx` | SPI rows: name, sender EUD, coords, timestamp, delete |
| `src/components/DataManager.module.css` | All data-manager styles |

### Shared table primitive

All five tables share the same visual structure: sticky header row, alternating row shading, `delete` icon button per row, bulk-select checkbox column, "Usuń zaznaczone (N)" button. A shared `DataTable` component (in `data/DataTable.tsx`) renders the scaffold; each *Table passes typed rows as children.

### Design tokens (consistent with existing sidebar)

```
Background:        #0d1b2a (page), #16213e (cards/rows)
Border:            #0f3460
Accent blue:       #1a4a8a  
Active/online:     #00e676
Inactive/offline:  #546e7a
Delete red:        #e94560
Text primary:      #e0e0e0
Text secondary:    #a0c4ff
Font:              Inter, system-ui (already loaded)
```

---

## Backend — new endpoints

All under `/api/plugins/ots_maptak/data/`.

### List endpoints (GET)

| Route | Source table | Filters |
|-------|-------------|---------|
| `/data/euds` | `EUD` | `q` (callsign search), `status` (online/offline) |
| `/data/markers` | `Marker` | `q` (name/type), `mission` (uid) |
| `/data/routes` | `CoT` where type=`b-m-r` | `q` (name) |
| `/data/shapes` | `CoT` where type=`u-d-f` | `q` (name) |
| `/data/spis` | `CoT` where type=`b-m-p-s-p-loc` | `q` (name) |

All return `{ results: [...], total: N }`. Max 500 rows, no pagination in v1 (acceptable given typical server scale).

### Delete endpoints (DELETE)

| Route | Action |
|-------|--------|
| `/data/euds/<uid>` | Delete `EUD` record + cascade (Points, CoT) via SQLAlchemy |
| `/data/markers/<uid>` | Delete `Marker` record |
| `/data/cot/<uid>` | Delete `CoT` record by `uid` (used for routes, shapes, SPIs) |

Bulk delete: `DELETE /data/euds` with JSON body `{ "uids": [...] }` — one transaction.  
Same pattern for markers and cot.

### Auth

All endpoints use `@roles_accepted('administrator')` — same as existing plugin endpoints.

---

## State management

No new Zustand store needed. `DataManager` uses local React state (`useState`) for:
- `activeTab: 'euds' | 'markers' | 'routes' | 'shapes' | 'spis'`
- `query: string`
- `statusFilter: 'all' | 'online' | 'offline'` (EUD only)
- `selected: Set<string>` (UIDs of checked rows)
- `data: Record<tab, rows[]>` — fetched on tab switch, refetched after delete

---

## Visual design

- Top navigation bar: `MAPA` | `DANE` — uppercase, letter-spacing 1px, consistent with sidebar header style
- Sub-tabs inside DataManager: pill-style badges showing count per category
- Online EUD rows: `#00e676` callsign; offline rows: muted (`#546e7a`), 70% opacity
- Delete button: `#e94560` icon-only (trash icon via Unicode `🗑` or inline SVG), with confirmation tooltip on hover
- Color swatch for shapes: 10×10px inline block with shape's CSS color
- Responsive table: on narrow viewports column visibility reduces to name + action only

---

## Testing

- **Unit tests** for each Table component: renders rows, fires delete callback, checks bulk-select state
- **Python tests** for each endpoint: list returns correct shape, DELETE removes record, bulk DELETE is atomic
- Target: 8 new Python tests + 10 new JS tests

---

## Out of scope

- Creating new objects
- Editing object properties
- Exporting data (CSV, KML)
- Pagination / infinite scroll (500 row limit sufficient)
- Real-time updates in data view (manual refresh button is sufficient)

---

## Known trade-offs

- Deleting an EUD cascades to all its Points and CoT — this is intentional but irreversible. The UI shows a confirmation dialog before bulk EUD deletes.
- Routes/shapes/SPIs deleted by CoT UID will not re-appear even if the ATAK client re-sends them (they'll be re-inserted then).
- `@roles_accepted('administrator')` means only admins can delete — appropriate for field operations.
