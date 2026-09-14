import json
from pathlib import Path


REQUIRED_FIELDS = {
    "source_id",
    "source",
    "url",
    "priority",
    "topic",
    "document_name",
    "source_file",
}

def load_source_metadata(
    folder_path: str | Path,
) -> dict[str, dict]:
    folder = Path(folder_path)
    metadata_path = folder / "source_metadata.json"

    if not metadata_path.exists():
        return {}

    entries = json.loads(
        metadata_path.read_text(encoding="utf-8")
    )

    if not isinstance(entries, list):
        raise ValueError(
            "source_metadata.json must contain a list"
        )

    metadata_by_file = {}

    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError(
                "every metadata entry must be an object"
            )

        missing = REQUIRED_FIELDS - set(entry)

        if missing:
            raise ValueError(
                f"metadata entry missing fields: {sorted(missing)}"
            )

        source_file = entry["source_file"]

        if source_file in metadata_by_file:
            raise ValueError(
                f"duplicate source_file: {source_file}"
            )

        metadata_by_file[source_file] = entry

    return metadata_by_file


def prepare_source_metadata(
    file_path: str | Path,
    title: str,
    parsed_metadata: dict,
    source_metadata: dict | None,
) -> tuple[dict, dict]:
    path = Path(file_path)

    if source_metadata is None:
        metadata = dict(parsed_metadata)
        metadata["document_name"] = title
        metadata["file_name"] = path.name

        return metadata, metadata

    if source_metadata["source_file"] != path.name:
        raise ValueError(
            f"Metadata does not match source file: {path.name}"
        )

    if source_metadata["document_name"] != title:
        raise ValueError(
            f"Metadata title does not match document: {path.name}"
        )

    metadata = dict(source_metadata)

    chunk_metadata = {
        "document_name": title,
    }

    return metadata, chunk_metadata