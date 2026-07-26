# fpl-advisor

Full-stack project advising users on their fantasy Champion's League team.

## Overview

- Frontend: Vite + React + pnpm
- Backend: Flask + Gunicorn + uv
- Deployment: Docker + Render

## Prerequisites

Required tools:

- Git
- Volta
- Node.js
- pnpm
- Python
- uv
- Docker (optional)

## Getting Started

- Install Volta (handles Node and pnpm versions)
- install uv (handles Python environment and project - no manual venv needed!)
- install make (to install and run the project locally)

## Running project locally

```bash
make install
make dev
```

## Adding Node packages

There are different ways of doing it.

```bash
pnpm --filter frontend add react

cd frontend && pnpm add react
````

or dev dependencies that should not be included in the final build:

```bash
pnpm --filter frontend add -D @biomejs/biome

cd frontend && pnpm add -D @biomejs/biome
```

## Adding Python packages

Enter the backend folder and install dependencies using uv:

```bash
cd backend
uv add flask
```

or dev dependencies that should not be included in the final build:

```bash
cd backend
uv add --dev ruff
```

## Updating uv.lock

The `pyproject.toml` file contains the Python backend config and required packages.
If it's updated without `uv add`, you should update the uv.lock file, similar to the pnpm-lock.yaml file.
This make command will be using the `uv sync` command under the hood.

```bash
make install-backend
```

but just running the general install command works.


```bash
make install
```

## Daily work

To run linter/s:

```bash
make lint # all linters and formatters
make lint-backend
make lint-frontend
```
