clickstream_project/
├── app/
│ ├── **init**.py
│ ├── main.py # FastAPI application entry point & WebSocket route
│ ├── api/
│ │ ├── **init**.py
│ │ └── endpoints.py # POST /track ingestion endpoint
│ ├── core/
│ │ ├── **init**.py
│ │ ├── config.py # Environment variables (DB URLs, Redis credentials)
│ │ ├── database.py # PostgreSQL connection pool setup
│ │ └── redis.py # Redis connection setup
│ ├── models/
│ │ ├── **init**.py
│ │ └── schemas.py # Pydantic models for incoming JSON validation
│ ├── services/
│ │ ├── **init**.py
│ │ ├── batch_worker.py # Background task to push Redis queues to Postgres
│ │ └── cron_jobs.py # TTL deletion script (30 days) and Materialized View refresh
│ └── static/ # Frontend files
│ ├── index.html # Split-view layout (E-commerce + Terminal)
│ ├── style.css # CSS Grid styling
│ └── tracker.js # JavaScript event listeners and WebSocket client
├── .env # Environment variables (hidden from version control)
├── docker-compose.yml # Easy setup for local Redis and PostgreSQL
├── requirements.txt # Python dependencies
└── README.md # Assignment documentation

<!-- RUN -->

source venv/bin/activate
