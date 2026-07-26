.PHONY: install install-frontend install-backend frontend backend test dev clean

install: install-frontend install-backend

install-frontend:
	cd frontend && pnpm install

install-backend:
	cd backend && uv sync

frontend:
	cd frontend && pnpm dev

backend:
	cd backend && uv run flask --app app:create_app run --debug

dev:
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

clean:
	rm -rf backend/.venv
	rm -rf frontend/node_modules
