# MapTAK — Design Specification

**Data:** 2026-06-15  
**Projekt:** OpenTAKIntel  
**Target:** OpenTAK Server 1.7.11 + UI 1.7.5  
**Status:** Zatwierdzony

---

## 1. Cel i zakres

Stworzenie pluginu `ots-maptak` dla OpenTAK Server — w pełni funkcjonalnego widoku mapy taktycznej z obsługą real-time CoT, instalowanego przez wbudowany Plugin Manager bez żadnych modyfikacji w bazowym OpenTAK UI.

**Zakres:**
- Repozytorium `/Volumes/Drewutnia/web/OpenTAKIntel` — samodzielny plugin zgodny z oficjalnym `OTS-Plugin-Template`
- Backend: Python package z Flask Blueprint serwującym statyczne pliki UI
- Frontend: React 19 + Vite SPA budowana do `ots_maptak/ui/` i pakowana do `.whl`
- Dostęp: OpenTAK UI → Plugins → MapTAK → zakładka "UI" (iframe, ten sam origin)
- Integracja wyłącznie przez istniejące endpointy: `socket.io`, `/api/map_state`, `/api/missions`

**Poza zakresem:**
- Jakiekolwiek modyfikacje bazowego OpenTAK UI lub OpenTAK Server
- Nowe endpointy API po stronie serwera
- Wideo overlay (MediaMTX) — osobna iteracja

---

## 2. Problemy w istniejącym Map.tsx

| Problem | Skutek |
|---------|--------|
| Mutacja `fovs[uid] = fov; setFovs(fovs)` | React nie wykrywa zmiany → markery nie re-renderują |
| `L.LayerGroup` tworzony poza hookami (poza `useEffect`/`useRef`) | Duplikaty warstw przy hot-reload, wycieki pamięci |
| Brak śladów ruchu EUD | Nie widać historii pozycji jednostek |
| Shapes CoT (polygony, linie) z ATAK nie renderują się | Strefy, obszary operacyjne niewidoczne |
| Elementy misji (`/api/missions`) nie są wyświetlane na mapie | Waypoints, dane misji niewidoczne |
| Jeden plik ~600 linii | Trudny w testowaniu i rozbudowie |

---

## 3. Architektura

### 3.1 Struktura repozytorium

```
ots-maptak/                         # korzeń projektu (OpenTAKIntel)
│
├── ots_maptak/                     # Python package (plugin backend)
│   ├── __init__.py
│   ├── app.py                      # Flask Blueprint — trasy, serwowanie UI
│   ├── default_config.py           # Domyślna konfiguracja pluginu
│   └── ui/                         # Zbudowana React SPA (git-ignored, generowana)
│       ├── index.html
│       └── assets/
│           ├── index-[hash].js
│           └── index-[hash].css
│
├── maptak-ui/                      # React 19 + Vite — kod źródłowy frontendu
│   ├── src/
│   │   ├── main.tsx                # Entry point SPA
│   │   ├── App.tsx                 # Root — layout 3-panelowy
│   │   ├── App.module.css          # Style (Inter/sans-serif)
│   │   ├── components/
│   │   │   ├── UnitSidebar.tsx     # Lewy panel: lista EUD + misje + filtrowanie
│   │   │   ├── UnitDetailPanel.tsx # Prawy panel: szczegóły wybranej jednostki
│   │   │   └── LayerControl.tsx    # Przełącznik warstw kafelków
│   │   ├── map/
│   │   │   ├── MapCore.tsx         # MapContainer + inicjalizacja
│   │   │   ├── EudLayer.tsx        # Markery EUD: MIL-STD-2525C, rotacja, slideTo
│   │   │   ├── TrackLayer.tsx      # Ślady gradientowe (ostatnie 50 pkt/unit)
│   │   │   └── ShapeLayer.tsx      # Polygony, linie CoT z misji i ATAK
│   │   ├── hooks/
│   │   │   ├── useMapStore.ts      # Zustand store
│   │   │   ├── useSocketEvents.ts  # socket.io listeners → store
│   │   │   ├── useMapState.ts      # Bootstrap: GET /api/map_state
│   │   │   └── useMissions.ts      # GET /api/missions → shapes
│   │   └── types/
│   │       └── maptak.types.ts     # TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts              # outDir: ../ots_maptak/ui
│
├── pyproject.toml                  # Poetry — buduje .whl z ui/ w środku
├── Makefile                        # make build / make dev / make package
└── README.md
```

### 3.2 Przepływ danych

```
OpenTAK Server
  │
  ├─ socket.io events (point, eud, marker, rb_line, casevac)
  │    └─→ useSocketEvents.ts → useMapStore.setState()
  │
  └─ REST API (przy mount)
       ├─ GET /api/map_state → useMapState.ts → useMapStore.hydrate()
       └─ GET /api/missions  → useMissions.ts  → useMapStore.setMissions()

useMapStore (Zustand)
  ├─→ EudLayer    (markery + FOV)
  ├─→ TrackLayer  (ślady gradientowe)
  ├─→ ShapeLayer  (strefy, linie, waypoints)
  ├─→ UnitSidebar (lista, status online/offline)
  └─→ UnitDetailPanel (szczegóły wybranej jednostki)
```

