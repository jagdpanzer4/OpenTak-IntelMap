# Data Management Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Dane" top-level view to MapTAK plugin with 5 sub-tabs (EUD, Markery, Trasy, Kształty, SPI) for listing, filtering, and deleting objects stored on the OpenTAK server.

**Architecture:** New top-nav bar in `App.tsx` switches between existing map layout and a full-width `DataManager` component. Backend adds 5 GET list endpoints and 3 DELETE endpoints (EUD, Marker, CoT) under `/api/plugins/ots_maptak/data/`. All design tokens match existing sidebar (`#16213e`, `#0f3460`, `#e94560`, Inter).

**Tech Stack:** Python/Flask (backend), React 19 + TypeScript + Vite (frontend), Vitest + @testing-library/react (JS tests), pytest (Python tests)

---

## File Map

**Created:**
- `maptak-ui/src/components/DataManager.tsx` — root: sub-tab state, toolbar, renders active panel
- `maptak-ui/src/components/DataManager.module.css` — all styles for data manager
- `maptak-ui/src/components/data/DataTable.tsx` — shared table scaffold (header, bulk select, delete button)
- `maptak-ui/src/components/data/EudTable.tsx` — EUD rows
- `maptak-ui/src/components/data/MarkerTable.tsx` — Marker rows
- `maptak-ui/src/components/data/RouteTable.tsx` — Route rows
- `maptak-ui/src/components/data/ShapeTable.tsx` — Shape rows
- `maptak-ui/src/components/data/SpiTable.tsx` — SPI rows
- `maptak-ui/src/components/DataManager.test.tsx` — integration tests
- `maptak-ui/src/components/data/EudTable.test.tsx` — EUD table unit tests
- `tests/test_data_endpoints.py` — Python endpoint tests

**Modified:**
- `ots_maptak/app.py` — 5 GET + 3 DELETE endpoints under `/data/`
- `maptak-ui/src/App.tsx` — add top-nav, view state, render DataManager
- `maptak-ui/src/App.module.css` — add topNav, navBtn styles

---

## Task 1: Backend list endpoints (GET)

**Files:**
- Modify: `ots_maptak/app.py` (after `last_positions` route, before `blueprint = ...`)

- [ ] **Step 1: Add `/data/euds` endpoint**

In `app.py`, add after the `last_positions` route (line ~305, before `blueprint = MapTAKPlugin.blueprint`):

```python
    @staticmethod
    @blueprint.route('/data/euds')
    @roles_accepted('administrator')
    def data_euds():
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.EUD import EUD
        try:
            q = request.args.get('q', '').lower()
            status = request.args.get('status', 'all')
            query = ots_db.session.query(EUD)
            if q:
                query = query.filter(EUD.callsign.ilike(f'%{q}%'))
            if status == 'online':
                query = query.filter(EUD.last_status == 'Connected')
            elif status == 'offline':
                query = query.filter(EUD.last_status != 'Connected')
            euds = query.order_by(EUD.last_event_time.desc().nullslast()).limit(500).all()
            results = []
            for e in euds:
                results.append({
                    'uid': e.uid,
                    'callsign': e.callsign or '',
                    'team': e.team or '',
                    'team_role': e.team_role or '',
                    'platform': e.platform or '',
                    'last_status': e.last_status or 'Disconnected',
                    'last_event_time': e.last_event_time.isoformat() if e.last_event_time else None,
                })
            return jsonify({'results': results, 'total': len(results)})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @staticmethod
    @blueprint.route('/data/markers')
    @roles_accepted('administrator')
    def data_markers():
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.Marker import Marker
        try:
            q = request.args.get('q', '').lower()
            query = ots_db.session.query(Marker)
            if q:
                query = query.filter(
                    (Marker.callsign.ilike(f'%{q}%')) | (Marker.type.ilike(f'%{q}%'))
                )
            markers = query.order_by(Marker.timestamp.desc().nullslast()).limit(500).all()
            results = []
            for m in markers:
                results.append({
                    'uid': m.uid,
                    'callsign': m.callsign or '',
                    'type': m.type or '',
                    'latitude': float(m.latitude) if m.latitude is not None else None,
                    'longitude': float(m.longitude) if m.longitude is not None else None,
                    'timestamp': m.timestamp.isoformat() if m.timestamp else None,
                })
            return jsonify({'results': results, 'total': len(results)})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @staticmethod
    @blueprint.route('/data/cot')
    @roles_accepted('administrator')
    def data_cot():
        """List drawn shapes (routes, polygons, SPIs) by type filter."""
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.CoT import CoT
        try:
            cot_type = request.args.get('type', 'u-d-f')
            q = request.args.get('q', '').lower()
            allowed = ['u-d-f', 'b-m-r', 'b-m-p-s-p-loc']
            if cot_type not in allowed:
                return jsonify({'error': 'invalid type'}), 400
            query = ots_db.session.query(CoT).filter(CoT.type == cot_type)
            if q:
                query = query.filter(CoT.uid.ilike(f'%{q}%'))
            cots = query.order_by(CoT.timestamp.desc().nullslast()).limit(500).all()
            results = []
            for c in cots:
                shape = _parse_cot_shape(c)
                results.append({
                    'uid': c.uid,
                    'name': shape['name'] if shape else c.uid,
                    'type': c.type,
                    'sender_uid': c.sender_uid or '',
                    'timestamp': c.timestamp.isoformat() if c.timestamp else None,
                    'color': shape.get('color') if shape else None,
                    'point_count': len(shape['points']) if shape and shape.get('points') else (
                        len(shape['waypoints']) if shape and shape.get('waypoints') else 1
                    ),
                })
            return jsonify({'results': results, 'total': len(results)})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
```

