# MapTAK Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zbudować `ots-maptak` — OpenTAK Server plugin instalowany przez Plugin Manager, dostarczający pełny widok mapy taktycznej z real-time CoT w iframe, bez żadnych modyfikacji bazowego UI.

**Architecture:** Python package (Poetry) z Flask Blueprint serwującym zbudowaną React 19 + Vite SPA. Frontend łączy się do istniejących endpointów OpenTAK (`/socket.io`, `/api/map_state`, `/api/missions`) przez ten sam origin — ciasteczka auth przechodzą automatycznie. Zustand zarządza stanem reaktywnym; Leaflet renderuje mapę z markerami MIL-STD-2525C, śladami gradientowymi i strefami CoT.

**Tech Stack:** Python 3.10+, Flask, Poetry, React 19, TypeScript, Vite, Zustand 5, Leaflet 1.9, react-leaflet 5, milsymbol, socket.io-client, axios, Vitest, pytest

---

## Mapa plików

```
/Volumes/Drewutnia/web/OpenTAKIntel/
├── ots_maptak/
│   ├── __init__.py
│   ├── app.py                          Flask Blueprint (trasy UI + config)
│   └── default_config.py               Domyślna konfiguracja YAML
├── maptak-ui/
│   ├── index.html                      Vite HTML entry
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts                  outDir=../ots_maptak/ui, base=/api/plugins/ots_maptak/
│   └── src/
│       ├── main.tsx                    createRoot entry
│       ├── socket.ts                   io('/socket.io', {autoConnect:false})
│       ├── index.css                   html/body/root 100vh, sans-serif
│       ├── App.tsx                     Grid layout 240px|1fr|220px
│       ├── App.module.css
│       ├── test/
│       │   └── setup.ts               Leaflet + react-leaflet mocks dla Vitest
│       ├── types/
│       │   └── maptak.types.ts        EUD, Shape, Mission, MapStore interfaces
│       ├── hooks/
│       │   ├── useMapStore.ts         Zustand store (euds, tracks, shapes, missions)
│       │   ├── useSocketEvents.ts     socket.on(eud|point|rb_line|marker|casevac)
│       │   ├── useMapState.ts         GET /api/map_state → hydrate()
│       │   └── useMissions.ts         GET /api/missions co 30s
│       ├── map/
│       │   ├── MapCore.tsx            MapContainer + wszystkie warstwy
│       │   ├── MapController.tsx      useMap() → flyTo, follow
│       │   ├── EudLayer.tsx           Markery MIL + slideTo + rotacja
│       │   ├── TrackLayer.tsx         Ślady gradientowe (max 50 pkt/unit)
│       │   └── ShapeLayer.tsx         Polygony, rb_lines, waypoints
│       └── components/
│           ├── LayerControl.tsx       Przełącznik warstw (OSM/Google/ESRI)
│           ├── LiveIndicator.tsx      Badge LIVE/OFFLINE
│           ├── UnitSidebar.tsx        Lewy panel: lista EUD + misje
│           ├── UnitSidebar.module.css
│           ├── UnitDetailPanel.tsx    Prawy panel: szczegóły wybranej jednostki
│           └── UnitDetailPanel.module.css
├── tests/
│   ├── conftest.py                    Stubuje opentakserver + flask_security
│   └── test_plugin.py                Pytest: trasy Blueprint
├── pyproject.toml                     Poetry build config
├── pytest.ini
├── Makefile                           make dev / build / package / test
└── .gitignore
```

---

## Task 1: Project scaffold

**Files:**
- Create: `pyproject.toml`
- Create: `Makefile`
- Create: `.gitignore`
- Create: `README.md`
- Create: `pytest.ini`

- [ ] **Krok 1: Zainicjuj git i utwórz pyproject.toml**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git init
```

Utwórz `pyproject.toml`:

```toml
[project]
name = "ots-maptak"
description = "Tactical map plugin for OpenTAKServer"
authors = [{name = "OpenTAKIntel"}]
readme = "README.md"
license = "GPL-3.0-or-later"
dynamic = ["entry-points", "version"]

[tool.poetry]
include = [{path = "ots_maptak/ui/**/*", format = ["sdist", "wheel"]}]
version = "0.0.0"

[tool.poetry.dependencies]
python = ">=3.10, <4.0"
opentakserver = ">=1.7.0"

[tool.poetry.dev-dependencies]
pytest = "^8.0"
flask = "^3.0"

[tool.poetry-dynamic-versioning]
enable = true
vcs = "git"
style = "semver"
dirty = false
pattern = "((?P<epoch>\\d+)!)?(?P<base>\\d+(\\.\\d+)*)"

[tool.poetry-dynamic-versioning.files."ots_maptak/__init__.py"]
persistent-substitution = true
initial-content = """
  __version__ = "0.0.0"
  __version_tuple__ = (0, 0, 0)
"""

[build-system]
requires = ["poetry-core>=2.0.0", "poetry-dynamic-versioning>=1.0.0,<2.0.0", "setuptools"]
build-backend = "poetry_dynamic_versioning.backend"

[project.entry-points.'opentakserver.plugin']
ots_maptak = 'ots_maptak.app:MapTAKPlugin'
```

- [ ] **Krok 2: Utwórz Makefile**

```makefile
.PHONY: dev build package test clean

dev:
	cd maptak-ui && npm run dev

build:
	cd maptak-ui && npm run build

package: build
	poetry build

test:
	cd maptak-ui && npm run test -- --run
	pytest tests/ -v

clean:
	rm -rf maptak-ui/dist
	rm -rf ots_maptak/ui
	rm -rf dist
	rm -rf .pytest_cache
	find . -type d -name __pycache__ -exec rm -rf {} +
```

- [ ] **Krok 3: Utwórz .gitignore**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
dist/
.venv/
venv/

# Node
maptak-ui/node_modules/
maptak-ui/dist/

# Generated UI (rebuilt by make build)
ots_maptak/ui/

# Misc
.DS_Store
*.whl
```

- [ ] **Krok 4: Utwórz README.md**

```markdown
# ots-maptak

Tactical map plugin for OpenTAKServer 1.7.11+.

## Install

1. `make package` — builds `dist/ots_maptak-*.whl`
2. OpenTAK UI → Server Plugin Manager → Upload Plugin → select `.whl`
3. Restart OpenTAKServer
4. Plugins → MapTAK → UI tab

## Dev

```bash
cd maptak-ui && npm install
make dev          # Vite dev server (no hot backend)
make package      # full .whl build
make test         # Vitest + pytest
```
```

- [ ] **Krok 5: Utwórz pytest.ini**

```ini
[pytest]
testpaths = tests
```

- [ ] **Krok 6: Commit**

```bash
git add .
git commit -m "chore: project scaffold — pyproject, Makefile, gitignore"
```

---

## Task 2: Python backend (Flask Blueprint)

**Files:**
- Create: `ots_maptak/__init__.py`
- Create: `ots_maptak/app.py`
- Create: `ots_maptak/default_config.py`
- Create: `tests/conftest.py`
- Create: `tests/test_plugin.py`

- [ ] **Krok 1: Napisz failing testy**

Utwórz `tests/conftest.py`:

```python
import sys
from unittest.mock import MagicMock

# Stub opentakserver i flask_security przed importem ots_maptak
_ots = MagicMock()
sys.modules.setdefault('opentakserver', _ots)
sys.modules.setdefault('opentakserver.plugins', MagicMock())
sys.modules.setdefault('opentakserver.plugins.Plugin', MagicMock())
sys.modules.setdefault('opentakserver.extensions', MagicMock())

_fs = MagicMock()
_fs.roles_accepted = lambda *roles: (lambda f: f)  # passthrough decorator
sys.modules.setdefault('flask_security', _fs)
```

Utwórz `tests/test_plugin.py`:

```python
import pytest
from flask import Flask


@pytest.fixture
def app():
    from ots_maptak.app import blueprint
    a = Flask(__name__)
    a.register_blueprint(blueprint)
    a.config['TESTING'] = True
    return a


def test_ui_route_registered(app):
    rules = {r.rule for r in app.url_map.iter_rules()}
    assert '/api/plugins/ots_maptak/ui' in rules


def test_assets_route_registered(app):
    rules = {r.rule for r in app.url_map.iter_rules()}
    assert '/api/plugins/ots_maptak/assets/<file_name>' in rules


def test_config_get_route_registered(app):
    rules = {r.rule for r in app.url_map.iter_rules()}
    assert '/api/plugins/ots_maptak/config' in rules


def test_url_prefix():
    from ots_maptak.app import blueprint
    assert blueprint.url_prefix == '/api/plugins/ots_maptak'
```

