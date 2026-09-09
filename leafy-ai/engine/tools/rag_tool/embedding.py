import ollama


EMBEDDING_MODEL = "nomic-embed-text"
EMBEDDING_DIMENSIONS = 768

ollama_client = ollama.AsyncClient()


async def embed_text(text: str) -> list[float]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("text must be a non-empty string")

    response = await ollama_client.embed(
        model=EMBEDDING_MODEL,
        input=text,
        options={
            "num_gpu": 0,
        },
    )

    embedding = response["embeddings"][0]

    if len(embedding) != EMBEDDING_DIMENSIONS:
        raise ValueError(
            f"Expected {EMBEDDING_DIMENSIONS} embedding dimensions, "
            f"got {len(embedding)}"
        )

    return embedding
