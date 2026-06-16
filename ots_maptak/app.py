from __future__ import annotations

import importlib.metadata
import datetime
import os
import pathlib
import traceback

import yaml
from bs4 import BeautifulSoup, FeatureNotFound
from flask import Blueprint, Flask, current_app as app, jsonify, request, send_from_directory
from flask_security import roles_accepted
from opentakserver.extensions import logger
from opentakserver.plugins.Plugin import Plugin

from .default_config import DefaultConfig

_HERE = pathlib.Path(__file__).resolve().parent
_PKG  = _HERE.name  # "ots_maptak"


def _argb_to_css(value: str | int) -> str:
    try:
        argb = int(float(value)) & 0xFFFFFFFF
        r = (argb >> 16) & 0xFF
        g = (argb >> 8) & 0xFF
        b = argb & 0xFF
        return f'#{r:02x}{g:02x}{b:02x}'
    except (ValueError, TypeError):
        return '#ffff00'


def _parse_cot_xml(xml: str):
    for parser in ('xml', 'lxml', 'html.parser'):
        try:
            return BeautifulSoup(xml, parser)
        except FeatureNotFound:
            continue
    return BeautifulSoup(xml, 'html.parser')


def _parse_cot_shape(cot) -> dict | None:
    try:
        soup = _parse_cot_xml(cot.xml)
        event = soup.find('event')
        if not event:
            return None
        detail = event.find('detail') or soup
        contact = detail.find('contact') if detail else None
        color_tag = detail.find('color') if detail else None
        name = contact.get('callsign', cot.uid) if contact else cot.uid
        css_color = '#ffff00'
        if color_tag:
            css_color = _argb_to_css(color_tag.get('value') or color_tag.get('argb') or '#ffff00')

        point_tag = event.find('point')

        if cot.type == 'u-d-f':
            links = detail.find_all('link') if detail else []
            pts = []
            for link in links:
                pt_str = link.get('point', '')
                parts = pt_str.split(',')
                if len(parts) >= 2:
                    try:
                        pts.append([float(parts[0]), float(parts[1])])
                    except ValueError:
                        pass
            if len(pts) < 3:
                return None
            if pts[0] != pts[-1]:
                pts.append(pts[0])
            return {
                'uid': cot.uid,
                'name': name,
                'type': 'freehand_polygon',
                'points': pts,
                'color': css_color,
                'meta': None,
                'senderUid': getattr(cot, 'sender_uid', None),
                'waypoints': None,
            }

        if cot.type == 'b-m-r':
            links = detail.find_all('link', attrs={'type': 'b-m-p-w'}) if detail else []
            pts = []
            waypoints = []
            for link in links:
                pt_str = link.get('point', '')
                parts = pt_str.split(',')
                if len(parts) >= 2:
                    try:
                        lat, lon = float(parts[0]), float(parts[1])
                        pts.append([lat, lon])
                        waypoints.append({
                            'callsign': link.get('callsign', ''),
                            'lat': lat,
                            'lon': lon,
                        })
                    except ValueError:
                        pass
            if not pts:
                return None
            remarks = detail.find('remarks') if detail else None
            route_name = remarks.get_text().strip() if remarks and remarks.get_text() else name
            return {
                'uid': cot.uid,
                'name': route_name,
                'type': 'route',
                'points': pts,
                'color': css_color,
                'meta': f'{len(pts)} WP',
                'senderUid': getattr(cot, 'sender_uid', None),
                'waypoints': waypoints,
            }

        if cot.type == 'b-m-p-s-p-loc':
            if not point_tag:
                return None
            lat = float(point_tag.get('lat', 0))
            lon = float(point_tag.get('lon', 0))
            if lat == 0 and lon == 0:
                return None
            return {
                'uid': cot.uid,
                'name': name,
                'type': 'spi',
                'points': [[lat, lon]],
                'color': '#ff4400',
                'meta': None,
                'senderUid': getattr(cot, 'sender_uid', None),
                'waypoints': None,
            }

        return None
    except Exception:
        return None


class MapTAKPlugin(Plugin):
    metadata    = _PKG
    url_prefix  = f'/api/plugins/{_PKG}'
    blueprint   = Blueprint('MapTAKPlugin', __name__, url_prefix=url_prefix)

    def activate(self, app: Flask, enabled: bool = True):
        self._app = app
        self._load_config()
        self.load_metadata()
        try:
            logger.info(f'MapTAK plugin loaded (v{self._version()})')
        except Exception:
            logger.error(traceback.format_exc())

    def load_metadata(self):
        self.name = _PKG  # fallback if metadata lookup fails
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
            data_folder = app.config.get('OTS_DATA_FOLDER', os.environ.get('OTS_DATA_FOLDER', ''))
            result = DefaultConfig.update_config(request.json, data_folder=data_folder or None)
            return (jsonify(result), 200) if result['success'] else (jsonify(result), 400)
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)}), 400

    @staticmethod
    @roles_accepted('administrator')
    @blueprint.route('/drawn_shapes')
    def drawn_shapes():
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.CoT import CoT

        try:
            stale_days = current_app.config.get('MAPTAK_SHAPES_STALE_DAYS', 0)
            query = (
                ots_db.session.query(CoT)
                .filter(CoT.type.in_(['u-d-f', 'b-m-r', 'b-m-p-s-p-loc']))
            )
            if stale_days and int(stale_days) > 0:
                cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=int(stale_days))
                query = query.filter(CoT.timestamp >= cutoff)
            cots = query.order_by(CoT.timestamp.desc()).limit(1000).all()
            shapes = [shape for cot in cots if (shape := _parse_cot_shape(cot)) is not None]
            return jsonify(shapes)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @staticmethod
    @roles_accepted('administrator')
    @blueprint.route('/last_positions')
    def last_positions():
        from opentakserver.extensions import db as ots_db
        from opentakserver.models.Point import Point
        from sqlalchemy import func

        try:
            subq = (
                ots_db.session.query(
                    Point.device_uid,
                    func.max(Point.timestamp).label('max_ts'),
                )
                .filter(Point.device_uid.isnot(None))
                .filter(Point.latitude.isnot(None))
                .filter(Point.longitude.isnot(None))
                .group_by(Point.device_uid)
                .subquery()
            )
            rows = (
                ots_db.session.query(Point)
                .join(
                    subq,
                    (Point.device_uid == subq.c.device_uid)
                    & (Point.timestamp == subq.c.max_ts),
                )
                .all()
            )
            result = {
                p.device_uid: [p.latitude, p.longitude]
                for p in rows
                if p.latitude is not None and p.longitude is not None
            }
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

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


blueprint = MapTAKPlugin.blueprint