Also add `from flask import request` at the top of the file if not already there (check: it should be there via `from flask import Flask, Blueprint, jsonify, request, send_from_directory, current_app`).

- [ ] **Step 2: Verify `request` is already imported**

```bash
grep "from flask import" /Volumes/Drewutnia/web/OpenTAKIntel/ots_maptak/app.py
```
Expected: line contains `request`. If not, add it to the import.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add ots_maptak/app.py
git commit -m "feat(data): add GET /data/euds, /data/markers, /data/cot list endpoints"
```

---

## Task 2: Backend delete endpoints (DELETE)

**Files:**
- Modify: `ots_maptak/app.py`

- [ ] **Step 1: Add single + bulk DELETE for EUD**

Add after the list endpoints from Task 1:

```python
    @staticmethod
    @blueprint.route('/data/euds/<uid>', methods=['DELETE'])
    @roles_accepted('administrator')
    def delete_eud(uid):
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.EUD import EUD
        try:
            eud = ots_db.session.query(EUD).filter(EUD.uid == uid).first()
            if not eud:
                return jsonify({'error': 'not found'}), 404
            ots_db.session.delete(eud)
            ots_db.session.commit()
            return jsonify({'deleted': uid})
        except Exception as e:
            ots_db.session.rollback()
            return jsonify({'error': str(e)}), 500

    @staticmethod
    @blueprint.route('/data/euds', methods=['DELETE'])
    @roles_accepted('administrator')
    def delete_euds_bulk():
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.EUD import EUD
        try:
            uids = request.get_json(force=True).get('uids', [])
            if not uids:
                return jsonify({'deleted': []}), 200
            deleted = []
            for uid in uids:
                eud = ots_db.session.query(EUD).filter(EUD.uid == uid).first()
                if eud:
                    ots_db.session.delete(eud)
                    deleted.append(uid)
            ots_db.session.commit()
            return jsonify({'deleted': deleted})
        except Exception as e:
            ots_db.session.rollback()
            return jsonify({'error': str(e)}), 500

    @staticmethod
    @blueprint.route('/data/markers/<uid>', methods=['DELETE'])
    @roles_accepted('administrator')
    def delete_marker(uid):
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.Marker import Marker
        try:
            marker = ots_db.session.query(Marker).filter(Marker.uid == uid).first()
            if not marker:
                return jsonify({'error': 'not found'}), 404
            ots_db.session.delete(marker)
            ots_db.session.commit()
            return jsonify({'deleted': uid})
        except Exception as e:
            ots_db.session.rollback()
            return jsonify({'error': str(e)}), 500

    @staticmethod
    @blueprint.route('/data/markers', methods=['DELETE'])
    @roles_accepted('administrator')
    def delete_markers_bulk():
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.Marker import Marker
        try:
            uids = request.get_json(force=True).get('uids', [])
            deleted = []
            for uid in uids:
                m = ots_db.session.query(Marker).filter(Marker.uid == uid).first()
                if m:
                    ots_db.session.delete(m)
                    deleted.append(uid)
            ots_db.session.commit()
            return jsonify({'deleted': deleted})
        except Exception as e:
            ots_db.session.rollback()
            return jsonify({'error': str(e)}), 500

    @staticmethod
    @blueprint.route('/data/cot/<uid>', methods=['DELETE'])
    @roles_accepted('administrator')
    def delete_cot(uid):
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.CoT import CoT
        try:
            cot = ots_db.session.query(CoT).filter(CoT.uid == uid).first()
            if not cot:
                return jsonify({'error': 'not found'}), 404
            ots_db.session.delete(cot)
            ots_db.session.commit()
            return jsonify({'deleted': uid})
        except Exception as e:
            ots_db.session.rollback()
            return jsonify({'error': str(e)}), 500

    @staticmethod
    @blueprint.route('/data/cot', methods=['DELETE'])
    @roles_accepted('administrator')
    def delete_cot_bulk():
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.CoT import CoT
        try:
            uids = request.get_json(force=True).get('uids', [])
            deleted = []
            for uid in uids:
                c = ots_db.session.query(CoT).filter(CoT.uid == uid).first()
                if c:
                    ots_db.session.delete(c)
                    deleted.append(uid)
            ots_db.session.commit()
            return jsonify({'deleted': deleted})
        except Exception as e:
            ots_db.session.rollback()
            return jsonify({'error': str(e)}), 500
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add ots_maptak/app.py
git commit -m "feat(data): add DELETE endpoints for EUD, Marker, CoT (single + bulk)"
```

---

## Task 3: Python tests for data endpoints

**Files:**
- Create: `tests/test_data_endpoints.py`

- [ ] **Step 1: Create test file**

```python
# tests/test_data_endpoints.py
import pytest
from unittest.mock import MagicMock, patch
from flask import Flask
from types import SimpleNamespace
import datetime


