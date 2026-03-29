import asyncpg
from app.core.config import settings

# Global variable to hold the connection pool
db_pool = None

async def create_pool():
    """Initialize the database connection pool."""
    global db_pool
    db_pool = await asyncpg.create_pool(settings.DATABASE_URL)

async def close_pool():
    """Close the database connection pool."""
    global db_pool
    if db_pool:
        await db_pool.close()

def get_db_pool():
    """Return the active database pool."""
    if db_pool is None:
        raise RuntimeError("Database pool is not initialized.")
    return db_pool