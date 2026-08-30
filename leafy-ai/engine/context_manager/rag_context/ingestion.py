import json

from managers.db_manager import get_connection
from context_manager.rag_context.embedding import embed_text


def _vector_to_text(embedding: list[float]) -> str:
    return "[" + ",".join(str(value) for value in embedding) + "]"


async def ingest_document(
    title: str,
    chunks: list[str],
    source: str | None = None,
    document_type: str | None = None,
    content_hash: str | None = None,
    metadata: dict | None = None,
) -> dict:
    if not isinstance(title, str) or not title.strip():
        raise ValueError("title must be a non-empty string")

    if not isinstance(chunks, list) or not chunks:
        raise ValueError("chunks must be a non-empty list")

    for chunk in chunks:
        if not isinstance(chunk, str) or not chunk.strip():
            raise ValueError("every chunk must be a non-empty string")

    metadata = metadata or {}

    embedded_chunks = []

    for content in chunks:
        embedding = await embed_text(content)

        embedded_chunks.append(
            (
                content,
                _vector_to_text(embedding),
            )
        )

    async with get_connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO rag_documents (
                    title,
                    source,
                    document_type,
                    content_hash,
                    metadata
                )
                VALUES (%s, %s, %s, %s, %s::jsonb)
                RETURNING document_id;
                """,
                (
                    title,
                    source,
                    document_type,
                    content_hash,
                    json.dumps(metadata),
                ),
            )

            row = await cur.fetchone()
            document_id = row[0]

            chunk_ids = []

            for chunk_index, (content, vector_text) in enumerate(
                embedded_chunks
            ):
                await cur.execute(
                    """
                    INSERT INTO rag_document_chunks (
                        document_id,
                        chunk_index,
                        content,
                        metadata,
                        embedding
                    )
                    VALUES (%s, %s, %s, %s::jsonb, %s::vector)
                    RETURNING chunk_id;
                    """,
                    (
                        document_id,
                        chunk_index,
                        content,
                        json.dumps(metadata),
                        vector_text,
                    ),
                )

                row = await cur.fetchone()
                chunk_ids.append(row[0])

    return {
        "document_id": document_id,
        "chunk_ids": chunk_ids,
        "chunk_count": len(chunk_ids),
    }
