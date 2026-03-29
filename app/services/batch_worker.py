import asyncio
import json
from app.core.redis import redis_client
from app.core.databases import get_db_pool

BATCH_SIZE = 100
FLUSH_INTERVAL = 2.0  # seconds

async def process_batch():
    """Pulls events from Redis and bulk-inserts them into Postgres."""
    pool = get_db_pool()
    
    while True:
        try:
            # Pop up to BATCH_SIZE items from the Redis list
            pipeline = redis_client.pipeline()
            pipeline.lrange("clickstream_queue", 0, BATCH_SIZE - 1)
            pipeline.ltrim("clickstream_queue", BATCH_SIZE, -1)
            results = await pipeline.execute()
            
            raw_events = results[0]
            
            if raw_events:
                # Parse JSON strings back into Python dictionaries
                events = [json.loads(event) for event in raw_events]
                
                # Prepare data for asyncpg executemany
                insert_data = [
                    (
                        e.get("session_id"), 
                        e.get("user_id"), 
                        e.get("event_type"), 
                        e.get("url"), 
                        json.dumps(e.get("element_metadata", {}))
                    )
                    for e in events
                ]
                
                query = """
                    INSERT INTO clickstream_events (session_id, user_id, event_type, url, element_metadata)
                    VALUES ($1, $2, $3, $4, $5::jsonb)
                """
                
                async with pool.acquire() as conn:
                    await conn.executemany(query, insert_data)
                    
        except Exception as e:
            print(f"Error in batch worker: {e}")
            
        # Sleep briefly to prevent CPU maxing out when queue is empty
        await asyncio.sleep(FLUSH_INTERVAL)