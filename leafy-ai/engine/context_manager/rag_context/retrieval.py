from managers.db_manager import run_query

from context_manager.rag_context.embedding import embed_text


def _vector_to_text(embedding: list[float]) -> str:
    return "[" + ",".join(str(value) for value in embedding) + "]"


async def search_chunks(query: str, limit: int):
    if not isinstance(query, str) or not query.strip():
        raise ValueError("query must be a non-empty string")

    if not isinstance(limit, int) or limit < 1:
        raise ValueError("limit must be greater than 0")

    embedding = await embed_text(query)
    vector_text = _vector_to_text(embedding)

    return await run_query(
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
            c.embedding <=> %s::vector AS cosine_distance
        FROM rag_document_chunks c
        JOIN rag_documents d
            ON d.document_id = c.document_id
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> %s::vector
        LIMIT %s;
        """,
        (
            vector_text,
            vector_text,
            limit,
        ),
    )
