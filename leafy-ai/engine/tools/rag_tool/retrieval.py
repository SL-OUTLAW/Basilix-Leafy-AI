from typing import Any

from engine.managers.db_manager import run_query
from engine.tools.rag_tool.embedding import embed_text

DEFAULT_TOP_K = 5
MAX_TOP_K = 10


def _vector_to_text(
    embedding: list[float],
) -> str:

    return "[" + ",".join(str(value) for value in embedding) + "]"


async def search_chunks(
    arguments: dict[str, Any],
) -> dict[str, Any]:

    query = arguments.get("query")

    top_k = arguments.get(
        "limit",
        DEFAULT_TOP_K,
    )

    if not isinstance(query, str) or not query.strip():
        raise ValueError("query must be a non-empty string")

    if not isinstance(top_k, int) or top_k < 1 or top_k > MAX_TOP_K:
        raise ValueError("limit must be between 1 and 10")

    query = query.strip()

    embedding = await embed_text(query)

    vector_text = _vector_to_text(embedding)

    rows = await run_query(
        """
        SELECT
            c.chunk_id,
            c.document_id,
            c.chunk_index,
            c.content,
            c.metadata,
            d.title,
            d.source,
            d.document_type,
            c.embedding <=> %s::vector
                AS cosine_distance

        FROM rag_document_chunks c

        JOIN rag_documents d
            ON d.document_id = c.document_id

        WHERE c.embedding IS NOT NULL

        ORDER BY
            c.embedding <=> %s::vector

        LIMIT %s;
        """,
        (
            vector_text,
            vector_text,
            top_k,
        ),
    )

    results = [
        {
            "chunk_id": row[0],
            "document_id": row[1],
            "chunk_index": row[2],
            "content": row[3],
            "metadata": row[4],
            "title": row[5],
            "source": row[6],
            "document_type": row[7],
            "cosine_distance": float(row[8]),
        }
        for row in rows
    ]

    return {
        "query": query,
        "result_count": len(results),
        "results": results,
    }