- [ ] **Krok 2: Uruchom testy — powinny failować**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
pip install flask pytest --quiet
pytest tests/ -v
```

Oczekiwany wynik: `ModuleNotFoundError: No module named 'ots_maptak'`

- [ ] **Krok 3: Utwórz ots_maptak/__init__.py**

```python
__version__ = "0.0.0"
__version_tuple__ = (0, 0, 0)
```

- [ ] **Krok 4: Utwórz ots_maptak/default_config.py**

```python
import os
import yaml


class DefaultConfig:
    @staticmethod
    def update_config(new_config: dict) -> dict:
        data_folder = os.environ.get('OTS_DATA_FOLDER', os.path.expanduser('~/ots'))
        config_file = os.path.join(data_folder, 'config.yml')
        try:
            with open(config_file, 'r') as f:
                config = yaml.safe_load(f) or {}
            config.update(new_config)
            with open(config_file, 'w') as f:
                yaml.dump(config, f)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
```

- [ ] **Krok 5: Utwórz ots_maptak/app.py**

```python
from __future__ import annotations

import importlib.metadata
import os
import pathlib
import traceback

import yaml
from flask import Blueprint, Flask, current_app as app, jsonify, request, send_from_directory
from flask_security import roles_accepted
from opentakserver.extensions import logger
from opentakserver.plugins.Plugin import Plugin

from .default_config import DefaultConfig

_HERE = pathlib.Path(__file__).resolve().parent
_PKG  = _HERE.name  # "ots_maptak"


class MapTAKPlugin(Plugin):
    metadata    = _PKG
    url_prefix  = f'/api/plugins/{_PKG}'
    blueprint   = Blueprint('MapTAKPlugin', __name__, url_prefix=url_prefix)

    def activate(self, flask_app: Flask):
        self._app = flask_app
        self._load_config()
        self.load_metadata()
        try:
            logger.info(f'MapTAK plugin loaded (v{self._version()})')
        except Exception:
            logger.error(traceback.format_exc())

    def load_metadata(self):
        try:
            self.distro   = _PKG
            self.metadata = importlib.metadata.metadata(_PKG).json
            self.name     = self.metadata['name']
            self.metadata['distro'] = _PKG
            return self.metadata
        except Exception as e:
            logger.error(e)
            return None

    def _load_config(self):
        for key in dir(DefaultConfig):
            if key.isupper():
                self._config[key] = getattr(DefaultConfig, key)
                self._app.config[key] = getattr(DefaultConfig, key)
        try:
            cfg_path = os.path.join(self._app.config.get('OTS_DATA_FOLDER', ''), 'config.yml')
            with open(cfg_path) as f:
                for k, v in (yaml.safe_load(f) or {}).items():
                    if k in self._config:
                        self._config[k] = v
                        self._app.config[k] = v
        except FileNotFoundError:
            pass

    def _version(self):
        try:
            return importlib.metadata.version(_PKG)
        except Exception:
            return '0.0.0'

    def get_info(self):
        self.load_metadata()
        self.get_plugin_routes(self.url_prefix)
        return {'name': self.name, 'distro': self.distro, 'routes': self.routes}

    def stop(self):
        pass

    # ------------------------------------------------------------------ routes

    @staticmethod
    @roles_accepted('administrator')
    @blueprint.route('/')
    def plugin_info():
        try:
            dists = importlib.metadata.packages_distributions()
            for distro_pkg, names in dists.items():
                if str(__name__).startswith(distro_pkg):
                    return jsonify(importlib.metadata.metadata(names[0]).json)
            return jsonify({'success': False, 'error': 'Plugin not found'}), 404
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 500

    @staticmethod
    @roles_accepted('administrator')
    @blueprint.route('/ui')
    def ui():
        return send_from_directory(str(_HERE / 'ui'), 'index.html', as_attachment=False)

    @staticmethod
    @roles_accepted('administrator')
    @blueprint.route('/assets/<file_name>')
    @blueprint.route('/ui/<file_name>')
    def serve(file_name):
        assets_dir = _HERE / 'ui' / 'assets'
        ui_dir     = _HERE / 'ui'
        if file_name and (assets_dir / file_name).exists():
            return send_from_directory(str(assets_dir), file_name)
        if file_name and (ui_dir / file_name).exists():
            return send_from_directory(str(ui_dir), file_name)
        return '', 404

    @staticmethod
    @roles_accepted('administrator')
    @blueprint.route('/config')
    def config():
        cfg = {k: app.config.get(k) for k in dir(DefaultConfig) if k.isupper()}
        return jsonify(cfg)

    @staticmethod
    @roles_accepted('administrator')
    @blueprint.route('/config', methods=['POST'])
    def update_config():
        try:
            result = DefaultConfig.update_config(request.json)
            return (jsonify(result), 200) if result['success'] else (jsonify(result), 400)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400


blueprint = MapTAKPlugin.blueprint
```

- [ ] **Krok 6: Uruchom testy — powinny przejść**

```bash
pytest tests/ -v
```

Oczekiwany wynik:
```
PASSED tests/test_plugin.py::test_ui_route_registered
PASSED tests/test_plugin.py::test_assets_route_registered
PASSED tests/test_plugin.py::test_config_get_route_registered
PASSED tests/test_plugin.py::test_url_prefix
4 passed
```

- [ ] **Krok 7: Commit**

```bash
git add ots_maptak/ tests/ pytest.ini
git commit -m "feat: Python Flask Blueprint — trasy UI, config, plugin entry point"
```

---

## Task 3: React/Vite scaffold

**Files:**
- Create: `maptak-ui/package.json`
- Create: `maptak-ui/tsconfig.json`
- Create: `maptak-ui/vite.config.ts`
- Create: `maptak-ui/index.html`
- Create: `maptak-ui/src/main.tsx`
- Create: `maptak-ui/src/index.css`
- Create: `maptak-ui/src/socket.ts`
- Create: `maptak-ui/src/test/setup.ts`

- [ ] **Krok 1: Utwórz maptak-ui/package.json**

```json
{
  "name": "maptak-ui",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "preview": "vite preview"
  },
  "dependencies": {
    "@types/leaflet": "^1.9.21",
    "@types/leaflet-rotatedmarker": "^0.2.6",
    "axios": "^1.9.0",
    "leaflet": "^1.9.4",
    "leaflet-rotatedmarker": "^0.2.0",
    "leaflet.marker.slideto": "^0.3.0",
    "milsymbol": "^2.2.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-leaflet": "^5.0.0",
    "socket.io-client": "^4.8.1",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.1.0",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.2.3"
  }
}
```

- [ ] **Krok 2: Utwórz maptak-ui/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Krok 3: Utwórz maptak-ui/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../ots_maptak/ui',
    emptyOutDir: true,
  },
  // base musi pasować do url_prefix Flask + '/'
  base: '/api/plugins/ots_maptak/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Krok 4: Utwórz maptak-ui/index.html**

```html
<!doctype html>
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MapTAK</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Krok 5: Utwórz maptak-ui/src/index.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: #0d1117;
  color: #c9d1d9;
}
```

- [ ] **Krok 6: Utwórz maptak-ui/src/socket.ts**

```typescript
import { io } from 'socket.io-client'

// Same-origin — cookies auth przechodzi automatycznie z iframe
export const socket = io('/socket.io', { autoConnect: false })
```

- [ ] **Krok 7: Utwórz maptak-ui/src/main.tsx**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Krok 8: Utwórz maptak-ui/src/test/setup.ts**

```typescript
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Leaflet wymaga canvas — jsdom go nie ma. Mockujemy całe Leaflet.
vi.mock('leaflet', () => {
  const layerGroup = vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    clearLayers: vi.fn(),
    remove: vi.fn(),
  }))
  const marker = vi.fn(() => ({
    addTo: vi.fn().mockReturnThis(),
    on: vi.fn().mockReturnThis(),
    bindTooltip: vi.fn().mockReturnThis(),
    setIcon: vi.fn(),
    slideTo: vi.fn(),
    setRotationAngle: vi.fn(),
  }))
  return {
    default: {
      layerGroup,
      marker,
      divIcon: vi.fn(() => ({})),
      icon: vi.fn(() => ({})),
      polyline: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), remove: vi.fn() })),
      polygon: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis() })),
      circleMarker: vi.fn(() => ({ addTo: vi.fn().mockReturnThis(), bindPopup: vi.fn().mockReturnThis() })),
      Point: vi.fn((x: number, y: number) => ({ x, y })),
    },
  }
})

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => children,
  TileLayer: () => null,
  WMSTileLayer: () => null,
  LayersControl: Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    {
      BaseLayer: ({ children }: { children: React.ReactNode }) => children,
      Overlay: ({ children }: { children: React.ReactNode }) => children,
    },
  ),
  ScaleControl: () => null,
  useMap: vi.fn(() => ({
    flyTo: vi.fn(),
    panTo: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
  })),
}))

