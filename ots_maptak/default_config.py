import os
import yaml


class DefaultConfig:
    MAPTAK_DEFAULT_LAT = 52.2297      # Default map center latitude (Warsaw)
    MAPTAK_DEFAULT_LON = 21.0122      # Default map center longitude
    MAPTAK_DEFAULT_ZOOM = 6           # Default zoom level (1-20)
    MAPTAK_MAX_TRACK_POINTS = 50      # Max GPS history points per EUD
    MAPTAK_TRACK_COLOR = '#00ff88'    # Track polyline color (CSS hex)
    MAPTAK_SHOW_OFFLINE_EUDS = True   # Show disconnected EUDs in sidebar
    MAPTAK_ONLY_ATAK_EUDS = True      # Only show EUDs with device/os/platform set
    MAPTAK_SHAPES_STALE_DAYS = 0      # Max age of drawn shapes in days (0 = no limit)

    @staticmethod
    def update_config(new_config: dict, data_folder: str | None = None) -> dict:
        if data_folder is None:
            data_folder = os.environ.get('OTS_DATA_FOLDER', os.path.expanduser('~/ots'))
        config_file = os.path.join(data_folder, 'config.yml')
        # Only persist keys that belong to this plugin's config
        safe_update = {k: v for k, v in new_config.items() if hasattr(DefaultConfig, k) and k.isupper()}
        try:
            with open(config_file, 'r') as f:
                config = yaml.safe_load(f) or {}
            config.update(safe_update)
            with open(config_file, 'w') as f:
                yaml.dump(config, f)
            return {'success': True}
        except Exception as e:
            return {'success': False, 'error': str(e)}
