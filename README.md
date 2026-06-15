# ots-maptak

Tactical map plugin for OpenTAKServer 1.7.11+.

## Install

1. `make package` — builds `dist/ots_maptak-*.whl`
2. OpenTAK UI → Server Plugin Manager → Upload Plugin → select `.whl`
3. Restart OpenTAKServer
4. Plugins → MapTAK → UI tab

## Dev

```bash
cd maptak-ui && npm install
make dev          # Vite dev server (no hot backend)
make package      # full .whl build
make test         # Vitest + pytest
```
