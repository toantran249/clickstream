import json
from fastapi import APIRouter, HTTPException
from app.models.schemas import ClickstreamEvent
from app.core.redis import redis_client
from app.core.databases import get_db_pool

router = APIRouter()

@router.post("/track", status_code=202)
async def track_event(event: ClickstreamEvent):
    # Convert Pydantic model to a JSON string
    event_data = event.model_dump_json()
    
    # 1. Push to Redis Queue for background batch database insertion
    await redis_client.rpush("clickstream_queue", event_data)
    
    # 2. Publish to Redis Pub/Sub for the Live Terminal UI
    await redis_client.publish("live_console", event_data)
    
    return {"status": "queued"}

@router.get("/session/{session_id}")
async def get_session_events(session_id: str, limit: int = 50):
    """
    Fetches the most recent events for a specific session.
    This utilizes the composite index we created in Postgres.
    """
    pool = get_db_pool()
    query = """
        SELECT event_type, url, element_metadata, created_at 
        FROM clickstream_events 
        WHERE session_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
    """
    async with pool.acquire() as conn:
        records = await conn.fetch(query, session_id, limit)
        
    return [dict(record) for record in records]