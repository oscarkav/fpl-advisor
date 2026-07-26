.PHONY: install install-frontend install-backend frontend backend test dev clean

install: install-root install-frontend install-backend

install-root:
	pnpm i

install-frontend:
	pnpm --filter frontend install

install-backend:
	cd backend && uv sync

dev-frontend:
	pnpm --filter frontend dev

dev-backend:
	cd backend && uv run flask --app app:create_app run --debug

frontend:
	pnpm --filter frontend build

dev:
	pnpm dev

clean:
	rm -rf backend/.venv
	rm -rf frontend/node_modules