### 3.3 Zustand Store — schemat stanu

```typescript
interface MapStore {
  // Dane
  euds:     Record<string, EUD>
  tracks:   Record<string, LatLng[]>   // max 50 punktów/unit, FIFO
  shapes:   Shape[]
  missions: Mission[]

  // UI state
  selectedUid:   string | null
  filterQuery:   string
  filterType:    'all' | 'eud' | 'mission' | 'shape'
  visibleLayers: Set<LayerType>

  // Actions
  upsertEud:     (eud: EUD) => void
  appendTrack:   (uid: string, point: LatLng) => void
  setMissions:   (missions: Mission[]) => void
  selectUnit:    (uid: string | null) => void
}
```

---

## 4. Komponenty — szczegóły

### 4.1 MapTAK.tsx (Root)

- Układ: CSS Grid `240px | 1fr | 220px`
- Lewy panel (`UnitSidebar`) + mapa + prawy panel (`UnitDetailPanel`)
- Inicjuje hooki `useSocketEvents`, `useMapState`, `useMissions` przy mount
- Typografia: `font-family: 'Inter', system-ui, sans-serif` w całym komponencie

### 4.2 EudLayer.tsx

- Używa `useMapStore` do subskrypcji na `euds`
- Marker ikony: milsymbol (MIL-STD-2525C) gdy `mil_std_2525c !== null`, fallback: custom icon
- Rotacja przez `leaflet-rotatedmarker` (już zainstalowany)
- Animacja: `marker.slideTo([lat, lon], { duration: 2000 })` przy aktualizacji
- Klik markera → `store.selectUnit(uid)` → otwiera `UnitDetailPanel`
- Status: zielony obwód = online, szary = rozłączony (>5 min bez update)

### 4.3 TrackLayer.tsx

- Bufor: ostatnie **50 punktów** per EUD (FIFO w Zustand `tracks`)
- Renderuje `L.Polyline` z dekoratorem gradientu opacity: `0.15 → 1.0` (stare → nowe)
- Implementacja gradientu: segmenty polyline z rosnącą opacity (brak zależności zewnętrznych)
- Ukryty gdy `tracks[uid].length < 2`

### 4.4 ShapeLayer.tsx

- Źródła danych: `rb_lines` (socket), `casevacs` (socket), shapes z `/api/missions`
- `rb_line` → `L.Polyline` z etykietą bearing/distance
- Polygon CoT → `L.Polygon` z `fillOpacity: 0.15`, `dashArray: '6, 3'` dla stref ostrzeżeń
- Klik kształtu → popup z nazwą i metadanymi CoT

### 4.5 UnitSidebar.tsx

- Lista EUD posortowana: online najpierw, ostatnia aktywność
- Filtrowanie: text search po callsign + toggle: EUD | Misje | Kształty
- Sekcja misji: expandable lista waypoints i elementów misji
- Footer: licznik online/offline/elementy misji
- Klik jednostki → `store.selectUnit(uid)` + mapa centruje na markerze

### 4.6 UnitDetailPanel.tsx

- Pokazuje gdy `store.selectedUid !== null`
- Sekcje: Pozycja (lat/lon/alt/speed/course), Szczegóły (typ, team, rola), Historia (ostatnie 10 event-timestamps)
- Przyciski: **Centruj** (map.flyTo), **Śledź** (auto-center przy nowych punktach)
- Ukryty panel gdy nic nie wybrane (mapa zajmuje pełną szerokość)

### 4.7 LayerControl.tsx

- Warstwy bazowe: OSM, Google Streets, Google Hybrid, Google Terrain, ESRI Imagery, ESRI Topo
- Overlays: Google Street View Coverage, Weather (WMS), Google Roads, Google Terrain
- Zapisuje wybraną warstwę bazową w `localStorage` (persystencja między sesjami)

---

## 5. Integracja z OpenTAK Server

### 5.1 Instalacja pluginu

```
# Jednorazowe budowanie
cd maptak-ui && npm run build        # → ots_maptak/ui/
cd .. && poetry build                # → dist/ots_maptak-1.0.0-py3-none-any.whl

# Instalacja na serwerze
OpenTAK UI → Server Plugin Manager → Upload Plugin → .whl
→ restart OpenTAKServer
→ Plugins → MapTAK → zakładka "UI"
```

### 5.2 Flask Blueprint (app.py)

Plugin rejestruje trzy trasy pod `/api/plugins/ots_maptak/`:
- `GET /` — metadane pluginu (JSON z pyproject.toml)
- `GET /ui` — serwuje `ui/index.html` (ładowany w iframe przez OpenTAK UI)
- `GET /assets/<file>` — pliki statyczne JS/CSS
- `GET /config` + `POST /config` — konfiguracja YAML (standard pluginu)

Brak własnych tras danych — plugin konsumuje wyłącznie istniejące API OpenTAK.

### 5.3 Komunikacja frontend ↔ serwer

