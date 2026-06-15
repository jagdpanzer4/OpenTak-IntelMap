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


blueprint = MapTAKPlugin.blueprint