@pytest.fixture
def app():
    from ots_maptak.app import blueprint
    a = Flask(__name__)
    a.register_blueprint(blueprint)
    a.config['TESTING'] = True
    return a


@pytest.fixture
def client(app):
    return app.test_client()


def make_eud(uid='e1', callsign='Alpha', status='Connected'):
    e = MagicMock()
    e.uid = uid
    e.callsign = callsign
    e.team = 'Cyan'
    e.team_role = 'Team Lead'
    e.platform = 'ATAK-CIV'
    e.last_status = status
    e.last_event_time = datetime.datetime(2026, 6, 16, 12, 0, 0)
    return e


def make_marker(uid='m1', callsign='Marker1', mtype='a-f-G'):
    m = MagicMock()
    m.uid = uid
    m.callsign = callsign
    m.type = mtype
    m.latitude = 52.0
    m.longitude = 21.0
    m.timestamp = datetime.datetime(2026, 6, 16, 12, 0, 0)
    return m


def make_cot(uid='c1', cot_type='u-d-f', xml='<event type="u-d-f" uid="c1"><point lat="52.0" lon="21.0" hae="0"/><detail><contact callsign="Shape"/><link point="52.0,21.0,0"/><link point="52.1,21.0,0"/><link point="52.0,21.0,0"/></detail></event>'):
    c = MagicMock()
    c.uid = uid
    c.type = cot_type
    c.sender_uid = 'alpha'
    c.timestamp = datetime.datetime(2026, 6, 16, 12, 0, 0)
    c.xml = xml
    return c


def test_data_euds_returns_results(client):
    eud = make_eud()
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = [eud]
    mock_db = MagicMock()
    mock_db.session.query.return_value = mock_query
    mock_eud_cls = MagicMock()
    mock_eud_cls.callsign = MagicMock()
    mock_eud_cls.last_status = MagicMock()
    mock_eud_cls.last_event_time = MagicMock()
    with patch.dict('sys.modules', {
        'opentakserver.extensions': MagicMock(db=mock_db),
        'opentakserver.models.EUD': MagicMock(EUD=mock_eud_cls),
    }):
        resp = client.get('/api/plugins/ots_maptak/data/euds')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['total'] == 1
    assert data['results'][0]['callsign'] == 'Alpha'
    assert data['results'][0]['last_status'] == 'Connected'


def test_data_markers_returns_results(client):
    marker = make_marker()
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = [marker]
    mock_db = MagicMock()
    mock_db.session.query.return_value = mock_query
    mock_marker_cls = MagicMock()
    mock_marker_cls.callsign = MagicMock()
    mock_marker_cls.type = MagicMock()
    mock_marker_cls.timestamp = MagicMock()
    with patch.dict('sys.modules', {
        'opentakserver.extensions': MagicMock(db=mock_db),
        'opentakserver.models.Marker': MagicMock(Marker=mock_marker_cls),
    }):
        resp = client.get('/api/plugins/ots_maptak/data/markers')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['total'] == 1
    assert data['results'][0]['uid'] == 'm1'


def test_data_cot_invalid_type_returns_400(client):
    resp = client.get('/api/plugins/ots_maptak/data/cot?type=invalid')
    assert resp.status_code == 400


def test_data_cot_valid_type_returns_results(client):
    cot = make_cot()
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = [cot]
    mock_db = MagicMock()
    mock_db.session.query.return_value = mock_query
    mock_cot_cls = MagicMock()
    mock_cot_cls.type = MagicMock()
    mock_cot_cls.uid = MagicMock()
    mock_cot_cls.timestamp = MagicMock()
    with patch.dict('sys.modules', {
        'opentakserver.extensions': MagicMock(db=mock_db),
        'opentakserver.models.CoT': MagicMock(CoT=mock_cot_cls),
    }):
        resp = client.get('/api/plugins/ots_maptak/data/cot?type=u-d-f')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['total'] == 1


