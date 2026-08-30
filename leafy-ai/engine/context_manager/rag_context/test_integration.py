import asyncio

from managers.db_manager import open_pool, close_pool, run_query
from context_manager.rag_context.embedding import embed_text
from context_manager.rag_context.rag_tool import (
    ingest_document,
    search_chunks,
)


TEST_SOURCE = "rag-integration-test"

TEST_CHUNKS = [
    "RAG integration test knowledge about basil pH.",
    "RAG integration test knowledge about basil EC.",
    "RAG integration test knowledge about basil temperature.",
]


async def main():
    document_id = None

    await open_pool()

    try:
        embedding = await embed_text(TEST_CHUNKS[0])

        if len(embedding) != 768:
            raise RuntimeError(
                f"Expected 768 embedding dimensions, got {len(embedding)}"
            )

        ingestion = await ingest_document(
            title="RAG integration test",
            chunks=TEST_CHUNKS,
            source=TEST_SOURCE,
            document_type="test",
        )

        document_id = ingestion["document_id"]

        if ingestion["chunk_count"] != len(TEST_CHUNKS):
            raise RuntimeError("Incorrect number of chunks stored")

        stored = await run_query(
            """
            SELECT
                chunk_index,
                content,
                vector_dims(embedding)
            FROM rag_document_chunks
            WHERE document_id = %s
            ORDER BY chunk_index;
            """,
            (document_id,),
        )

        if len(stored) != len(TEST_CHUNKS):
            raise RuntimeError("Stored chunk count is incorrect")

        if not all(row[2] == 768 for row in stored):
            raise RuntimeError("Stored embedding dimension is incorrect")

        results = await search_chunks(
            query=TEST_CHUNKS[1],
            limit=1,
        )

        if not results:
            raise RuntimeError("RAG search returned no results")

        if results[0][3] != TEST_CHUNKS[1]:
            raise RuntimeError("RAG search returned the wrong chunk")

        print("RAG integration test: PASS")

    finally:
        if document_id is not None:
            await run_query(
                "DELETE FROM rag_documents WHERE document_id = %s;",
                (document_id,),
            )

        await close_pool()

if __name__ == "__main__":
    import sys

    if sys.platform == "win32":
        import selectors

        asyncio.run(
            main(),
            loop_factory=lambda: asyncio.SelectorEventLoop(
                selectors.SelectSelector()
            ),
        )
    else:
        asyncio.run(main())
