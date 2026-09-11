import hashlib
import json
import os
import re
import requests
import psycopg

DB_DSN = "host=localhost port=5432 dbname=leafy_ai user=leafy_ai password=leafy_ai_password"
SOURCE_FILE = "rag_sources/A10_nt_government_fusarium_wilt_base_rot.md"
SOURCE_ID = "A10"
CHUNK_WORDS = 500
OVERLAP_WORDS = 75
EMBEDDING_MODEL = "nomic-embed-text:latest"
OLLAMA_URL = "http://localhost:11434/api/embed"

with open(SOURCE_FILE, "r", encoding="utf-8") as f:
    content = f.read().strip()

content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

match = re.search(r"^# (.+)$", content, re.MULTILINE)
title = match.group(1).strip() if match else SOURCE_ID

source_match = re.search(r"^Source: (.+)$", content, re.MULTILINE)
source = source_match.group(1).strip() if source_match else "Northern Territory Government"

url_match = re.search(r"^URL: (.+)$", content, re.MULTILINE)
url = url_match.group(1).strip() if url_match else ""

priority_match = re.search(r"^Priority: (.+)$", content, re.MULTILINE)
priority = priority_match.group(1).strip() if priority_match else "HIGH"

topic_match = re.search(r"^Topic: (.+)$", content, re.MULTILINE)
topic = topic_match.group(1).strip() if topic_match else ""

date_match = re.search(r"^Publication date: (.+)$", content, re.MULTILINE)
publication_date = date_match.group(1).strip() if date_match else None

words = content.split()

chunks = []
start = 0
chunk_index = 0

while start < len(words):
    end = min(start + CHUNK_WORDS, len(words))
    chunk_text = " ".join(words[start:end])
    chunks.append((chunk_index, chunk_text))

    if end == len(words):
        break

    start = end - OVERLAP_WORDS
    chunk_index += 1

print(f"Source: {SOURCE_ID}")
print(f"Title: {title}")
print(f"Words: {len(words)}")
print(f"Chunks: {len(chunks)}")
print(f"Content hash: {content_hash}")

document_metadata = {
    "source_id": SOURCE_ID,
    "priority": priority,
    "source": source,
    "document_name": title,
    "url": url,
    "topic": topic,
    "publication_date": publication_date
}

with psycopg.connect(DB_DSN) as conn:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT document_id
            FROM rag_documents
            WHERE source = %s
              AND content_hash = %s
            """,
            (source, content_hash)
        )

        existing = cur.fetchone()

        if existing:
            document_id = existing[0]
            print(f"Document already exists with document_id={document_id}")
        else:
            cur.execute(
                """
                INSERT INTO rag_documents
                    (title, source, document_type, content_hash, metadata)
                VALUES
                    (%s, %s, %s, %s, %s)
                RETURNING document_id
                """,
                (
                    title,
                    source,
                    "knowledge_source",
                    content_hash,
                    json.dumps(document_metadata)
                )
            )

            document_id = cur.fetchone()[0]

            for idx, chunk_text in chunks:
                response = requests.post(
                    OLLAMA_URL,
                    json={
                        "model": EMBEDDING_MODEL,
                        "input": chunk_text
                    },
                    timeout=120
                )
                response.raise_for_status()

                embedding = response.json()["embeddings"][0]

                if len(embedding) != 768:
                    raise ValueError(
                        f"Expected 768 dimensions, got {len(embedding)}"
                    )

                chunk_metadata = {
                    **document_metadata,
                    "section": "Fusarium Wilt and Base Rot of Basil",
                    "chunk_index": idx
                }

                cur.execute(
                    """
                    INSERT INTO rag_document_chunks
                        (document_id, chunk_index, content, metadata, embedding)
                    VALUES
                        (%s, %s, %s, %s, %s)
                    """,
                    (
                        document_id,
                        idx,
                        chunk_text,
                        json.dumps(chunk_metadata),
                        embedding
                    )
                )

            print(f"Inserted document_id={document_id}")
            print(f"Inserted {len(chunks)} chunks")

    conn.commit()

print("A10 ingestion complete.")