def test_delete_eud_not_found_returns_404(client):
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = None
    mock_db = MagicMock()
    mock_db.session.query.return_value = mock_query
    mock_eud_cls = MagicMock()
    with patch.dict('sys.modules', {
        'opentakserver.extensions': MagicMock(db=mock_db),
        'opentakserver.models.EUD': MagicMock(EUD=mock_eud_cls),
    }):
        resp = client.delete('/api/plugins/ots_maptak/data/euds/missing-uid')
    assert resp.status_code == 404


def test_delete_eud_found_commits(client):
    eud = make_eud()
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = eud
    mock_db = MagicMock()
    mock_db.session.query.return_value = mock_query
    mock_eud_cls = MagicMock()
    with patch.dict('sys.modules', {
        'opentakserver.extensions': MagicMock(db=mock_db),
        'opentakserver.models.EUD': MagicMock(EUD=mock_eud_cls),
    }):
        resp = client.delete('/api/plugins/ots_maptak/data/euds/e1')
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['deleted'] == 'e1'
    mock_db.session.commit.assert_called_once()


def test_delete_cot_bulk(client):
    cot = make_cot()
    mock_query = MagicMock()
    mock_query.filter.return_value = mock_query
    mock_query.first.return_value = cot
    mock_db = MagicMock()
    mock_db.session.query.return_value = mock_query
    mock_cot_cls = MagicMock()
    with patch.dict('sys.modules', {
        'opentakserver.extensions': MagicMock(db=mock_db),
        'opentakserver.models.CoT': MagicMock(CoT=mock_cot_cls),
    }):
        resp = client.delete('/api/plugins/ots_maptak/data/cot',
                             json={'uids': ['c1']})
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'c1' in data['deleted']


def test_data_endpoints_registered(app):
    rules = {r.rule for r in app.url_map.iter_rules()}
    assert '/api/plugins/ots_maptak/data/euds' in rules
    assert '/api/plugins/ots_maptak/data/markers' in rules
    assert '/api/plugins/ots_maptak/data/cot' in rules
    assert '/api/plugins/ots_maptak/data/euds/<uid>' in rules
    assert '/api/plugins/ots_maptak/data/cot/<uid>' in rules
```

- [ ] **Step 2: Run tests**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
python3 -m pytest tests/test_data_endpoints.py -v
```
Expected: 8 passed.

- [ ] **Step 3: Run full test suite**

```bash
python3 -m pytest tests/ -q
```
Expected: all previous tests still pass.

- [ ] **Step 4: Commit**

```bash
git add tests/test_data_endpoints.py
git commit -m "test(data): 8 Python tests for data list and delete endpoints"
```

---

## Task 4: Frontend types for DataManager

**Files:**
- Modify: `maptak-ui/src/types/maptak.types.ts`

- [ ] **Step 1: Add data management types at end of file**

Add these interfaces after the existing types in `maptak.types.ts`:

```typescript
// ── Data Management ────────────────────────────────────────────────────────

export interface DataEUD {
  uid: string
  callsign: string
  team: string
  team_role: string
  platform: string
  last_status: string
  last_event_time: string | null
}

export interface DataMarker {
  uid: string
  callsign: string
  type: string
  latitude: number | null
  longitude: number | null
  timestamp: string | null
}

export interface DataCotItem {
  uid: string
  name: string
  type: 'u-d-f' | 'b-m-r' | 'b-m-p-s-p-loc'
  sender_uid: string
  timestamp: string | null
  color: string | null
  point_count: number
}

export type DataTab = 'euds' | 'markers' | 'routes' | 'shapes' | 'spis'

export const DATA_TAB_LABELS: Record<DataTab, string> = {
  euds: 'EUD',
  markers: 'Markery',
  routes: 'Trasy',
  shapes: 'Kształty',
  spis: 'SPI',
}

export const DATA_TAB_COT_TYPE: Partial<Record<DataTab, string>> = {
  routes: 'b-m-r',
  shapes: 'u-d-f',
  spis: 'b-m-p-s-p-loc',
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/types/maptak.types.ts
git commit -m "feat(data): add DataEUD, DataMarker, DataCotItem, DataTab types"
```

---

## Task 5: Top-nav view switch in App.tsx

**Files:**
- Modify: `maptak-ui/src/App.tsx`
- Modify: `maptak-ui/src/App.module.css`

- [ ] **Step 1: Add top-nav CSS**

Add to the end of `App.module.css`:

