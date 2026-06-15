import sys
from unittest.mock import MagicMock

# Create a real Plugin base class for inheritance to work
class Plugin:
    _config = {}
    routes = []

    def get_plugin_routes(self, prefix):
        pass


# Create a module for opentakserver.plugins.Plugin
class PluginModule:
    Plugin = Plugin


# Stub opentakserver and flask_security before importing ots_maptak
_ots_ext = MagicMock()
_ots_ext.logger = MagicMock()

_ots_plugins = MagicMock()
_ots_plugins.Plugin = PluginModule

_ots = MagicMock()
_ots.extensions = _ots_ext
_ots.plugins = _ots_plugins

sys.modules['opentakserver'] = _ots
sys.modules['opentakserver.plugins'] = _ots_plugins
sys.modules['opentakserver.plugins.Plugin'] = PluginModule
sys.modules['opentakserver.extensions'] = _ots_ext

_fs = MagicMock()
_fs.roles_accepted = lambda *roles: (lambda f: f)  # passthrough decorator
sys.modules['flask_security'] = _fs
