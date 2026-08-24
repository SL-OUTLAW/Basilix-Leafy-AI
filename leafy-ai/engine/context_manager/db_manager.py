import os
from psycopg_pool import ConnectionPool

DB_NAME = os.getenv("DB_NAME", "leafy_ai")
DB_USER = os.getenv("DB_USER", "leafy_ai")
DB_PASSWORD = os.getenv("DB_PASSWORD", "leafy_ai_password")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")

connection_string = (
    f"dbname={DB_NAME} "
    f"user={DB_USER} "
    f"password={DB_PASSWORD} "
    f"host={DB_HOST} "
    f"port={DB_PORT}"
)

pool = ConnectionPool(
    conninfo=connection_string,
    min_size=1,
    max_size=5,
    open=False
)

def open_pool():
    pool.open()
    pool.wait()

def get_connection():
    return pool.connection()

def close_pool():
    pool.close()

def run_query(query, params=None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)

            if cur.description:
                return cur.fetchall()

            return []

def test_connection():
    try:
        open_pool()
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT current_database(), current_user;")
                result = cur.fetchone()
        return {
            "status": "success",
            "database": result[0],
            "user": result[1]
        }
    except Exception as error:
        return {
            "status": "error",
            "error": str(error)
        }
    finally:
        close_pool()

if __name__ == "__main__":
    print(test_connection())