vi.mock('milsymbol', () => ({
  default: {
    Symbol: vi.fn(() => ({
      asSVG: vi.fn(() => '<svg></svg>'),
      getAnchor: vi.fn(() => ({ x: 12, y: 12 })),
    })),
  },
}))

vi.mock('leaflet-rotatedmarker', () => ({}))
vi.mock('leaflet.marker.slideto', () => ({}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('../socket', () => ({
  socket: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
  },
}))
```

- [ ] **Krok 9: Zainstaluj zależności i sprawdź że Vite startuje**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npm install
npx vite build --mode development 2>&1 | head -20
```

Oczekiwany wynik: błąd "Cannot find module './App'" — to OK, App.tsx jeszcze nie istnieje.

- [ ] **Krok 10: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/
git commit -m "feat: Vite + React 19 scaffold, socket.ts, Leaflet/socket mocks dla Vitest"
```

---

## Task 4: TypeScript types

**Files:**
- Create: `maptak-ui/src/types/maptak.types.ts`

- [ ] **Krok 1: Utwórz maptak-ui/src/types/maptak.types.ts**

```typescript
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
```

- [ ] **Krok 2: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/types/
git commit -m "feat: TypeScript interfaces — EUD, Shape, Mission, MapStore"
```

---

## Task 5: Zustand store + unit testy

**Files:**
- Create: `maptak-ui/src/hooks/useMapStore.ts`
- Create: `maptak-ui/src/hooks/useMapStore.test.ts`

- [ ] **Krok 1: Napisz failing testy**

Utwórz `maptak-ui/src/hooks/useMapStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useMapStore } from './useMapStore'

// Reset store przed każdym testem
beforeEach(() => {
  useMapStore.setState({
    euds: {}, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null,
    filterQuery: '', filterType: 'all',
  })
})

describe('upsertEud', () => {
  it('dodaje nową jednostkę', () => {
    const eud = { uid: 'test-1', callsign: 'ALPHA', last_status: 'Connected' as const,
      last_event_time: null, mil_std_2525c: null, team: null, role: null,
      type: null, icon: null, point: null }
    useMapStore.getState().upsertEud(eud)
    expect(useMapStore.getState().euds['test-1']).toEqual(eud)
  })

  it('nadpisuje istniejącą jednostkę', () => {
    const base = { uid: 'test-1', callsign: 'ALPHA', last_status: 'Connected' as const,
      last_event_time: null, mil_std_2525c: null, team: null, role: null,
      type: null, icon: null, point: null }
    useMapStore.getState().upsertEud(base)
    useMapStore.getState().upsertEud({ ...base, callsign: 'ALPHA-UPDATED' })
    expect(useMapStore.getState().euds['test-1'].callsign).toBe('ALPHA-UPDATED')
  })
})

describe('appendTrack', () => {
  it('dodaje punkt do śladu', () => {
    useMapStore.getState().appendTrack('uid-1', [52.23, 21.01])
    expect(useMapStore.getState().tracks['uid-1']).toEqual([[52.23, 21.01]])
  })

  it('ogranicza ślad do 50 punktów (FIFO)', () => {
    for (let i = 0; i < 55; i++) {
      useMapStore.getState().appendTrack('uid-1', [i, i])
    }
    const track = useMapStore.getState().tracks['uid-1']
    expect(track).toHaveLength(50)
    expect(track[0]).toEqual([5, 5])   // pierwsze 5 wypadło
    expect(track[49]).toEqual([54, 54]) // ostatni dodany
  })
})

describe('upsertShape', () => {
  it('dodaje nowy kształt', () => {
    const shape = { uid: 'shape-1', name: 'Strefa', type: 'polygon' as const,
      points: [[52, 21], [53, 21], [53, 22]] as [number,number][], meta: null }
    useMapStore.getState().upsertShape(shape)
    expect(useMapStore.getState().shapes).toHaveLength(1)
  })

  it('aktualizuje istniejący kształt', () => {
    const shape = { uid: 'shape-1', name: 'Strefa', type: 'polygon' as const,
      points: [[52, 21]] as [number,number][], meta: null }
    useMapStore.getState().upsertShape(shape)
    useMapStore.getState().upsertShape({ ...shape, name: 'Strefa-Updated' })
    expect(useMapStore.getState().shapes).toHaveLength(1)
    expect(useMapStore.getState().shapes[0].name).toBe('Strefa-Updated')
  })
})

describe('selectUnit', () => {
  it('ustawia selectedUid', () => {
    useMapStore.getState().selectUnit('uid-42')
    expect(useMapStore.getState().selectedUid).toBe('uid-42')
  })

  it('czyści selectedUid gdy null', () => {
    useMapStore.getState().selectUnit('uid-42')
    useMapStore.getState().selectUnit(null)
    expect(useMapStore.getState().selectedUid).toBeNull()
  })
})

describe('hydrate', () => {
  it('ładuje EUD z /api/map_state', () => {
    const eud = { uid: 'h-1', callsign: 'HOTEL', last_status: 'Connected' as const,
      last_event_time: null, mil_std_2525c: null, team: null, role: null,
      type: null, icon: null,
      point: { latitude: 52, longitude: 21, altitude: null, speed: null,
               course: null, azimuth: null, fov: null, timestamp: null } }
    useMapStore.getState().hydrate({ euds: [eud], markers: [], rb_lines: [], casevacs: [] })
    expect(useMapStore.getState().euds['h-1'].callsign).toBe('HOTEL')
    expect(useMapStore.getState().tracks['h-1']).toEqual([[52, 21]])
  })
})
```

- [ ] **Krok 2: Uruchom testy — powinny failować**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npm run test -- --run src/hooks/useMapStore.test.ts
```

Oczekiwany wynik: `Cannot find module './useMapStore'`

- [ ] **Krok 3: Zaimplementuj useMapStore.ts**

Utwórz `maptak-ui/src/hooks/useMapStore.ts`:

```typescript
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
```

- [ ] **Krok 4: Uruchom testy — powinny przejść**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npm run test -- --run src/hooks/useMapStore.test.ts
```

Oczekiwany wynik: `8 tests passed`

- [ ] **Krok 5: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/hooks/useMapStore.ts maptak-ui/src/hooks/useMapStore.test.ts
git commit -m "feat: Zustand store — upsertEud, appendTrack, upsertShape, hydrate"
```

---

## Task 6: Data hooks (socket, REST)

**Files:**
- Create: `maptak-ui/src/hooks/useSocketEvents.ts`
- Create: `maptak-ui/src/hooks/useMapState.ts`
- Create: `maptak-ui/src/hooks/useMissions.ts`
- Create: `maptak-ui/src/hooks/useSocketEvents.test.ts`

- [ ] **Krok 1: Napisz failing test dla useSocketEvents**

Utwórz `maptak-ui/src/hooks/useSocketEvents.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSocketEvents } from './useSocketEvents'
import { useMapStore } from './useMapStore'
import { socket } from '../socket'

beforeEach(() => {
  useMapStore.setState({
    euds: {}, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all',
  })
  vi.clearAllMocks()
})

it('rejestruje listenery socket.io przy mount', () => {
  renderHook(() => useSocketEvents())
  expect(socket.on).toHaveBeenCalledWith('eud', expect.any(Function))
  expect(socket.on).toHaveBeenCalledWith('point', expect.any(Function))
  expect(socket.on).toHaveBeenCalledWith('rb_line', expect.any(Function))
  expect(socket.on).toHaveBeenCalledWith('marker', expect.any(Function))
  expect(socket.on).toHaveBeenCalledWith('casevac', expect.any(Function))
})

it('odpina listenery przy unmount', () => {
  const { unmount } = renderHook(() => useSocketEvents())
  unmount()
  expect(socket.off).toHaveBeenCalledWith('eud', expect.any(Function))
  expect(socket.off).toHaveBeenCalledWith('point', expect.any(Function))
})
```

- [ ] **Krok 2: Uruchom test — powinien failować**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npm run test -- --run src/hooks/useSocketEvents.test.ts
```

Oczekiwany wynik: `Cannot find module './useSocketEvents'`

- [ ] **Krok 3: Zaimplementuj useSocketEvents.ts**

