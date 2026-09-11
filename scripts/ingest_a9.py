import hashlib
import json
import re
import urllib.request
from pathlib import Path

import psycopg

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = REPO_ROOT / "rag_sources" / "A9_latrobe_research_innovation_food_production.md"

DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "dbname": "leafy_ai",
    "user": "leafy_ai",
    "password": "leafy_ai_password",
}

OLLAMA_URL = "http://localhost:11434/api/embed"
EMBEDDING_MODEL = "nomic-embed-text:latest"

CHUNK_WORDS = 500
OVERLAP_WORDS = 75

def read_source(path):
    if not path.exists():
        raise FileNotFoundError(f"Source file not found: {path}")
    return path.read_text(encoding="utf-8")

def parse_metadata_and_content(text):
    lines = text.splitlines()
    metadata = {}
    content_lines = []
    in_content = False

    for line in lines:
        stripped = line.strip()

        if not in_content:
            if stripped.startswith("# "):
                metadata["document_name"] = stripped[2:].strip()
                continue

            if stripped.startswith("Source ID:"):
                metadata["source_id"] = stripped.split(":", 1)[1].strip()
                continue

            if stripped.startswith("Source:"):
                metadata["source"] = stripped.split(":", 1)[1].strip()
                continue

            if stripped.startswith("Priority:"):
                metadata["priority"] = stripped.split(":", 1)[1].strip()
                continue

            if stripped.startswith("URL:"):
                url_match = re.search(r"\((https?://[^)]+)\)", stripped)
                metadata["url"] = url_match.group(1) if url_match else stripped.split(":", 1)[1].strip()
                continue

            if stripped.startswith("Topic:"):
                metadata["topic"] = stripped.split(":", 1)[1].strip()
                continue

            if stripped == "":
                continue

            in_content = True

        content_lines.append(line)

    content = "\n".join(content_lines)
    content = re.sub(r"[ \t]+", " ", content)
    content = re.sub(r"\n{3,}", "\n\n", content).strip()

    return metadata, content

def chunk_text(text, chunk_words=CHUNK_WORDS, overlap_words=OVERLAP_WORDS):
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

def embed_text(text):
    payload = json.dumps({
        "model": EMBEDDING_MODEL,
        "input": text
    }).encode("utf-8")

    request = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(request, timeout=120) as response:
        result = json.loads(response.read().decode("utf-8"))

    embeddings = result.get("embeddings")

    if not embeddings or not embeddings[0]:
        raise RuntimeError("Ollama returned no embedding.")

    embedding = embeddings[0]

    if len(embedding) != 768:
        raise ValueError(f"Expected 768 dimensions, received {len(embedding)}.")

    return embedding

def embedding_to_pgvector(embedding):
    return "[" + ",".join(str(float(value)) for value in embedding) + "]"

def main():
    raw_text = read_source(SOURCE_FILE)
    metadata, content = parse_metadata_and_content(raw_text)
    chunks = chunk_text(content)

    if not content:
        raise ValueError("No article content found.")

    if not chunks:
        raise ValueError("No chunks were generated.")

    content_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()

    document_metadata = {
        "source_id": metadata.get("source_id"),
        "priority": metadata.get("priority"),
        "source": metadata.get("source"),
        "url": metadata.get("url"),
        "topic": metadata.get("topic")
    }

    chunk_base_metadata = {
        "source_id": metadata.get("source_id"),
        "priority": metadata.get("priority"),
        "source": metadata.get("source"),
        "document_name": metadata.get("document_name"),
        "url": metadata.get("url"),
        "topic": metadata.get("topic")
    }

    print(f"Source ID: {metadata.get('source_id')}")
    print(f"Document: {metadata.get('document_name')}")
    print(f"Words: {len(content.split())}")
    print(f"Chunks: {len(chunks)}")
    print(f"Content hash: {content_hash}")

    with psycopg.connect(**DB_CONFIG) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT document_id
                FROM rag_documents
                WHERE source = %s
                  AND content_hash = %s
                """,
                (metadata.get("source"), content_hash)
            )

            existing = cur.fetchone()

            if existing:
                document_id = existing[0]

                cur.execute(
                    """
                    DELETE FROM rag_document_chunks
                    WHERE document_id = %s
                    """,
                    (document_id,)
                )

                cur.execute(
                    """
                    UPDATE rag_documents
                    SET
                        title = %s,
                        document_type = %s,
                        metadata = %s::jsonb,
                        updated_at = NOW()
                    WHERE document_id = %s
                    """,
                    (
                        metadata.get("document_name"),
                        "external_web_source",
                        json.dumps(document_metadata),
                        document_id
                    )
                )
            else:
                cur.execute(
                    """
                    INSERT INTO rag_documents
                    (
                        title,
                        source,
                        document_type,
                        content_hash,
                        metadata
                    )
                    VALUES (%s, %s, %s, %s, %s::jsonb)
                    RETURNING document_id
                    """,
                    (
                        metadata.get("document_name"),
                        metadata.get("source"),
                        "external_web_source",
                        content_hash,
                        json.dumps(document_metadata)
                    )
                )

                document_id = cur.fetchone()[0]

            for index, chunk in enumerate(chunks):
                print(f"Embedding chunk {index + 1}/{len(chunks)}...")

                embedding = embed_text(chunk)
                embedding_pg = embedding_to_pgvector(embedding)

                chunk_metadata = {
                    **chunk_base_metadata,
                    "chunk_index": index,
                    "chunk_word_count": len(chunk.split()),
                    "embedding_model": EMBEDDING_MODEL
                }

                cur.execute(
                    """
                    INSERT INTO rag_document_chunks
                    (
                        document_id,
                        chunk_index,
                        content,
                        metadata,
                        embedding
                    )
                    VALUES (%s, %s, %s, %s::jsonb, %s::vector)
                    """,
                    (
                        document_id,
                        index,
                        chunk,
                        json.dumps(chunk_metadata),
                        embedding_pg
                    )
                )

        conn.commit()

    print("SUCCESS")
    print(f"Document ID: {document_id}")
    print(f"Chunks inserted: {len(chunks)}")

if __name__ == "__main__":
    main()

