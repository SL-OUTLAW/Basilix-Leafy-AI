function normalizeText(value) {
  return String(value ?? "")
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();
}

function parsePossibleJson(value) {
  if (typeof value !== "string") {
    return value;
  }

  const text = value.trim();

  if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
    return value;
  }

  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

export function getAIResultContent(value) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    const parsed = parsePossibleJson(value);

    if (parsed !== value) {
      return getAIResultContent(parsed);
    }

    return normalizeText(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => getAIResultContent(item))
      .filter(Boolean)
      .join("\n\n");
  }

  if (typeof value === "object") {
    const preferredKeys = [
      "content",
      "result",
      "response",
      "output",
      "message",
      "summary"
    ];

    for (const key of preferredKeys) {
      if (value[key] != null) {
        const content = getAIResultContent(value[key]);

        if (content) {
          return content;
        }
      }
    }

    return normalizeText(JSON.stringify(value, null, 2));
  }

  return normalizeText(value);
}

export function markdownToPlainText(value) {
  return getAIResultContent(value)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*---+\s*$/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function getAIResultPreview(value, maxLength = 320) {
  const text = markdownToPlainText(value).replace(/\n+/g, " ").trim();

  if (!text) {
    return "";
  }

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}