```typescript
import { useEffect } from 'react'
import { socket } from '../socket'
import { useMapStore } from './useMapStore'
import type { EUD } from '../types/maptak.types'

export function useSocketEvents() {
  const upsertEud   = useMapStore((s) => s.upsertEud)
  const appendTrack = useMapStore((s) => s.appendTrack)
  const upsertShape = useMapStore((s) => s.upsertShape)

  useEffect(() => {
    socket.connect()

    const onEud = (eud: EUD) => upsertEud(eud)

    const onPoint = (pt: any) => {
      if (!pt?.device_uid || pt?.latitude == null || pt?.longitude == null) return
      appendTrack(pt.device_uid, [pt.latitude, pt.longitude])
    }

    const onRBLine = (rb: any) => {
      if (!rb?.uid || !rb?.point1 || !rb?.point2) return
      upsertShape({
        uid: rb.uid, name: rb.uid, type: 'rb_line',
        points: [[rb.point1.latitude, rb.point1.longitude],
                 [rb.point2.latitude, rb.point2.longitude]],
        meta: `${rb.bearing ?? ''}° / ${rb.distance ?? ''}m`,
      })
    }

    const onMarker = (m: any) => {
      if (!m?.uid || !m?.point?.latitude) return
      upsertShape({
        uid: m.uid, name: m.callsign ?? m.uid, type: 'waypoint',
        points: [[m.point.latitude, m.point.longitude]], meta: null,
      })
    }

    const onCasevac = (c: any) => {
      if (!c?.uid || !c?.point?.latitude) return
      upsertShape({
        uid: c.uid, name: c.callsign ?? 'CASEVAC', type: 'casevac',
        points: [[c.point.latitude, c.point.longitude]], meta: null,
      })
    }

    socket.on('eud',     onEud)
    socket.on('point',   onPoint)
    socket.on('rb_line', onRBLine)
    socket.on('marker',  onMarker)
    socket.on('casevac', onCasevac)

    return () => {
      socket.off('eud',     onEud)
      socket.off('point',   onPoint)
      socket.off('rb_line', onRBLine)
      socket.off('marker',  onMarker)
      socket.off('casevac', onCasevac)
      socket.disconnect()
    }
  }, [upsertEud, appendTrack, upsertShape])
}
```

- [ ] **Krok 4: Zaimplementuj useMapState.ts**

```typescript
import { useEffect } from 'react'
import axios from 'axios'
import { useMapStore } from './useMapStore'

export function useMapState() {
  const hydrate = useMapStore((s) => s.hydrate)

  useEffect(() => {
    axios
      .get('/api/map_state')
      .then((r) => { if (r.status === 200) hydrate(r.data) })
      .catch((err) => console.error('[MapTAK] map_state error:', err))
  }, [hydrate])
}
```

- [ ] **Krok 5: Zaimplementuj useMissions.ts**

```typescript
import { useEffect } from 'react'
import axios from 'axios'
import { useMapStore } from './useMapStore'
import type { Mission } from '../types/maptak.types'

export function useMissions() {
  const setMissions = useMapStore((s) => s.setMissions)

  useEffect(() => {
    const fetch = () =>
      axios
        .get('/api/missions')
        .then((r) => {
          if (r.status === 200) {
            // API może zwracać { missions: [...] } lub bezpośrednio [...]
            const data: Mission[] = Array.isArray(r.data) ? r.data : (r.data.missions ?? [])
            setMissions(data)
          }
        })
        .catch((err) => console.error('[MapTAK] missions error:', err))

    fetch()
    const id = setInterval(fetch, 30_000)
    return () => clearInterval(id)
  }, [setMissions])
}
```

- [ ] **Krok 6: Uruchom testy**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npm run test -- --run src/hooks/
```

Oczekiwany wynik: `10 tests passed`

- [ ] **Krok 7: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/hooks/
git commit -m "feat: data hooks — useSocketEvents, useMapState, useMissions"
```

---

## Task 7: MapCore + LayerControl + LiveIndicator + MapController

**Files:**
- Create: `maptak-ui/src/map/MapCore.tsx`
- Create: `maptak-ui/src/map/MapController.tsx`
- Create: `maptak-ui/src/components/LayerControl.tsx`
- Create: `maptak-ui/src/components/LiveIndicator.tsx`

- [ ] **Krok 1: Utwórz maptak-ui/src/components/LiveIndicator.tsx**

```typescript
import { useEffect, useState } from 'react'
import { socket } from '../socket'

export default function LiveIndicator() {
  const [connected, setConnected] = useState(socket.connected)

  useEffect(() => {
    const onConnect    = () => setConnected(true)
    const onDisconnect = () => setConnected(false)
    socket.on('connect',    onConnect)
    socket.on('disconnect', onDisconnect)
    return () => {
      socket.off('connect',    onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  return (
    <div style={{
      position: 'absolute', top: 10, left: 10, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', borderRadius: 12,
      padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, pointerEvents: 'none',
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: connected ? '#00ff88' : '#ff4444',
        display: 'inline-block',
      }} />
      <span style={{ color: connected ? '#00ff88' : '#ff4444', fontWeight: 600 }}>
        {connected ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  )
}
```

- [ ] **Krok 2: Utwórz maptak-ui/src/components/LayerControl.tsx**

```typescript
import { LayersControl, TileLayer, WMSTileLayer } from 'react-leaflet'

const SAVED_LAYER_KEY = 'maptak:baseLayer'

const BASE_LAYERS = [
  { name: 'OSM',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  { name: 'Google Streets',
    url: 'http://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', attribution: '' },
  { name: 'Google Hybrid',
    url: 'http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga', attribution: '' },
  { name: 'Google Terrain',
    url: 'http://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', attribution: '' },
  { name: 'ESRI Imagery',
    url: 'http://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '' },
  { name: 'ESRI Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '' },
]

const savedLayer = (() => {
  try { return localStorage.getItem(SAVED_LAYER_KEY) ?? 'OSM' } catch { return 'OSM' }
})()

export default function LayerControl() {
  return (
    <LayersControl position="topright">
      {BASE_LAYERS.map((layer) => (
        <LayersControl.BaseLayer
          key={layer.name}
          name={layer.name}
          checked={layer.name === savedLayer}
        >
          <TileLayer
            attribution={layer.attribution}
            url={layer.url}
            maxZoom={20}
            eventHandlers={{ add: () => {
              try { localStorage.setItem(SAVED_LAYER_KEY, layer.name) } catch { /* */ }
            }}}
          />
        </LayersControl.BaseLayer>
      ))}
      <LayersControl.Overlay name="Pogoda (NEXRAD)">
        <WMSTileLayer
          url="http://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi"
          params={{ layers: 'nexrad-n0r-900913', format: 'image/png', transparent: true }}
          attribution="Weather © IEM"
          pane="overlayPane"
        />
      </LayersControl.Overlay>
      <LayersControl.Overlay name="Google Roads Overlay">
        <TileLayer
          url="http://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}"
          pane="overlayPane"
        />
      </LayersControl.Overlay>
    </LayersControl>
  )
}
```

- [ ] **Krok 3: Utwórz maptak-ui/src/map/MapController.tsx**

```typescript
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { useMapStore } from '../hooks/useMapStore'

/** Musi być wewnątrz <MapContainer>. Obsługuje flyTo i follow. */
export default function MapController() {
  const map      = useMap()
  const euds     = useMapStore((s) => s.euds)
  const followUid = useMapStore((s) => s.followUid)

  // Centrowanie przez CustomEvent z UnitDetailPanel
  useEffect(() => {
    const handler = (e: CustomEvent<{ uid: string }>) => {
      const eud = euds[e.detail.uid]
      if (eud?.point?.latitude != null && eud?.point?.longitude != null) {
        map.flyTo([eud.point.latitude, eud.point.longitude], 14)
      }
    }
    window.addEventListener('maptak:flyto', handler as EventListener)
    return () => window.removeEventListener('maptak:flyto', handler as EventListener)
  }, [map, euds])

  // Auto-follow wybranej jednostki
  useEffect(() => {
    if (!followUid) return
    const eud = euds[followUid]
    if (eud?.point?.latitude != null && eud?.point?.longitude != null) {
      map.panTo([eud.point.latitude, eud.point.longitude])
    }
  }, [map, euds, followUid])

  return null
}
```

- [ ] **Krok 4: Utwórz maptak-ui/src/map/MapCore.tsx**

Najpierw stwórz placeholder pliki dla warstw (żeby TypeScript nie zwracał błędów przed Task 8-10):

```bash
echo "export default function EudLayer() { return null }" > /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui/src/map/EudLayer.tsx
echo "export default function TrackLayer() { return null }" > /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui/src/map/TrackLayer.tsx
echo "export default function ShapeLayer() { return null }" > /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui/src/map/ShapeLayer.tsx
```