Ponieważ iframe i OpenTAK UI działają na tym samym origin (ten sam nginx), nie ma problemów z CORS ani z auth:

- **socket.io:** `io("/socket.io", { autoConnect: false })` — identyczna konfiguracja jak w bazowym UI; sesja i ciasteczka przekazywane automatycznie
- **REST:** `axios.get('/api/map_state')` — ten sam origin, auth przez ciasteczko sesji

### 5.4 Nowe zależności npm (maptak-ui)

```json
{
  "zustand": "^5.0.0",
  "leaflet": "^1.9.4",
  "react-leaflet": "^5.0.0",
  "milsymbol": "^2.x",
  "leaflet-rotatedmarker": "^0.2.0",
  "leaflet.marker.slideto": "^0.3.0",
  "socket.io-client": "^4.x",
  "axios": "^1.x"
}
```

### 5.5 Offline (częściowy)

- Przy braku połączenia z API: pokazuje ostatni znany stan z `sessionStorage`
- Kafelki: cache przeglądarki; brak specjalnych rozwiązań offline w tej iteracji
- Wskaźnik połączenia: `socket.connected` → badge LIVE/OFFLINE w lewym górnym rogu

---

## 6. Bezpieczeństwo i niezawodność

- Wszystkie dane z socket.io walidowane przez TypeScript interfaces przed wpisaniem do store
- Graceful handling: brak `lat/lon` → marker pominięty (nie crash)
- `socket.off()` w cleanup funkcji useEffect — brak wycieków event listenerów
- Limity: max 50 punktów track/unit, max 500 jednostek w store (po przekroczeniu: LRU eviction najstarszych)

---

## 7. Typografia i styl

- **Font:** `'Inter', system-ui, -apple-system, sans-serif` — brak krojów szeryfowych
- **Ciemny motyw:** spójny z istniejącym OpenTAK UI (Mantine `ColorScheme`)
- **Wskaźniki stanu:** zielony `#00ff88` (online), czerwony `#ff4444` (offline), żółty `#ffd700` (misja)
- **Panele boczne:** respektują `useComputedColorScheme` z Mantine

---

## 8. Testowanie

| Scenariusz | Metoda |
|-----------|--------|
| Marker pojawia się przy socket `eud` event | Vitest + React Testing Library |
| Track rośnie do max 50 punktów (FIFO) | Vitest unit test dla useMapStore |
| Filtrowanie w sidebarze | Vitest + RTL |
| Brak połączenia socket → wskaźnik OFFLINE | Vitest z mock socket.io-client |
| Klik markera → panel szczegółów | RTL user-event |
| Flask `/ui` zwraca 200 z index.html | pytest w `tests/test_plugin.py` |

Własna konfiguracja testów w `maptak-ui/` (`vitest.config.ts`) — niezależna od OpenTAK UI.

---

## 9. Ograniczenia i znane kompromisy

| Ograniczenie | Decyzja |
|-------------|---------|
| Mapa dostępna przez Plugins → MapTAK → UI (nie w głównym menu) | Akceptowalne; brak modyfikacji bazowego UI jest priorytetem |
| iframe ogranicza pełnoekranowość do obszaru pluginu | Leaflet Fullscreen Control działa poprawnie w iframe |
| Leaflet 1.x brak WebGL | Akceptowalne dla <500 jednostek; MapLibre migracja jako osobna iteracja |
| Gradient przez segmenty polyline | Prosta implementacja bez dodatkowych zależności |
| Offline tiles nie cachowane lokalnie | Poza zakresem tej iteracji |
| Brak video overlay | Osobna iteracja po stabilizacji MapTAK |

---

## 10. Kroki implementacji (kolejność)

1. **Setup projektu** — inicjalizacja git, `pyproject.toml` (Poetry), `Makefile`, struktura katalogów
2. **Python backend** — `ots_maptak/app.py` (Flask Blueprint), `default_config.py`, `__init__.py`
3. **Vite SPA scaffold** — `maptak-ui/` z React 19 + TypeScript, konfiguracja `vite.config.ts` (outDir → `../ots_maptak/ui`)
4. **`maptak.types.ts`** — TypeScript interfaces: EUD, Track, Shape, Mission, MapStore
5. **`useMapStore.ts`** — Zustand store z pełnym API akcji
6. **`useSocketEvents.ts`** + **`useMapState.ts`** + **`useMissions.ts`** — hooki danych
7. **`MapCore.tsx`** — MapContainer z Leaflet, puste warstwy
8. **`EudLayer.tsx`** — markery MIL-STD-2525C + rotacja + slideTo
9. **`TrackLayer.tsx`** — ślady gradientowe
10. **`ShapeLayer.tsx`** — strefy, linie, waypoints misji
11. **`UnitSidebar.tsx`** — panel boczny lewy z filtrowaniem
12. **`UnitDetailPanel.tsx`** — panel szczegółów prawy
13. **`App.tsx`** + **`LayerControl.tsx`** — integracja całości, layout 3-panelowy
14. **Testy Vitest** — unit testy store + RTL testy komponentów
15. **`make package`** — build `.whl`, instrukcja instalacji przez Plugin Manager
