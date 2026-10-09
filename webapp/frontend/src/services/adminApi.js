import { apiRequest } from "./apiClient";

export function getAdminUsers(token, onTokenRefresh) {
  return apiRequest("/api/admin/users", token, onTokenRefresh);
}

export function addAdminUser(token, onTokenRefresh, user) {
  return apiRequest("/api/admin/users", token, onTokenRefresh, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });
}

export function updateAdminUser(token, onTokenRefresh, allowedUserId, updates) {
  return apiRequest(
    `/api/admin/users/${allowedUserId}`,
    token,
    onTokenRefresh,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    },
  );
}

export function removeAdminUser(token, onTokenRefresh, allowedUserId) {
  return apiRequest(
    `/api/admin/users/${allowedUserId}`,
    token,
    onTokenRefresh,
    {
      method: "DELETE",
    },
  );
}

export function getAdminPermissions(token, onTokenRefresh) {
  return apiRequest("/api/admin/permissions", token, onTokenRefresh);
}

export function updateAdminPermission(
  token,
  onTokenRefresh,
  permissionKey,
  accessLevel,
) {
  return apiRequest(
    `/api/admin/permissions/${permissionKey}`,
    token,
    onTokenRefresh,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_level: accessLevel }),
    },
  );
}

export function getMyAccess(token, onTokenRefresh) {
  return apiRequest("/api/access", token, onTokenRefresh);
}