Następnie utwórz `maptak-ui/src/map/MapCore.tsx`:

```typescript
import { MapContainer, ScaleControl } from 'react-leaflet'
import LayerControl from '../components/LayerControl'
import EudLayer from './EudLayer'
import TrackLayer from './TrackLayer'
import ShapeLayer from './ShapeLayer'
import MapController from './MapController'

export default function MapCore() {
  return (
    <MapContainer
      center={[20, 0]}
      zoom={3}
      scrollWheelZoom
      style={{ height: '100%', width: '100%' }}
    >
      <LayerControl />
      <EudLayer />
      <TrackLayer />
      <ShapeLayer />
      <MapController />
      <ScaleControl position="bottomright" />
    </MapContainer>
  )
}

- [ ] **Krok 5: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/map/ maptak-ui/src/components/LayerControl.tsx maptak-ui/src/components/LiveIndicator.tsx
git commit -m "feat: MapCore, MapController (flyTo/follow), LayerControl, LiveIndicator"
```

---

## Task 8: EudLayer

**Files:**
- Modify: `maptak-ui/src/map/EudLayer.tsx` (zastąp placeholder)
- Create: `maptak-ui/src/map/EudLayer.test.tsx`

- [ ] **Krok 1: Napisz failing test**

Utwórz `maptak-ui/src/map/EudLayer.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import EudLayer from './EudLayer'
import { useMapStore } from '../hooks/useMapStore'
import L from 'leaflet'

beforeEach(() => {
  useMapStore.setState({
    euds: {}, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all',
  })
  vi.clearAllMocks()
})

it('nie renderuje markerów gdy brak EUD', () => {
  render(<EudLayer />)
  expect(L.default.marker).not.toHaveBeenCalled()
})

it('tworzy marker dla EUD z pozycją', () => {
  const eud = {
    uid: 'e-1', callsign: 'BRAVO', last_status: 'Connected' as const,
    last_event_time: '2026-06-15T20:00:00', mil_std_2525c: null,
    team: null, role: null, type: null, icon: null,
    point: { latitude: 52.2, longitude: 21.0, altitude: null,
             speed: null, course: null, azimuth: null, fov: null, timestamp: null },
  }
  useMapStore.setState({ euds: { 'e-1': eud } })
  render(<EudLayer />)
  expect(L.default.marker).toHaveBeenCalledWith([52.2, 21.0], expect.any(Object))
})

it('pomija EUD bez pozycji', () => {
  const eud = {
    uid: 'e-2', callsign: 'NO-POS', last_status: 'Connected' as const,
    last_event_time: null, mil_std_2525c: null,
    team: null, role: null, type: null, icon: null, point: null,
  }
  useMapStore.setState({ euds: { 'e-2': eud } })
  render(<EudLayer />)
  expect(L.default.marker).not.toHaveBeenCalled()
})
```

- [ ] **Krok 2: Uruchom test — powinien failować**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npm run test -- --run src/map/EudLayer.test.tsx
```

Oczekiwany wynik: testy przechodzą (placeholder zwraca null, marker nie tworzony) — ale test `tworzy marker` FAIL bo placeholder nic nie robi.

- [ ] **Krok 3: Zaimplementuj EudLayer.tsx**

```typescript
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-rotatedmarker'
import 'leaflet.marker.slideto'
import * as milsymbolLib from 'milsymbol'
import { useMapStore } from '../hooks/useMapStore'
import type { EUD, EUDPoint } from '../types/maptak.types'

const milsymbol = (milsymbolLib as any).default ?? milsymbolLib

export default function EudLayer() {
  const map       = useMap()
  const euds      = useMapStore((s) => s.euds)
  const selectUnit = useMapStore((s) => s.selectUnit)
  const markersRef = useRef<Record<string, L.Marker>>({})
  const layerRef   = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  useEffect(() => {
    if (!layerRef.current) return

    Object.values(euds).forEach((eud) => {
      if (!eud.point?.latitude || !eud.point?.longitude) return

      const latlng: L.LatLngExpression = [eud.point.latitude, eud.point.longitude]
      const icon = buildIcon(eud)

      if (markersRef.current[eud.uid]) {
        const m = markersRef.current[eud.uid]
        ;(m as any).slideTo?.(latlng, { duration: 2000, keepAtCenter: false })
        m.setIcon(icon)
        if (eud.point.course != null) {
          ;(m as any).setRotationAngle?.(eud.point.course)
        }
      } else {
        const m = L.marker(latlng, { icon })
        if (eud.point.course != null) {
          ;(m.options as any).rotationAngle = eud.point.course
        }
        m.on('click', () => selectUnit(eud.uid))
        m.bindTooltip(eud.callsign, { permanent: false, direction: 'top' })
        m.addTo(layerRef.current!)
        markersRef.current[eud.uid] = m
      }
    })
  }, [euds, selectUnit])

  return null
}

function buildIcon(eud: EUD): L.DivIcon | L.Icon {
  if (eud.mil_std_2525c) {
    const opts: { size: number; direction?: number } = { size: 25 }
    if (eud.point?.course != null) opts.direction = eud.point.course
    try {
      const sym = new milsymbol.Symbol(eud.mil_std_2525c, opts)
      return L.divIcon({
        className: '',
        html: sym.asSVG(),
        iconAnchor: new L.Point(sym.getAnchor().x, sym.getAnchor().y),
      })
    } catch { /* fallback */ }
  }

  if (eud.icon?.bitmap) {
    return L.icon({
      iconUrl: eud.icon.bitmap,
      shadowUrl: eud.icon.shadow,
      iconAnchor: [12, 24],
    })
  }

  const online = eud.last_status === 'Connected'
  const label  = (eud.callsign ?? '?').slice(0, 2).toUpperCase()
  const color  = online ? '#00ff88' : '#555'
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:4px;background:#1a2744;border:2px solid ${color};display:flex;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;font-size:9px;font-weight:700;color:${color}">${label}</div>`,
    iconAnchor: [12, 12],
  })
}
```

- [ ] **Krok 4: Uruchom testy**

```bash
npm run test -- --run src/map/EudLayer.test.tsx
```

Oczekiwany wynik: `3 tests passed`

- [ ] **Krok 5: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/map/EudLayer.tsx maptak-ui/src/map/EudLayer.test.tsx
git commit -m "feat: EudLayer — MIL-STD-2525C markery, rotacja, slideTo, fallback divIcon"
```

---

## Task 9: TrackLayer

**Files:**
- Modify: `maptak-ui/src/map/TrackLayer.tsx`
- Create: `maptak-ui/src/map/TrackLayer.test.tsx`

- [ ] **Krok 1: Napisz failing test**

Utwórz `maptak-ui/src/map/TrackLayer.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import TrackLayer from './TrackLayer'
import { useMapStore } from '../hooks/useMapStore'
import L from 'leaflet'

beforeEach(() => {
  useMapStore.setState({ euds: {}, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all' })
  vi.clearAllMocks()
})

it('nie tworzy polyline gdy ślad < 2 punkty', () => {
  useMapStore.setState({ tracks: { 'u1': [[52, 21]] } })
  render(<TrackLayer />)
  expect(L.default.polyline).not.toHaveBeenCalled()
})

it('tworzy N-1 segmentów dla N punktów', () => {
  useMapStore.setState({
    tracks: { 'u1': [[52, 21], [52.1, 21.1], [52.2, 21.2]] },
  })
  render(<TrackLayer />)
  expect(L.default.polyline).toHaveBeenCalledTimes(2) // 3 pkt → 2 segmenty
})

it('ostatni segment ma najwyższą opacity (≥ 0.9)', () => {
  useMapStore.setState({
    tracks: { 'u1': [[52, 21], [52.1, 21.1], [52.2, 21.2]] },
  })
  render(<TrackLayer />)
  const calls = (L.default.polyline as ReturnType<typeof vi.fn>).mock.calls
  const lastOpacity = calls[calls.length - 1][1].opacity
  expect(lastOpacity).toBeGreaterThanOrEqual(0.9)
})
```

- [ ] **Krok 2: Uruchom test — powinien failować**

```bash
npm run test -- --run src/map/TrackLayer.test.tsx
```

Oczekiwany wynik: `tworzy N-1 segmentów` i `ostatni segment` FAIL (placeholder zwraca null).

- [ ] **Krok 3: Zaimplementuj TrackLayer.tsx**

