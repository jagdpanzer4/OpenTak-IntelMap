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