```css
.appShell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: #0d1b2a;
}

.topNav {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  background: #0a1628;
  border-bottom: 1px solid #0f3460;
  flex-shrink: 0;
  height: 36px;
}

.topNavBrand {
  font-size: 11px;
  font-weight: 700;
  color: #e94560;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-right: 16px;
}

.navBtn {
  padding: 4px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #a0c4ff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, color 0.15s;
}

.navBtn:hover {
  background: #16213e;
  color: #e0e0e0;
}

.navBtnActive {
  background: #0f3460;
  color: #ffffff;
  border-color: #1a4a8a;
}

.viewArea {
  flex: 1;
  overflow: hidden;
  display: flex;
}
```

- [ ] **Step 2: Update App.tsx**

Replace the entire content of `App.tsx` with:

```typescript
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
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npx tsc --noEmit 2>&1 | head -20
```
Expected: only possible error is "cannot find module DataManager" — that's fine, we'll add it next.

- [ ] **Step 4: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/App.tsx maptak-ui/src/App.module.css
git commit -m "feat(data): add top-nav MAPA/DANE view switch in App"
```

---

## Task 6: DataTable shared component

**Files:**
- Create: `maptak-ui/src/components/data/DataTable.tsx`
- Create: `maptak-ui/src/components/DataManager.module.css`

- [ ] **Step 1: Create DataManager.module.css**

```css
/* DataManager.module.css */
.root {
  display: flex;
  flex-direction: column;
  flex: 1;
  background: #0d1b2a;
  color: #e0e0e0;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

.subNav {
  display: flex;
  gap: 4px;
  padding: 8px 12px 0;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
  flex-shrink: 0;
}

.subTab {
  padding: 6px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  color: #a0c4ff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.subTab:hover { background: #0f3460; }

.subTabActive {
  background: #0f3460;
  color: #ffffff;
  border-color: #1a4a8a;
}

.badge {
  background: #1a4a8a;
  color: #a0c4ff;
  border-radius: 10px;
  padding: 1px 7px;
  font-size: 10px;
  margin-left: 5px;
}

.toolbar {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
  align-items: center;
  flex-shrink: 0;
}

.search {
  flex: 1;
  padding: 6px 10px;
  background: #0f3460;
  border: 1px solid #1a4a8a;
  border-radius: 4px;
  color: #a0c4ff;
  font-size: 12px;
  font-family: inherit;
  outline: none;
}

.search::placeholder { color: #4a6a8a; }
.search:focus { border-color: #2a6ac8; }

.filterSelect {
  padding: 6px 10px;
  background: #0f3460;
  border: 1px solid #1a4a8a;
  border-radius: 4px;
  color: #a0c4ff;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
}

.deleteBulkBtn {
  padding: 6px 14px;
  background: #c0392b;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
  white-space: nowrap;
}

.deleteBulkBtn:hover { background: #e74c3c; }
.deleteBulkBtn:disabled { background: #4a2a2a; color: #888; cursor: not-allowed; }

.tableWrap {
  flex: 1;
  overflow-y: auto;
  padding: 0 14px 14px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.table th {
  padding: 8px 10px;
  text-align: left;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: #4a6a8a;
  border-bottom: 1px solid #0f3460;
  position: sticky;
  top: 0;
  background: #0d1b2a;
  z-index: 1;
}

.table td {
  padding: 7px 10px;
  border-bottom: 1px solid #111e30;
  vertical-align: middle;
}

.table tr:hover td { background: #16213e; }

.online { color: #00e676; font-weight: 600; }
.offline { color: #546e7a; }
.offlineRow { opacity: 0.65; }

.deleteBtn {
  padding: 3px 8px;
  background: transparent;
  border: 1px solid #e94560;
  border-radius: 3px;
  color: #e94560;
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s;
  line-height: 1;
}

.deleteBtn:hover { background: #e94560; color: #fff; }

.colorDot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 6px;
  vertical-align: middle;
  border: 1px solid rgba(255,255,255,0.15);
}

.emptyState {
  text-align: center;
  padding: 48px 0;
  color: #4a6a8a;
  font-size: 13px;
}

.totalCount {
  font-size: 11px;
  color: #4a6a8a;
  padding: 8px 14px 0;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Create `data/DataTable.tsx`**

```bash
mkdir -p /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui/src/components/data
```

```typescript
// maptak-ui/src/components/data/DataTable.tsx
import type { ReactNode } from 'react'
import styles from '../DataManager.module.css'

interface Column {
  key: string
  label: string
  width?: string
}

interface DataTableProps<T extends { uid: string }> {
  columns: Column[]
  rows: T[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
  renderCell: (col: Column, row: T) => ReactNode
  emptyMessage?: string
}

export default function DataTable<T extends { uid: string }>({
  columns,
  rows,
  selected,
  onToggle,
  onToggleAll,
  onDelete,
  renderCell,
  emptyMessage = 'Brak danych',
}: DataTableProps<T>) {
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.uid))

  return (
    <div className={styles.tableWrap}>
      {rows.length === 0 ? (
        <div className={styles.emptyState}>{emptyMessage}</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: 28 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  title="Zaznacz wszystkie"
                />
              </th>
              {columns.map((col) => (
                <th key={col.key} style={col.width ? { width: col.width } : {}}>
                  {col.label}
                </th>
              ))}
              <th style={{ width: 48 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.uid}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(row.uid)}
                    onChange={() => onToggle(row.uid)}
                  />
                </td>
                {columns.map((col) => (
                  <td key={col.key}>{renderCell(col, row)}</td>
                ))}
                <td>
                  <button className={styles.deleteBtn} onClick={() => onDelete(row.uid)} title="Usuń">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/components/DataManager.module.css maptak-ui/src/components/data/DataTable.tsx
git commit -m "feat(data): DataTable shared component + DataManager CSS"
```

---

## Task 7: Five table components

**Files:**
- Create: `maptak-ui/src/components/data/EudTable.tsx`
- Create: `maptak-ui/src/components/data/MarkerTable.tsx`
- Create: `maptak-ui/src/components/data/RouteTable.tsx`
- Create: `maptak-ui/src/components/data/ShapeTable.tsx`
- Create: `maptak-ui/src/components/data/SpiTable.tsx`

- [ ] **Step 1: Create EudTable.tsx**

```typescript
// maptak-ui/src/components/data/EudTable.tsx
import type { DataEUD } from '../../types/maptak.types'
import DataTable from './DataTable'
import styles from '../DataManager.module.css'

const COLUMNS = [
  { key: 'callsign', label: 'Callsign' },
  { key: 'team', label: 'Team', width: '90px' },
  { key: 'team_role', label: 'Rola', width: '100px' },
  { key: 'platform', label: 'Platforma', width: '100px' },
  { key: 'last_event_time', label: 'Ostatni ping', width: '130px' },
  { key: 'last_status', label: 'Status', width: '80px' },
]

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'teraz'
  if (mins < 60) return `${mins} min temu`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} godz. temu`
  return d.toLocaleDateString('pl-PL')
}

interface Props {
  rows: DataEUD[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
}

export default function EudTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak urządzeń EUD"
      renderCell={(col, row) => {
        if (col.key === 'callsign') {
          return (
            <span className={row.last_status === 'Connected' ? styles.online : styles.offline}>
              {row.callsign || '—'}
            </span>
          )
        }
        if (col.key === 'last_status') {
          return (
            <span className={row.last_status === 'Connected' ? styles.online : styles.offline}>
              {row.last_status === 'Connected' ? '● online' : '● offline'}
            </span>
          )
        }
        if (col.key === 'last_event_time') return formatTime(row.last_event_time)
        return (row as Record<string, unknown>)[col.key] as string || '—'
      }}
    />
  )
}
```

- [ ] **Step 2: Create MarkerTable.tsx**

```typescript
// maptak-ui/src/components/data/MarkerTable.tsx
import type { DataMarker } from '../../types/maptak.types'
import DataTable from './DataTable'

const COLUMNS = [
  { key: 'callsign', label: 'Nazwa' },
  { key: 'type', label: 'Typ CoT', width: '130px' },
  { key: 'coords', label: 'Koordynaty', width: '160px' },
  { key: 'timestamp', label: 'Czas', width: '130px' },
]

function fmtCoords(lat: number | null, lon: number | null): string {
  if (lat == null || lon == null) return '—'
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  rows: DataMarker[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
}

export default function MarkerTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak markerów"
      renderCell={(col, row) => {
        if (col.key === 'coords') return fmtCoords(row.latitude, row.longitude)
        if (col.key === 'timestamp') return fmtTime(row.timestamp)
        return (row as Record<string, unknown>)[col.key] as string || '—'
      }}
    />
  )
}
```

- [ ] **Step 3: Create RouteTable.tsx**

```typescript
// maptak-ui/src/components/data/RouteTable.tsx
import type { DataCotItem } from '../../types/maptak.types'
import DataTable from './DataTable'

const COLUMNS = [
  { key: 'name', label: 'Nazwa trasy' },
  { key: 'point_count', label: 'Punkty WP', width: '90px' },
  { key: 'sender_uid', label: 'Nadawca', width: '180px' },
  { key: 'timestamp', label: 'Czas', width: '130px' },
]

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  rows: DataCotItem[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
}

export default function RouteTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak tras"
      renderCell={(col, row) => {
        if (col.key === 'timestamp') return fmtTime(row.timestamp)
        return String((row as Record<string, unknown>)[col.key] ?? '—')
      }}
    />
  )
}
```

- [ ] **Step 4: Create ShapeTable.tsx**

```typescript
// maptak-ui/src/components/data/ShapeTable.tsx
import type { DataCotItem } from '../../types/maptak.types'
import DataTable from './DataTable'
import styles from '../DataManager.module.css'

const COLUMNS = [
  { key: 'name', label: 'Nazwa kształtu' },
  { key: 'color', label: 'Kolor', width: '80px' },
  { key: 'point_count', label: 'Wierzchołki', width: '100px' },
  { key: 'sender_uid', label: 'Nadawca', width: '180px' },
  { key: 'timestamp', label: 'Czas', width: '130px' },
]

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  rows: DataCotItem[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
}

export default function ShapeTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak kształtów"
      renderCell={(col, row) => {
        if (col.key === 'color') {
          return row.color ? (
            <><span className={styles.colorDot} style={{ background: row.color }} />{row.color}</>
          ) : '—'
        }
        if (col.key === 'timestamp') return fmtTime(row.timestamp)
        return String((row as Record<string, unknown>)[col.key] ?? '—')
      }}
    />
  )
}
```

- [ ] **Step 5: Create SpiTable.tsx**

```typescript
// maptak-ui/src/components/data/SpiTable.tsx
import type { DataCotItem } from '../../types/maptak.types'
import DataTable from './DataTable'

const COLUMNS = [
  { key: 'name', label: 'Nazwa SPI' },
  { key: 'sender_uid', label: 'Nadawca EUD', width: '180px' },
  { key: 'timestamp', label: 'Czas', width: '130px' },
]

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
}

interface Props {
  rows: DataCotItem[]
  selected: Set<string>
  onToggle: (uid: string) => void
  onToggleAll: () => void
  onDelete: (uid: string) => void
}

export default function SpiTable({ rows, selected, onToggle, onToggleAll, onDelete }: Props) {
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      selected={selected}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
      onDelete={onDelete}
      emptyMessage="Brak punktów SPI"
      renderCell={(col, row) => {
        if (col.key === 'timestamp') return fmtTime(row.timestamp)
        return String((row as Record<string, unknown>)[col.key] ?? '—')
      }}
    />
  )
}
```

- [ ] **Step 6: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/components/data/
git commit -m "feat(data): EudTable, MarkerTable, RouteTable, ShapeTable, SpiTable components"
```

---

## Task 8: DataManager root component

**Files:**
- Create: `maptak-ui/src/components/DataManager.tsx`

- [ ] **Step 1: Create DataManager.tsx**

```typescript
// maptak-ui/src/components/DataManager.tsx
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
    await fetch(url, { method: 'DELETE' })
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
    await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uids }) })
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Run JS tests**

```bash
npm test -- --run 2>&1 | tail -10
```
Expected: all 35 existing tests pass (DataManager not yet tested).

- [ ] **Step 4: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/components/DataManager.tsx
git commit -m "feat(data): DataManager root component with sub-tabs, toolbar, fetch, delete"
```

---

## Task 9: JS tests for DataManager

**Files:**
- Create: `maptak-ui/src/components/DataManager.test.tsx`
- Create: `maptak-ui/src/components/data/EudTable.test.tsx`

- [ ] **Step 1: Create EudTable.test.tsx**

```typescript
// maptak-ui/src/components/data/EudTable.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EudTable from './EudTable'
import type { DataEUD } from '../../types/maptak.types'

const rows: DataEUD[] = [
  { uid: 'e1', callsign: 'Alpha-1', team: 'Cyan', team_role: 'Lead', platform: 'ATAK-CIV', last_status: 'Connected', last_event_time: new Date().toISOString() },
  { uid: 'e2', callsign: 'Bravo-2', team: 'Red', team_role: 'Medic', platform: 'iTAK', last_status: 'Disconnected', last_event_time: null },
]

it('renderuje wiersze EUD', () => {
  render(<EudTable rows={rows} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByText('Alpha-1')).toBeInTheDocument()
  expect(screen.getByText('Bravo-2')).toBeInTheDocument()
})

it('wywołuje onDelete po kliknięciu przycisku', () => {
  const onDelete = vi.fn()
  render(<EudTable rows={[rows[0]]} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onDelete={onDelete} />)
  const btns = screen.getAllByRole('button')
  fireEvent.click(btns[0])
  expect(onDelete).toHaveBeenCalledWith('e1')
})

it('checkbox w nagłówku przełącza zaznaczenie wszystkich', () => {
  const onToggleAll = vi.fn()
  render(<EudTable rows={rows} selected={new Set()} onToggle={vi.fn()} onToggleAll={onToggleAll} onDelete={vi.fn()} />)
  const headerCheckbox = screen.getAllByRole('checkbox')[0]
  fireEvent.click(headerCheckbox)
  expect(onToggleAll).toHaveBeenCalled()
})

it('online EUD ma zielony callsign', () => {
  const { container } = render(<EudTable rows={[rows[0]]} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onDelete={vi.fn()} />)
  const cell = container.querySelector('td span')
  expect(cell?.className).toMatch(/online/)
})

it('pokazuje pustą informację gdy brak wierszy', () => {
  render(<EudTable rows={[]} selected={new Set()} onToggle={vi.fn()} onToggleAll={vi.fn()} onDelete={vi.fn()} />)
  expect(screen.getByText('Brak urządzeń EUD')).toBeInTheDocument()
})
```

- [ ] **Step 2: Create DataManager.test.tsx**

```typescript
// maptak-ui/src/components/DataManager.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DataManager from './DataManager'

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ results: [], total: 0 }),
  })
})

it('renderuje sub-zakładki', () => {
  render(<DataManager />)
  expect(screen.getByText(/EUD/i)).toBeInTheDocument()
  expect(screen.getByText(/Markery/i)).toBeInTheDocument()
  expect(screen.getByText(/Trasy/i)).toBeInTheDocument()
  expect(screen.getByText(/Kształty/i)).toBeInTheDocument()
  expect(screen.getByText(/SPI/i)).toBeInTheDocument()
})

it('przełącza się do zakładki Markery', async () => {
  render(<DataManager />)
  fireEvent.click(screen.getByText(/Markery/i))
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/data/markers')
    )
  })
})

it('przycisk bulk-delete wyłączony gdy brak zaznaczonych', () => {
  render(<DataManager />)
  const btn = screen.getByRole('button', { name: /Usuń zaznaczone \(0\)/i })
  expect(btn).toBeDisabled()
})

it('wyszukiwarka wywołuje fetch z parametrem q', async () => {
  render(<DataManager />)
  const input = screen.getByPlaceholderText(/Szukaj eud/i)
  fireEvent.change(input, { target: { value: 'alpha' } })
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('q=alpha'))
  })
})

it('filtr statusu widoczny tylko dla zakładki EUD', () => {
  render(<DataManager />)
  expect(screen.getByDisplayValue('Wszystkie')).toBeInTheDocument()
  fireEvent.click(screen.getByText(/Markery/i))
  expect(screen.queryByDisplayValue('Wszystkie')).not.toBeInTheDocument()
})
```

- [ ] **Step 3: Run all JS tests**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npm test -- --run 2>&1 | tail -15
```
Expected: 45 passed (35 existing + 5 EudTable + 5 DataManager).

- [ ] **Step 4: Run all Python tests**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
python3 -m pytest tests/ -q
```
Expected: 17 passed (9 previous + 8 new).

- [ ] **Step 5: Commit**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add maptak-ui/src/components/DataManager.test.tsx maptak-ui/src/components/data/EudTable.test.tsx
git commit -m "test(data): 10 JS tests for DataManager and EudTable"
```

---

## Task 10: Build and verify wheel

**Files:**
- Build: `dist/ots_maptak-1.0.7-py3-none-any.whl`

- [ ] **Step 1: Build React UI**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel/maptak-ui
npm run build 2>&1 | tail -8
```
Expected: `✓ built in Xs`, no errors.

- [ ] **Step 2: Tag and build wheel**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add -A
git commit -m "chore: build UI for v1.0.7"
git tag v1.0.7
python3 -m build --wheel 2>&1 | tail -5
```
Expected: `Successfully built ots_maptak-1.0.7-py3-none-any.whl`

- [ ] **Step 3: Verify wheel contains UI assets**

```bash
python3 -c "
import zipfile
with zipfile.ZipFile('dist/ots_maptak-1.0.7-py3-none-any.whl') as z:
    files = [f for f in z.namelist() if 'ui/' in f]
    print(f'UI files: {len(files)}')
    print([f for f in files if 'index' in f])
"
```
Expected: `UI files: 3+`, includes `index.html` and JS/CSS assets.

- [ ] **Step 4: Final test run**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
python3 -m pytest tests/ -q && cd maptak-ui && npm test -- --run 2>&1 | tail -5
```
Expected: all tests pass.

- [ ] **Step 5: Commit build artifact**

```bash
cd /Volumes/Drewutnia/web/OpenTAKIntel
git add dist/ots_maptak-1.0.7-py3-none-any.whl
git commit -m "release: v1.0.7 data management tab"
```

---

## Deploy

```bash
# OpenTAK UI → Plugins → ots_maptak → Uninstall → Restart
# Plugins → Install Plugin → upload dist/ots_maptak-1.0.7-py3-none-any.whl → Restart
# Navigate to MapTAK plugin → kliknij "Dane" w górnej nawigacji
```