```typescript
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../hooks/useMapStore'

export default function TrackLayer() {
  const map      = useMap()
  const tracks   = useMapStore((s) => s.tracks)
  const segsRef  = useRef<Record<string, L.Polyline[]>>({})
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  useEffect(() => {
    if (!layerRef.current) return

    // Usuń poprzednie segmenty
    Object.values(segsRef.current).flat().forEach((p) => p.remove())
    segsRef.current = {}

    Object.entries(tracks).forEach(([uid, pts]) => {
      if (pts.length < 2) return
      const segments: L.Polyline[] = []
      for (let i = 1; i < pts.length; i++) {
        const opacity = 0.15 + (i / (pts.length - 1)) * 0.85
        const seg = L.polyline([pts[i - 1], pts[i]], {
          color: '#00ff88',
          weight: 2,
          opacity,
        }).addTo(layerRef.current!)
        segments.push(seg)
      }
      segsRef.current[uid] = segments
    })
  }, [tracks])

  return null
}
```

- [ ] **Krok 4: Uruchom testy**

```bash
npm run test -- --run src/map/TrackLayer.test.tsx
```

Oczekiwany wynik: `3 tests passed`

- [ ] **Krok 5: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/map/TrackLayer.tsx maptak-ui/src/map/TrackLayer.test.tsx
git commit -m "feat: TrackLayer — ślady gradientowe (opacity 0.15→1.0), max 50 pkt/unit"
```

---

## Task 10: ShapeLayer

**Files:**
- Modify: `maptak-ui/src/map/ShapeLayer.tsx`
- Create: `maptak-ui/src/map/ShapeLayer.test.tsx`

- [ ] **Krok 1: Napisz failing test**

Utwórz `maptak-ui/src/map/ShapeLayer.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import ShapeLayer from './ShapeLayer'
import { useMapStore } from '../hooks/useMapStore'
import L from 'leaflet'

beforeEach(() => {
  useMapStore.setState({ euds: {}, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all' })
  vi.clearAllMocks()
})

it('renderuje rb_line jako polyline', () => {
  useMapStore.setState({ shapes: [{
    uid: 's1', name: 'RB', type: 'rb_line',
    points: [[52, 21], [52.1, 21.1]], meta: '45° / 500m',
  }]})
  render(<ShapeLayer />)
  expect(L.default.polyline).toHaveBeenCalledOnce()
})

it('renderuje polygon jako L.polygon', () => {
  useMapStore.setState({ shapes: [{
    uid: 's2', name: 'Zone', type: 'polygon',
    points: [[52, 21], [53, 21], [53, 22]], meta: null,
  }]})
  render(<ShapeLayer />)
  expect(L.default.polygon).toHaveBeenCalledOnce()
})

it('renderuje waypoint jako circleMarker', () => {
  useMapStore.setState({ shapes: [{
    uid: 's3', name: 'WP1', type: 'waypoint',
    points: [[52, 21]], meta: null,
  }]})
  render(<ShapeLayer />)
  expect(L.default.circleMarker).toHaveBeenCalledOnce()
})
```

- [ ] **Krok 2: Uruchom test — powinny failować**

```bash
npm run test -- --run src/map/ShapeLayer.test.tsx
```

- [ ] **Krok 3: Zaimplementuj ShapeLayer.tsx**

```typescript
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { useMapStore } from '../hooks/useMapStore'

export default function ShapeLayer() {
  const map      = useMap()
  const shapes   = useMapStore((s) => s.shapes)
  const layerRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    layerRef.current = L.layerGroup().addTo(map)
    return () => { layerRef.current?.remove() }
  }, [map])

  useEffect(() => {
    if (!layerRef.current) return
    layerRef.current.clearLayers()

    shapes.forEach((shape) => {
      if (!layerRef.current) return

      if (shape.type === 'rb_line' && shape.points.length >= 2) {
        L.polyline(shape.points, { color: '#ffd700', weight: 2 })
          .bindPopup(`<b>${shape.name}</b>${shape.meta ? `<br>${shape.meta}` : ''}`)
          .addTo(layerRef.current)

      } else if ((shape.type === 'polygon') && shape.points.length >= 3) {
        L.polygon(shape.points, { color: '#ff4444', fillOpacity: 0.15, dashArray: '6, 3' })
          .bindPopup(`<b>${shape.name}</b>`)
          .addTo(layerRef.current)

      } else if ((shape.type === 'waypoint' || shape.type === 'casevac') && shape.points.length >= 1) {
        const color = shape.type === 'casevac' ? '#ff4444' : '#ffd700'
        L.circleMarker(shape.points[0], { radius: 6, color, fillOpacity: 0.8 })
          .bindPopup(`<b>${shape.name}</b>`)
          .addTo(layerRef.current)
      }
    })
  }, [shapes])

  return null
}
```

- [ ] **Krok 4: Uruchom testy**

```bash
npm run test -- --run src/map/ShapeLayer.test.tsx
```

Oczekiwany wynik: `3 tests passed`

- [ ] **Krok 5: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/map/ShapeLayer.tsx maptak-ui/src/map/ShapeLayer.test.tsx
git commit -m "feat: ShapeLayer — rb_lines, polygony CoT, waypoints, casevac markery"
```

---

## Task 11: UnitSidebar

**Files:**
- Create: `maptak-ui/src/components/UnitSidebar.tsx`
- Create: `maptak-ui/src/components/UnitSidebar.module.css`
- Create: `maptak-ui/src/components/UnitSidebar.test.tsx`

- [ ] **Krok 1: Napisz failing testy**

Utwórz `maptak-ui/src/components/UnitSidebar.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UnitSidebar from './UnitSidebar'
import { useMapStore } from '../hooks/useMapStore'

const eudOnline = {
  uid: 'a1', callsign: 'ALPHA', last_status: 'Connected' as const,
  last_event_time: '2026-06-15T20:00:00', mil_std_2525c: null,
  team: null, role: null, type: null, icon: null,
  point: { latitude: 52, longitude: 21, altitude: null,
           speed: null, course: null, azimuth: null, fov: null, timestamp: null },
}

const eudOffline = {
  uid: 'b2', callsign: 'BRAVO', last_status: 'Disconnected' as const,
  last_event_time: '2026-06-15T19:00:00', mil_std_2525c: null,
  team: null, role: null, type: null, icon: null, point: null,
}

beforeEach(() => {
  useMapStore.setState({
    euds: { a1: eudOnline, b2: eudOffline }, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all',
  })
})

it('wyświetla callsigny EUD', () => {
  render(<UnitSidebar />)
  expect(screen.getByText('ALPHA')).toBeInTheDocument()
  expect(screen.getByText('BRAVO')).toBeInTheDocument()
})

it('online przed offline w liście', () => {
  render(<UnitSidebar />)
  const items = screen.getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('ALPHA')
  expect(items[1]).toHaveTextContent('BRAVO')
})

it('filtruje po callsign', () => {
  render(<UnitSidebar />)
  const input = screen.getByPlaceholderText(/szukaj/i)
  fireEvent.change(input, { target: { value: 'alp' } })
  expect(screen.getByText('ALPHA')).toBeInTheDocument()
  expect(screen.queryByText('BRAVO')).not.toBeInTheDocument()
})

it('klik na EUD ustawia selectedUid w store', () => {
  render(<UnitSidebar />)
  fireEvent.click(screen.getByText('ALPHA'))
  expect(useMapStore.getState().selectedUid).toBe('a1')
})

it('wyświetla licznik online/offline', () => {
  render(<UnitSidebar />)
  expect(screen.getByText(/1/)).toBeInTheDocument() // online
})
```

- [ ] **Krok 2: Uruchom testy — powinny failować**

```bash
npm run test -- --run src/components/UnitSidebar.test.tsx
```

- [ ] **Krok 3: Utwórz UnitSidebar.module.css**

```css
.sidebar {
  display: flex;
  flex-direction: column;
  background: #16213e;
  border-right: 1px solid #0f3460;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

.header {
  padding: 8px 12px;
  background: #0f3460;
  font-size: 11px;
  font-weight: 700;
  color: #e94560;
  letter-spacing: 1px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.filters {
  padding: 6px 8px;
  background: #0d1b2a;
  flex-shrink: 0;
}

.search {
  width: 100%;
  padding: 4px 8px;
  background: #0f3460;
  border: 1px solid #1a4a8a;
  border-radius: 4px;
  color: #a0c4ff;
  font-size: 11px;
  font-family: inherit;
  outline: none;
}

.search::placeholder { color: #4a6a8a; }

.toggles {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.toggle {
  background: #1a2744;
  border: 1px solid #0f3460;
  border-radius: 10px;
  color: #888;
  font-size: 9px;
  font-family: inherit;
  padding: 2px 7px;
  cursor: pointer;
}

.toggle.active {
  background: #0f3460;
  color: #a0c4ff;
  border-color: #1a4a8a;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.eudRow {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 12px;
  border-bottom: 1px solid #0f3460;
  cursor: pointer;
}

.eudRow:hover { background: #1a2744; }
.eudRow.selected { background: #1a2744; border-left: 2px solid #58a6ff; }

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 3px;
}

.dotOnline  { background: #00ff88; }
.dotOffline { background: #555; }

.callsign {
  font-size: 11px;
  font-weight: 600;
  color: #e0e0e0;
}

.meta {
  font-size: 9px;
  color: #555;
  margin-top: 1px;
}

.missionRow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-bottom: 1px solid #0a1520;
  font-size: 10px;
  color: #ffd700;
}

.missionIcon { font-size: 12px; }
.missionName { color: #ffd700; font-weight: 600; }

.footer {
  padding: 6px 12px;
  background: #0f3460;
  font-size: 10px;
  color: #888;
  border-top: 1px solid #1a4a8a;
  flex-shrink: 0;
}

.online  { color: #00ff88; }
.offline { color: #ff4444; }
.mission { color: #ffd700; }
```

