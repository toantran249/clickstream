import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.core.databases import create_pool, close_pool
from app.core.redis import redis_client
from app.api.endpoints import router as api_router
from app.services.batch_worker import process_batch
from app.services.cron_jobs import start_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB pool, background worker, and cron jobs
    await create_pool()
    worker_task = asyncio.create_task(process_batch())
    start_scheduler()
    yield
    # Shutdown: Clean up resources
    worker_task.cancel()
    await close_pool()
    await redis_client.close()

app = FastAPI(lifespan=lifespan)

# Allow cross-origin requests (useful if frontend is hosted elsewhere)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include our API routes
app.include_router(api_router, prefix="/api")

# Serve the static frontend files (HTML/CSS/JS)
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# --- WebSocket Route for Live Console ---
@app.websocket("/ws/console")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe("live_console")
    
    try:
        while True:
            # Listen for messages on the Redis channel
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                # Send the raw JSON string directly to the connected frontend terminal
                await websocket.send_text(message["data"])
            await asyncio.sleep(0.1) # Yield control back to event loop
    except WebSocketDisconnect:
        print("Live console disconnected")
    finally:
        await pubsub.unsubscribe("live_console")