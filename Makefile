.PHONY: install install-frontend install-backend frontend backend test dev clean

install: install-frontend install-backend

install-frontend:
	cd frontend && pnpm install

install-backend:
	cd backend && uv sync

dev-frontend:
	cd frontend && pnpm dev

dev-backend:
	cd backend && uv run flask --app app:create_app run --debug

frontend:
	cd frontend && pnpm build

dev:
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) dev-backend & \
	$(MAKE) dev-frontend & \
	wait

clean:
	rm -rf backend/.venv
	rm -rf frontend/node_modules
