FROM node:24.18.0-slim AS frontend-build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package*.json frontend/pnpm-lock.yaml ./frontend/
WORKDIR /app/frontend
RUN pnpm i --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM ghcr.io/astral-sh/uv:0.11.32-python3.13-trixie AS backend-build
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock README.md ./
RUN uv sync --locked --no-dev
COPY backend .
RUN uv sync --locked --no-dev

FROM python:3.13-slim
ENV PATH="/app/.venv/bin:$PATH"
COPY --from=backend-build /app /app
WORKDIR /app
COPY --from=frontend-build /app/frontend/dist ./src/app/static
EXPOSE 10000
CMD ["/bin/sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT:-10000} 'app:create_app()'"]
