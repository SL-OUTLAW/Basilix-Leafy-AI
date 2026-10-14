import { refreshSession } from "./authApi";

function formatErrorValue(value) {
  if (value == null) {
    return "Request failed";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(formatErrorValue).filter(Boolean).join("; ");
  }

  if (typeof value === "object") {
    const preferred = value.message || value.detail || value.error;

    if (preferred && preferred !== value) {
      return formatErrorValue(preferred);
    }

    try {
      return JSON.stringify(value);
    } catch {
      return "Request failed";
    }
  }

  return String(value);
}

async function sendRequest(path, token, options) {
  return fetch(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function apiRequest(path, token, onTokenRefresh, options = {}) {
  let activeToken = token;
  let response = await sendRequest(path, activeToken, options);

  if (response.status === 401) {
    const refreshed = await refreshSession();

    if (!refreshed?.token) {
      throw new Error("Session refresh failed");
    }

    activeToken = refreshed.token;
    onTokenRefresh?.(activeToken, refreshed.user || null);

    response = await sendRequest(path, activeToken, options);
  }

  const data = response.status === 204 ? {} : await response.json();

  if (!response.ok) {
    const error = new Error(formatErrorValue(data.error ?? data.detail));

    error.status = response.status;

    throw error;
  }

  return data;
}
