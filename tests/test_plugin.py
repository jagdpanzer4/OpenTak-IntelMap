import pytest
from flask import Flask
from types import SimpleNamespace


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


def test_drawn_shapes_route_registered(app):
    rules = {r.rule for r in app.url_map.iter_rules()}
    assert '/api/plugins/ots_maptak/drawn_shapes' in rules


def test_last_positions_route_registered(app):
    rules = {r.rule for r in app.url_map.iter_rules()}
    assert '/api/plugins/ots_maptak/last_positions' in rules


def test_argb_to_css_converts_signed_java_argb():
    from ots_maptak.app import _argb_to_css
    assert _argb_to_css(-65536) == '#ff0000'
    assert _argb_to_css('-16711936') == '#00ff00'


def test_parse_cot_shape_freehand_polygon():
    from ots_maptak.app import _parse_cot_shape
    cot = SimpleNamespace(
        uid='poly-1',
        type='u-d-f',
        sender_uid='alpha',
        xml='''
        <event type="u-d-f" uid="poly-1">
          <point lat="52.0" lon="21.0" hae="0.0"/>
          <detail>
            <contact callsign="Freehand"/>
            <link point="52.0,21.0,0.0"/>
            <link point="52.1,21.1,0.0"/>
            <link point="52.2,21.2,0.0"/>
            <color value="-65536"/>
          </detail>
        </event>
        ''',
    )
    parsed = _parse_cot_shape(cot)
    assert parsed is not None
    assert parsed['type'] == 'freehand_polygon'
    assert parsed['color'] == '#ff0000'
    assert parsed['points'][0] == parsed['points'][-1]


def test_parse_cot_shape_route_and_spi():
    from ots_maptak.app import _parse_cot_shape

    route = SimpleNamespace(
        uid='route-1',
        type='b-m-r',
        sender_uid='alpha',
        xml='''
        <event type="b-m-r" uid="route-1">
          <point lat="52.0" lon="21.0"/>
          <detail>
            <link uid="wp-0" type="b-m-p-w" relation="c" point="52.0,21.0,0" callsign="Start"/>
            <link uid="wp-1" type="b-m-p-w" relation="c" point="52.1,21.1,0" callsign="WP1"/>
            <remarks>Route Name</remarks>
            <color value="-65536"/>
          </detail>
        </event>
        ''',
    )
    spi = SimpleNamespace(
        uid='spi-1',
        type='b-m-p-s-p-loc',
        sender_uid='alpha',
        xml='''
        <event type="b-m-p-s-p-loc" uid="spi-1" sender_uid="alpha">
          <point lat="52.2" lon="21.2"/>
          <detail>
            <contact callsign="SPI 1"/>
            <color value="-65536"/>
          </detail>
        </event>
        ''',
    )

    parsed_route = _parse_cot_shape(route)
    parsed_spi = _parse_cot_shape(spi)

    assert parsed_route is not None
    assert parsed_route['type'] == 'route'
    assert parsed_route['name'] == 'Route Name'
    assert parsed_route['waypoints'] == [
        {'callsign': 'Start', 'lat': 52.0, 'lon': 21.0},
        {'callsign': 'WP1', 'lat': 52.1, 'lon': 21.1},
    ]
    assert parsed_spi is not None
    assert parsed_spi['type'] == 'spi'
    assert parsed_spi['senderUid'] == 'alpha'


def test_url_prefix():
    from ots_maptak.app import blueprint
    assert blueprint.url_prefix == '/api/plugins/ots_maptak'
