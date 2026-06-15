import os
import yaml


class DefaultConfig:
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
