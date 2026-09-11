import hashlib
import json
import re
from pathlib import Path

from managers.db_manager import get_connection
from context_manager.rag_context.embedding import embed_text

CHUNK_WORDS = 500
OVERLAP_WORDS = 75

def _vector_to_text(embedding: list[float]) -> str:
    return "[" + ",".join(str(value) for value in embedding) + "]"

def _metadata_key(key: str) -> str:
    return re.sub(
        r"[^a-z0-9]+",
        "_",
        key.strip().lower(),
    ).strip("_")

def parse_cleaned_markdown(
    text: str,
    fallback_title: str,
) -> tuple[str, dict, str]:
    title = fallback_title
    metadata = {}
    content_lines = []
    reading_header = True

    for line in text.splitlines():
        stripped = line.strip()

        if reading_header:
            if stripped.startswith("# "):
                title = stripped[2:].strip()
                continue

            if not stripped:
                continue

            if stripped.startswith("##"):
                reading_header = False
            elif ":" in stripped:
                key, value = stripped.split(":", 1)

                key = _metadata_key(key)
                value = value.strip()

                if key == "url":
                    match = re.search(r"\((https?://[^)]+)\)", value)

                    if match:
                        value = match.group(1)

                metadata[key] = value
                continue
            else:
                reading_header = False

        content_lines.append(line)

    content = "\n".join(content_lines)
    content = re.sub(r"[ \t]+", " ", content)
    content = re.sub(r"\n{3,}", "\n\n", content).strip()

    return title, metadata, content


def chunk_text(
    text: str,
    chunk_words: int = CHUNK_WORDS,
    overlap_words: int = OVERLAP_WORDS,
) -> list[str]:
    if chunk_words <= 0:
        raise ValueError("chunk_words must be greater than 0")

    if overlap_words < 0 or overlap_words >= chunk_words:
        raise ValueError(
            "overlap_words must be smaller than chunk_words"
        )

    words = text.split()

    if not words:
        return []

    chunks = []
    start = 0

    while start < len(words):
        end = min(start + chunk_words, len(words))

        chunk = " ".join(words[start:end]).strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(words):
            break

        start = end - overlap_words

    return chunks


async def ingest_cleaned_file(file_path: str | Path) -> dict:
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(
            f"Source file not found: {path}"
        )

    raw_text = path.read_text(encoding="utf-8")

    title, metadata, content = parse_cleaned_markdown(
        raw_text,
        path.stem,
    )

    if not content:
        raise ValueError(
            f"No document content found in {path}"
        )

    chunks = chunk_text(content)

    if not chunks:
        raise ValueError(
            f"No chunks generated for {path}"
        )

    content_hash = hashlib.sha256(
        raw_text.encode("utf-8")
    ).hexdigest()

    metadata["document_name"] = title
    metadata["file_name"] = path.name

    async with get_connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT document_id
                FROM rag_documents
                WHERE content_hash = %s;
                """,
                (content_hash,),
            )

            existing = await cur.fetchone()

            if existing:
                document_id = existing[0]

                await cur.execute(
                    """
                    SELECT chunk_id
                    FROM rag_document_chunks
                    WHERE document_id = %s
                    ORDER BY chunk_index;
                    """,
                    (document_id,),
                )

                rows = await cur.fetchall()

                return {
                    "document_id": document_id,
                    "chunk_ids": [
                        row[0] for row in rows
                    ],
                    "chunk_count": len(rows),
                }

    return await ingest_document(
        title=title,
        chunks=chunks,
        source=metadata.get("source"),
        document_type="external_web_source",
        content_hash=content_hash,
        metadata=metadata,
    )


async def ingest_cleaned_folder(
    folder_path: str | Path,
) -> list[dict]:
    folder = Path(folder_path)

    if not folder.exists():
        raise FileNotFoundError(
            f"Source folder not found: {folder}"
        )

    files = sorted(folder.glob("*.md"))

    if not files:
        raise ValueError(
            f"No Markdown files found in {folder}"
        )

    results = []

    for path in files:
        result = await ingest_cleaned_file(path)

        results.append(
            {
                "file": path.name,
                **result,
            }
        )

    return results

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
                ON CONFLICT (content_hash) DO NOTHING
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

            if row is None and content_hash is not None:
                await cur.execute(
                    """
                    SELECT document_id
                    FROM rag_documents
                    WHERE content_hash = %s;
                    """,
                    (content_hash,),
                )

                row = await cur.fetchone()

                document_id = row[0]

                await cur.execute(
                    """
                    SELECT chunk_id
                    FROM rag_document_chunks
                    WHERE document_id = %s
                    ORDER BY chunk_index;
                    """,
                    (document_id,),
                )

                rows = await cur.fetchall()

                return {
                    "document_id": document_id,
                    "chunk_ids": [row[0] for row in rows],
                    "chunk_count": len(rows),
                }

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
