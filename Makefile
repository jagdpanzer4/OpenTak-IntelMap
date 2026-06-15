.PHONY: dev build package test clean

dev:
	cd maptak-ui && npm run dev

build:
	cd maptak-ui && npm run build

package: build
	poetry build

test:
	cd maptak-ui && npm run test -- --run
	pytest tests/ -v

clean:
	rm -rf maptak-ui/dist
	rm -rf ots_maptak/ui
	rm -rf dist
	rm -rf .pytest_cache
	find . -type d -name __pycache__ -exec rm -rf {} +
