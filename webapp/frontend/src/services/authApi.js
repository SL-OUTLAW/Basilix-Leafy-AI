export async function loginWithGoogle(credential, rememberMe = false) {
  const response = await fetch("/api/auth/google", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      credential,
      rememberMe
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Google login failed");
  }

  return data;
}

let refreshPromise = null;

export async function refreshSession() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Session refresh failed");
    }

    return data;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function logout() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include"
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Logout failed");
  }

  return data;
}

export async function getCurrentUser(token) {
  const response = await fetch("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Authentication failed");
  }

  return data;
}
