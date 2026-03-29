clickstream_project/
├── app/
│ ├── **init**.py
│ ├── main.py # FastAPI application entry point & WebSocket route
# clickstream_project

A small FastAPI-based clickstream ingestion service with Redis buffering and PostgreSQL persistence.

It provides an HTTP ingestion endpoint, a WebSocket demo frontend, and background workers that flush Redis queues into Postgres.

## Features

- FastAPI HTTP endpoint for tracking events
- Redis used as an ingestion buffer / queue
- Background batch worker to persist buffered events to PostgreSQL
- Small static demo frontend (WebSocket + tracker script)

## Quickstart (local)

1. Create and activate a virtual environment:

	python3 -m venv .venv
	source .venv/bin/activate

2. Install dependencies:

	pip install -r requirements.txt

3. Provide environment variables (see section below) in a `.env` file or your shell.

4. Start services with Docker Compose (recommended for local dev):

	docker-compose up -d

	This will start a local Redis and PostgreSQL instance if `docker-compose.yml` is present.

5. Run the FastAPI app:

	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Open the demo frontend at http://localhost:8000/static/index.html (or call the ingestion endpoint directly).

## Environment variables

Keep sensitive values out of source control (use `.env` and `.gitignore`). Common variables used in this project:

- DATABASE_URL - SQLAlchemy / asyncpg connection string for Postgres
- REDIS_URL - Redis connection (e.g. redis://localhost:6379/0)
- APP_ENV - application environment (development|production)

Adjust `app/core/config.py` for the exact variable names and defaults.

## Project layout

Top-level structure (important files):

```
clickstream_project/
├── app/                # Application code (FastAPI, services, static)
│   ├── main.py         # FastAPI app and routes
│   ├── api/endpoints.py
│   ├── core/           # config, database and redis helpers
│   ├── models/         # Pydantic models / schemas
│   └── services/       # batch worker and cron jobs
├── docker-compose.yml  # Local Redis + Postgres (optional)
├── requirements.txt
└── README.md
```

## Development notes

- Use the background worker in `app/services/batch_worker.py` to flush Redis queues to Postgres.
- Static demo files live in `app/static/` (`index.html`, `tracker.js`).

## Testing

There are no automated tests included by default. Add tests under a `tests/` folder and run with `pytest`.

## Git / .env hygiene

- `.env` and virtual environment directories are intentionally excluded from version control. See `.gitignore`.

## License

This repository contains example code; add a LICENSE file if you need a specific license.

---

If you want, I can add a short CONTRIBUTING guide or a Dockerfile/Makefile for common commands.
