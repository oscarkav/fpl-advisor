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

## Updating uv.lock

The `pyproject.toml` file contains the Python backend config and required packages.
If it's updated, you should update the uv.lock file, similar to the pnpm-lock.yaml file.
This make command will be using the `uv sync` command under the hood.

```bash
make install-backend
```

but just running the general install command works.


```bash
make install
```
