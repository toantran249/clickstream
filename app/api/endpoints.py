import json
import time
import asyncio
import random
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
from app.models.schemas import ClickstreamEvent
from app.core.redis import redis_client
from app.core.databases import get_db_pool

router = APIRouter()

# Add this schema for the stress test
class StressTestRequest(BaseModel):
    write_mode: str
    count: int = 1000

@router.post("/stress-test")
async def run_stress_test(request: StressTestRequest):
    start_time = time.time()
    
    async def simulate_single_event(i):
        # Randomize the event types and URLs
        event_types = ["click", "scroll", "view"]
        urls = ["/home", "/shop", "/product/123", "/cart"]
        
        event = ClickstreamEvent(
            session_id=f"stress_session_{i}",
            event_type=random.choice(event_types),
            url=random.choice(urls),
            element_metadata={"test_user": i, "simulated": True, "button_text": f"Button {i}"},
            write_mode=request.write_mode
        )
        await track_event(event)
        
    # Create concurrent tasks
    tasks = [simulate_single_event(i) for i in range(request.count)]
    
    # Execute simultaneously. return_exceptions=True catches the 503 timeouts!
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    end_time = time.time()
    
    # Count successes and failures
    errors = sum(1 for r in results if isinstance(r, Exception))
    successes = request.count - errors
    
    return {
        "mode": request.write_mode,
        "total_requests": request.count,
        "successful_writes": successes,
        "failed_writes": errors,
        "time_taken_seconds": round(end_time - start_time, 3)
    }

db_write_lock = asyncio.Lock()
@router.post("/track", status_code=202)
async def track_event(event: ClickstreamEvent):
    event_data = event.model_dump_json()
    
    # 1. Always publish to Live Console so the UI doesn't break
    
    # 2. Evaluate the Mode
    if event.write_mode == "direct":
        async with db_write_lock:
            # 1. Giả lập Database xử lý mất 0.5s cho MỖI request
            await asyncio.sleep(0.5)
            pool = get_db_pool()
            query = """
                INSERT INTO clickstream_events (session_id, user_id, event_type, url, write_mode, element_metadata)
                VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            """
            async with pool.acquire() as conn:
                await conn.execute(
                    query, 
                    event.session_id, 
                    event.user_id, 
                    event.event_type, 
                    event.url,
                    event.write_mode,
                    json.dumps(event.element_metadata)
                )
            await redis_client.publish("live_console", event_data)
        return {"status": "inserted_directly"}

        # 1. Giả lập Database xử lý mất 0.5s cho MỖI request
        # pool = get_db_pool()
        # query = """
        #     INSERT INTO clickstream_events (session_id, user_id, event_type, url, write_mode, element_metadata)
        #     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        # """
        # async with pool.acquire() as conn:
        #     await conn.execute(
        #         query, 
        #         event.session_id, 
        #         event.user_id, 
        #         event.event_type, 
        #         event.url,
        #         event.write_mode,
        #         json.dumps(event.element_metadata)
        #     )
        # await redis_client.publish("live_console", event_data)
        # return {"status": "inserted_directly"}
    else:
        # --- BATCH MODE: Push to Redis Queue ---
        await redis_client.rpush("clickstream_queue", event_data)
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