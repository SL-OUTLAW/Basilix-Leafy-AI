import os
import dotenv
import asyncio


from psycopg_pool import AsyncConnectionPool

dotenv.load_dotenv()


DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")


connection_string = (
    f"dbname={DB_NAME} "
    f"user={DB_USER} "
    f"password={DB_PASSWORD} "
    f"host={DB_HOST} "
    f"port={DB_PORT}"
)


pool = AsyncConnectionPool(
    conninfo=connection_string,
    min_size=1,
    max_size=5,
    open=False,
)


async def open_pool():
    await pool.open()
    await pool.wait()


def get_connection():
    return pool.connection()


async def close_pool():
    await pool.close()


async def run_query(query, params=None):
    async with get_connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, params)

            if cur.description:
                return await cur.fetchall()

            return []


async def test_connection():
    try:
        await open_pool()

        async with get_connection() as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT current_database(), current_user;")

                result = await cur.fetchone()

        return {
            "status": "success",
            "database": result[0],
            "user": result[1],
        }

    except Exception as error:
        return {
            "status": "error",
            "error": str(error),
        }

    finally:
        await close_pool()
