import asyncio
import selectors
from pathlib import Path

from managers.db_manager import open_pool
from tools.rag_tool.ingestion import ingest_cleaned_folder


async def main():
    await open_pool()

    sources_dir = Path(__file__).resolve().parent / "sources"

    print(f"Ingesting RAG sources from: {sources_dir}")

    results = await ingest_cleaned_folder(sources_dir)

    total_chunks = 0

    for result in results:
        total_chunks += result["chunk_count"]

        print(
            f"File: {result['file']} | "
            f"Document ID: {result['document_id']} | "
            f"Chunks: {result['chunk_count']}"
        )

    print(
        f"\nIngestion complete. "
        f"Documents: {len(results)}, "
        f"Chunks: {total_chunks}"
    )


if __name__ == "__main__":
    asyncio.run(
        main(),
        loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
    )
