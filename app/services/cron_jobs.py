from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.databases import get_db_pool

scheduler = AsyncIOScheduler()

async def delete_old_logs():
    """30-Day TTL implementation."""
    pool = get_db_pool()
    query = "DELETE FROM clickstream_events WHERE created_at < NOW() - INTERVAL '30 days';"
    async with pool.acquire() as conn:
        await conn.execute(query)
    print("Cleaned up logs older than 30 days.")

async def refresh_materialized_view():
    """Refreshes the events_by_type analytics view."""
    pool = get_db_pool()
    query = "REFRESH MATERIALIZED VIEW events_by_type;"
    async with pool.acquire() as conn:
        await conn.execute(query)
    print("Refreshed materialized view: events_by_type.")

def start_scheduler():
    # Run the cleanup daily at midnight
    scheduler.add_job(delete_old_logs, 'cron', hour=0, minute=0)
    # Run the view refresh every hour
    scheduler.add_job(refresh_materialized_view, 'interval', hours=1)
    scheduler.start()