export function formatClockTime(value, fallback = "—") {
  if (!value) return fallback;

  if (/^\d{1,2}:\d{2}/.test(String(value))) {
    const [hourValue, minute] = String(value).split(":");
    const hour = Number(hourValue);
    if (!Number.isFinite(hour)) return String(value);
    const suffix = hour >= 12 ? "PM" : "AM";
    return `${hour % 12 || 12}:${minute} ${suffix}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatDateTime(value, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

export function formatLevel(level, allLabel = "All levels", fallback = "—") {
  if (Number(level) === 0) return allLabel;
  if (level === null || level === undefined || level === "") return fallback;
  return `Level ${level}`;
}

export function formatAction(value, fallback = "—") {
  if (!value) return fallback;
  return String(value)
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatRelativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
