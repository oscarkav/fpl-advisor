.PHONY: install install-frontend install-backend frontend dev clean \
	lint lint-frontend lint-backend

install: install-root install-frontend install-backend

install-root:
	pnpm i

install-frontend:
	pnpm --filter frontend install

install-backend:
	cd backend && uv sync

dev:
	pnpm dev

dev-frontend:
	pnpm --filter frontend dev

dev-backend:
	cd backend && uv run flask --app app:create_app run --debug

lint:
	$(MAKE) lint-frontend
	$(MAKE) lint-backend

lint-frontend:
	pnpm --filter frontend format
	pnpm --filter frontend lint:fix

lint-backend:
	cd backend && uv run ruff check . --fix
	cd backend && uv run ruff format .

build-frontend:
	pnpm --filter frontend build

clean:
	rm -rf backend/.venv
	rm -rf frontend/node_modules
