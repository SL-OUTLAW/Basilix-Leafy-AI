import { refreshSession } from "./authApi";

async function sendRequest(path, token, options) {
  return fetch(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`
    }
  });
}

export async function apiRequest(
  path,
  token,
  onTokenRefresh,
  options = {}
) {
  let activeToken = token;
  let response = await sendRequest(
    path,
    activeToken,
    options
  );

  if (response.status === 401) {
    const refreshed = await refreshSession();

    if (!refreshed?.token) {
      throw new Error("Session refresh failed");
    }

    activeToken = refreshed.token;
    onTokenRefresh?.(activeToken);

    response = await sendRequest(
      path,
      activeToken,
      options
    );
  }

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data.error || "Request failed"
    );

    error.status = response.status;

    throw error;
  }

  return data;
}