- [ ] **Krok 4: Zaimplementuj UnitSidebar.tsx**

```typescript
import { useMemo } from 'react'
import { useMapStore } from '../hooks/useMapStore'
import type { EUD, FilterType, Mission } from '../types/maptak.types'
import styles from './UnitSidebar.module.css'

export default function UnitSidebar() {
  const euds         = useMapStore((s) => s.euds)
  const missions     = useMapStore((s) => s.missions)
  const filterQuery  = useMapStore((s) => s.filterQuery)
  const filterType   = useMapStore((s) => s.filterType)
  const selectedUid  = useMapStore((s) => s.selectedUid)
  const selectUnit   = useMapStore((s) => s.selectUnit)
  const setFilterQuery = useMapStore((s) => s.setFilterQuery)
  const setFilterType  = useMapStore((s) => s.setFilterType)

  const eudList = useMemo(() => {
    return Object.values(euds)
      .filter((e) =>
        !filterQuery ||
        e.callsign.toLowerCase().includes(filterQuery.toLowerCase()),
      )
      .sort((a, b) => {
        if (a.last_status !== b.last_status) {
          return a.last_status === 'Connected' ? -1 : 1
        }
        return (b.last_event_time ?? '').localeCompare(a.last_event_time ?? '')
      })
  }, [euds, filterQuery])

  const onlineCount  = Object.values(euds).filter((e) => e.last_status === 'Connected').length
  const offlineCount = Object.values(euds).length - onlineCount

  const FILTER_LABELS: Record<FilterType, string> = {
    all: 'Wszystko', eud: 'EUD', mission: 'Misje', shape: 'Kształty',
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>JEDNOSTKI / MISJE</div>

      <div className={styles.filters}>
        <input
          className={styles.search}
          placeholder="Szukaj callsign..."
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
        />
        <div className={styles.toggles}>
          {(Object.keys(FILTER_LABELS) as FilterType[]).map((t) => (
            <button
              key={t}
              className={`${styles.toggle} ${filterType === t ? styles.active : ''}`}
              onClick={() => setFilterType(t)}
            >
              {FILTER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <ul className={styles.list}>
        {(filterType === 'all' || filterType === 'eud') &&
          eudList.map((eud) => (
            <EudRow
              key={eud.uid}
              eud={eud}
              selected={selectedUid === eud.uid}
              onSelect={() => selectUnit(eud.uid)}
            />
          ))}
        {(filterType === 'all' || filterType === 'mission') &&
          missions.map((m) => <MissionRow key={m.uid} mission={m} />)}
      </ul>

      <div className={styles.footer}>
        <span className={styles.online}>● {onlineCount}</span>&nbsp;online&nbsp;
        <span className={styles.offline}>● {offlineCount}</span>&nbsp;offline&nbsp;
        <span className={styles.mission}>● {missions.length}</span>&nbsp;misje
      </div>
    </aside>
  )
}

function EudRow({ eud, selected, onSelect }: {
  eud: EUD; selected: boolean; onSelect: () => void
}) {
  const online = eud.last_status === 'Connected'
  const posStr = eud.point
    ? `${eud.point.latitude.toFixed(4)}°, ${eud.point.longitude.toFixed(4)}°`
    : '—'
  return (
    <li className={`${styles.eudRow} ${selected ? styles.selected : ''}`} onClick={onSelect}>
      <span className={`${styles.dot} ${online ? styles.dotOnline : styles.dotOffline}`} />
      <div>
        <div className={styles.callsign}>{eud.callsign}</div>
        <div className={styles.meta}>{eud.type ?? ''} · {posStr}</div>
      </div>
    </li>
  )
}

function MissionRow({ mission }: { mission: Mission }) {
  return (
    <li className={styles.missionRow}>
      <span className={styles.missionIcon}>📋</span>
      <span className={styles.missionName}>{mission.name}</span>
    </li>
  )
}
```

- [ ] **Krok 5: Uruchom testy**

```bash
npm run test -- --run src/components/UnitSidebar.test.tsx
```

Oczekiwany wynik: `5 tests passed`

- [ ] **Krok 6: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/components/UnitSidebar.tsx maptak-ui/src/components/UnitSidebar.module.css maptak-ui/src/components/UnitSidebar.test.tsx
git commit -m "feat: UnitSidebar — lista EUD/misji, filtrowanie, sortowanie online/offline"
```

---

## Task 12: UnitDetailPanel

**Files:**
- Create: `maptak-ui/src/components/UnitDetailPanel.tsx`
- Create: `maptak-ui/src/components/UnitDetailPanel.module.css`
- Create: `maptak-ui/src/components/UnitDetailPanel.test.tsx`

- [ ] **Krok 1: Napisz failing testy**

Utwórz `maptak-ui/src/components/UnitDetailPanel.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import UnitDetailPanel from './UnitDetailPanel'
import { useMapStore } from '../hooks/useMapStore'

const eud = {
  uid: 'x1', callsign: 'XRAY', last_status: 'Connected' as const,
  last_event_time: null, mil_std_2525c: null,
  team: 'Cyan', role: 'TL', type: 'SFGP', icon: null,
  point: { latitude: 52.2297, longitude: 21.0122, altitude: 112,
           speed: 34, course: 47, azimuth: null, fov: null, timestamp: null },
}

beforeEach(() => {
  useMapStore.setState({
    euds: { x1: eud }, tracks: {}, shapes: [], missions: [],
    selectedUid: null, followUid: null, filterQuery: '', filterType: 'all',
  })
})

it('nie renderuje gdy brak selectedUid', () => {
  const { container } = render(<UnitDetailPanel />)
  expect(container.firstChild).toBeNull()
})

it('wyświetla dane EUD gdy selectedUid ustawiony', () => {
  useMapStore.setState({ selectedUid: 'x1' })
  render(<UnitDetailPanel />)
  expect(screen.getByText('XRAY')).toBeInTheDocument()
  expect(screen.getByText('52.229700°')).toBeInTheDocument()
  expect(screen.getByText('Cyan')).toBeInTheDocument()
})

it('przycisk Zamknij czyści selectedUid', () => {
  useMapStore.setState({ selectedUid: 'x1' })
  render(<UnitDetailPanel />)
  fireEvent.click(screen.getByText('✕'))
  expect(useMapStore.getState().selectedUid).toBeNull()
})

it('przycisk Śledź ustawia followUid', () => {
  useMapStore.setState({ selectedUid: 'x1' })
  render(<UnitDetailPanel />)
  fireEvent.click(screen.getByText('Śledź'))
  expect(useMapStore.getState().followUid).toBe('x1')
})

