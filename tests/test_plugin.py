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
