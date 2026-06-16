# tests/test_data_endpoints.py
import pytest
from unittest.mock import MagicMock, patch
from flask import Flask
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