it('drugi klik Śledź wyłącza śledzenie', () => {
  useMapStore.setState({ selectedUid: 'x1', followUid: 'x1' })
  render(<UnitDetailPanel />)
  fireEvent.click(screen.getByText(/Śledź/))
  expect(useMapStore.getState().followUid).toBeNull()
})
```

- [ ] **Krok 2: Uruchom test — powinny failować**

```bash
npm run test -- --run src/components/UnitDetailPanel.test.tsx
```

- [ ] **Krok 3: Utwórz UnitDetailPanel.module.css**

```css
.panel {
  display: flex;
  flex-direction: column;
  background: #16213e;
  border-left: 1px solid #0f3460;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #0f3460;
  font-size: 12px;
  font-weight: 700;
  color: #f0f6fc;
  flex-shrink: 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.online  { background: #00ff88; }
.offline { background: #555; }

.close {
  margin-left: auto;
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
}

.close:hover { color: #f0f6fc; }

.body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px;
}

.section { margin-bottom: 12px; }

.sectionLabel {
  font-size: 10px;
  font-weight: 700;
  color: #58a6ff;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2px 8px;
}

.label { font-size: 11px; color: #484f58; }
.value { font-size: 11px; color: #c9d1d9; }

.actions {
  display: flex;
  gap: 6px;
  padding: 8px 10px;
  border-top: 1px solid #0f3460;
  flex-shrink: 0;
}

.btn {
  flex: 1;
  background: #0f3460;
  border: 1px solid #1a4a8a;
  border-radius: 4px;
  color: #a0c4ff;
  font-size: 11px;
  font-family: inherit;
  padding: 5px 4px;
  cursor: pointer;
}

.btn:hover { background: #1a4a8a; color: #f0f6fc; }

.btnActive {
  background: #1a4a8a;
  color: #00ff88;
  border-color: #00ff88;
}
```

- [ ] **Krok 4: Zaimplementuj UnitDetailPanel.tsx**

```typescript
import { useMapStore } from '../hooks/useMapStore'
import styles from './UnitDetailPanel.module.css'

export default function UnitDetailPanel() {
  const euds        = useMapStore((s) => s.euds)
  const selectedUid = useMapStore((s) => s.selectedUid)
  const followUid   = useMapStore((s) => s.followUid)
  const selectUnit  = useMapStore((s) => s.selectUnit)
  const setFollowUid = useMapStore((s) => s.setFollowUid)

  const eud = selectedUid ? euds[selectedUid] : null
  if (!eud) return null

  const online = eud.last_status === 'Connected'

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={`${styles.dot} ${online ? styles.online : styles.offline}`} />
        {eud.callsign}
        <button className={styles.close} onClick={() => selectUnit(null)}>✕</button>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Pozycja</div>
          <dl className={styles.grid}>
            <dt className={styles.label}>Lat</dt>
            <dd className={styles.value}>{eud.point?.latitude?.toFixed(6) ?? '—'}°</dd>
            <dt className={styles.label}>Lon</dt>
            <dd className={styles.value}>{eud.point?.longitude?.toFixed(6) ?? '—'}°</dd>
            <dt className={styles.label}>Alt</dt>
            <dd className={styles.value}>
              {eud.point?.altitude != null ? `${eud.point.altitude} m` : '—'}
            </dd>
            <dt className={styles.label}>Speed</dt>
            <dd className={styles.value}>
              {eud.point?.speed != null ? `${eud.point.speed.toFixed(1)} km/h` : '—'}
            </dd>
            <dt className={styles.label}>Course</dt>
            <dd className={styles.value}>
              {eud.point?.course != null ? `${eud.point.course}°` : '—'}
            </dd>
          </dl>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Szczegóły</div>
          <dl className={styles.grid}>
            <dt className={styles.label}>Status</dt>
            <dd className={styles.value} style={{ color: online ? '#00ff88' : '#ff4444' }}>
              {eud.last_status}
            </dd>
            <dt className={styles.label}>Typ</dt>
            <dd className={styles.value}>{eud.type ?? '—'}</dd>
            <dt className={styles.label}>Team</dt>
            <dd className={styles.value}>{eud.team ?? '—'}</dd>
            <dt className={styles.label}>Rola</dt>
            <dd className={styles.value}>{eud.role ?? '—'}</dd>
          </dl>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.btn}
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('maptak:flyto', { detail: { uid: eud.uid } }),
            )
          }
        >
          Centruj
        </button>
        <button
          className={`${styles.btn} ${followUid === eud.uid ? styles.btnActive : ''}`}
          onClick={() => setFollowUid(followUid === eud.uid ? null : eud.uid)}
        >
          {followUid === eud.uid ? 'Śledź ✓' : 'Śledź'}
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Krok 5: Uruchom testy**

```bash
npm run test -- --run src/components/UnitDetailPanel.test.tsx
```

Oczekiwany wynik: `5 tests passed`

- [ ] **Krok 6: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/components/UnitDetailPanel.tsx maptak-ui/src/components/UnitDetailPanel.module.css maptak-ui/src/components/UnitDetailPanel.test.tsx
git commit -m "feat: UnitDetailPanel — pozycja/szczegóły EUD, Centruj, Śledź"
```

---

## Task 13: App.tsx — integracja całości

**Files:**
- Create: `maptak-ui/src/App.tsx`
- Create: `maptak-ui/src/App.module.css`

- [ ] **Krok 1: Utwórz App.module.css**

```css
.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  height: 100vh;
  overflow: hidden;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.layoutWithPanel {
  grid-template-columns: 240px 1fr 220px;
}

.mapWrapper {
  position: relative;
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Krok 2: Utwórz App.tsx**

```typescript
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
```

- [ ] **Krok 3: Sprawdź że TypeScript kompiluje się bez błędów**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npx tsc --noEmit 2>&1
```

Oczekiwany wynik: brak błędów (lub tylko ostrzeżenia o `any`)

- [ ] **Krok 4: Uruchom pełny suite testów**

```bash
npm run test -- --run
```

Oczekiwany wynik: wszystkie testy przechodzą (min. 25 passed)

- [ ] **Krok 5: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/App.tsx maptak-ui/src/App.module.css
git commit -m "feat: App.tsx — grid layout, integracja wszystkich komponentów i hooków"
```

---

## Task 14: Build pipeline — .whl

**Files:**
- Modify: `.gitignore` (sprawdź)

- [ ] **Krok 1: Zbuduj React SPA**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npm run build
```

Oczekiwany wynik: katalog `../ots_maptak/ui/` zawiera `index.html` i `assets/`.

```bash
ls /Volumes/Drewutnia/web/OpenTAKIntel/ots_maptak/ui/
# Oczekiwane: index.html  assets/
ls /Volumes/Drewutnia/web/OpenTAKIntel/ots_maptak/ui/assets/
# Oczekiwane: index-[hash].js  index-[hash].css
```

- [ ] **Krok 2: Sprawdź że index.html referuje aktywa przez właściwy base path**

```bash
grep 'src=' /Volumes/Drewutnia/web/OpenTAKIntel/ots_maptak/ui/index.html
```

Oczekiwany wynik: ścieżki zaczynają się od `/api/plugins/ots_maptak/assets/`

Jeśli ścieżki są błędne (zaczynają się od `/` lub `./`), sprawdź `base` w `vite.config.ts` — powinno być `/api/plugins/ots_maptak/`.

- [ ] **Krok 3: Zainicjuj git tag (wymagany przez poetry-dynamic-versioning)**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git tag v1.0.0
```

- [ ] **Krok 4: Zainstaluj Poetry i zbuduj .whl**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
# Sprawdź czy poetry jest zainstalowane
poetry --version || pip install poetry

poetry install
poetry build
```

Oczekiwany wynik:
```
Building ots-maptak (1.0.0)
  - Building wheel
  - Built ots_maptak-1.0.0-py3-none-any.whl
```

- [ ] **Krok 5: Sprawdź zawartość .whl**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
python3 -c "
import zipfile, sys
with zipfile.ZipFile('dist/ots_maptak-1.0.0-py3-none-any.whl') as z:
    ui_files = [f for f in z.namelist() if 'ui/' in f]
    print(f'UI files in .whl: {len(ui_files)}')
    for f in ui_files[:5]: print(' ', f)
    py_files = [f for f in z.namelist() if f.endswith('.py')]
    print('Python files:', py_files)
"
```

Oczekiwany wynik:
```
UI files in .whl: 3+
  ots_maptak/ui/index.html
  ots_maptak/ui/assets/index-[hash].js
  ...
Python files: ['ots_maptak/__init__.py', 'ots_maptak/app.py', 'ots_maptak/default_config.py']
```

Jeśli `UI files: 0` — sprawdź `pyproject.toml` sekcję `[tool.poetry]` include.

- [ ] **Krok 6: Uruchom pełne testy (Vitest + pytest)**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
make test
```

Oczekiwany wynik: wszystkie testy Python i JS przechodzą.

- [ ] **Krok 7: Commit końcowy**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add .
git commit -m "feat: build pipeline — make package generuje .whl z UI gotowym do instalacji"
```

---

## Instrukcja instalacji na serwerze

Po zbudowaniu (`make package`):

1. Prześlij `dist/ots_maptak-1.0.0-py3-none-any.whl` na serwer
2. OpenTAK UI → **Server Plugin Manager** → **Upload Plugin** → wybierz plik `.whl`
3. Poczekaj na komunikat sukcesu → **restart OpenTAKServer**
4. Odśwież przeglądarkę
5. Nawiguj: **Plugins** → **MapTAK** → zakładka **UI**

Aktualizacja pluginu: powtórz kroki 1-5. Bazowy OpenTAK UI pozostaje niezmieniony.
