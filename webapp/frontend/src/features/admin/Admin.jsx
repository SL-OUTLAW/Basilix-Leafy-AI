import {
  useEffect,
  useMemo,
  useState
} from "react";

import {
  Plus,
  Trash2,
  UserCog,
  Users
} from "lucide-react";

import {
  addAdminUser,
  getAdminPermissions,
  getAdminUsers,
  removeAdminUser,
  updateAdminPermission,
  updateAdminUser
} from "../../services/adminApi";

import {
  formatDateTime
} from "../../utils/formatters";

import styles from "./Admin.module.css";

const ACCESS_LABELS = {
  OPERATOR: "Operator + Admin",
  ADMIN: "Admin only"
};

function Admin({
  token,
  onTokenRefresh,
  currentUser
}) {
  const [
    users,
    setUsers
  ] = useState([]);

  const [
    permissions,
    setPermissions
  ] = useState([]);

  const [
    email,
    setEmail
  ] = useState("");

  const [
    role,
    setRole
  ] = useState("OPERATOR");

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    busy,
    setBusy
  ] = useState("");

  const [
    error,
    setError
  ] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        userData,
        permissionData
      ] = await Promise.all([
        getAdminUsers(
          token,
          onTokenRefresh
        ),

        getAdminPermissions(
          token,
          onTokenRefresh
        )
      ]);

      setUsers(
        Array.isArray(
          userData.users
        )
          ? userData.users
          : []
      );

      setPermissions(
        Array.isArray(
          permissionData.permissions
        )
          ? permissionData.permissions
          : []
      );
    } catch (loadError) {
      setError(
        loadError.message ||
          "Unable to load admin data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () => {
      load();
    },
    [token]
  );

  const activeCount = useMemo(
    () =>
      users.filter(
        (user) => user.enabled
      ).length,
    [users]
  );

  async function addUser(
    event
  ) {
    event.preventDefault();

    setBusy("add-user");
    setError("");

    try {
      await addAdminUser(
        token,
        onTokenRefresh,
        {
          email,
          role
        }
      );

      setEmail("");
      setRole("OPERATOR");

      await load();
    } catch (actionError) {
      setError(
        actionError.message ||
          "Unable to add user"
      );
    } finally {
      setBusy("");
    }
  }

  async function updateUser(
    user,
    updates
  ) {
    setBusy(
      `user-${user.allowed_user_id}`
    );

    setError("");

    try {
      const result =
        await updateAdminUser(
          token,
          onTokenRefresh,
          user.allowed_user_id,
          updates
        );

      setUsers(
        (current) =>
          current.map(
            (item) =>
              item.allowed_user_id ===
              user.allowed_user_id
                ? {
                    ...item,
                    ...result.user
                  }
                : item
          )
      );
    } catch (actionError) {
      setError(
        actionError.message ||
          "Unable to update user"
      );
    } finally {
      setBusy("");
    }
  }

  async function removeUser(
    user
  ) {
    if (
      !window.confirm(
        `Remove access for ${user.email}?`
      )
    ) {
      return;
    }

    setBusy(
      `user-${user.allowed_user_id}`
    );

    setError("");

    try {
      await removeAdminUser(
        token,
        onTokenRefresh,
        user.allowed_user_id
      );

      setUsers(
        (current) =>
          current.filter(
            (item) =>
              item.allowed_user_id !==
              user.allowed_user_id
          )
      );
    } catch (actionError) {
      setError(
        actionError.message ||
          "Unable to remove user"
      );
    } finally {
      setBusy("");
    }
  }

  async function changePermission(
    permission,
    accessLevel
  ) {
    setBusy(
      `permission-${permission.permission_key}`
    );

    setError("");

    try {
      const result =
        await updateAdminPermission(
          token,
          onTokenRefresh,
          permission.permission_key,
          accessLevel
        );

      setPermissions(
        (current) =>
          current.map(
            (item) =>
              item.permission_key ===
              permission.permission_key
                ? result.permission
                : item
          )
      );
    } catch (actionError) {
      setError(
        actionError.message ||
          "Unable to update permission"
      );
    } finally {
      setBusy("");
    }
  }

  if (
    currentUser?.role !==
    "ADMIN"
  ) {
    return (
      <div
        className={
          styles.denied
        }
      >
        Admin access is required.
      </div>
    );
  }

  return (
    <div
      className={
        styles.admin
      }
    >
      <div
        className={
          styles.summary
        }
      >
        <div>
          <Users />

          <span>
            <strong>
              {users.length}
            </strong>{" "}
            allowed users
          </span>
        </div>

        <div>
          <UserCog />

          <span>
            <strong>
              {activeCount}
            </strong>{" "}
            enabled
          </span>
        </div>
      </div>

      {error && (
        <div
          className={
            styles.error
          }
        >
          {error}
        </div>
      )}

      <section
        className={
          styles.panel
        }
      >
        <div
          className={
            styles.panelHeader
          }
        >
          <div>
            <h2>
              User Management
            </h2>

            <p>
              Add users, change
              roles, enable access,
              or revoke access.
            </p>
          </div>
        </div>

        <form
          className={
            styles.addUser
          }
          onSubmit={addUser}
        >
          <input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={
              (event) =>
                setEmail(
                  event.target.value
                )
            }
            required
          />

          <select
            value={role}
            onChange={
              (event) =>
                setRole(
                  event.target.value
                )
            }
          >
            <option
              value="OPERATOR"
            >
              Operator
            </option>

            <option
              value="ADMIN"
            >
              Admin
            </option>
          </select>

          <button
            type="submit"
            disabled={
              busy === "add-user"
            }
          >
            <Plus size={17} />
            Add User
          </button>
        </form>

        <div
          className={
            styles.tableWrap
          }
        >
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Access</th>
                <th>
                  Last login
                </th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan="5"
                  >
                    Loading users...
                  </td>
                </tr>
              ) : (
                users.map(
                  (user) => {
                    const isSelf =
                      user.email
                        ?.toLowerCase() ===
                      currentUser.email
                        ?.toLowerCase();

                    return (
                      <tr
                        key={
                          user.allowed_user_id
                        }
                      >
                        <td>
                          <strong>
                            {user.full_name ||
                              user.email}
                          </strong>

                          <span>
                            {
                              user.email
                            }
                          </span>
                        </td>

                        <td>
                          <select
                            value={
                              user.role
                            }
                            disabled={
                              isSelf ||
                              busy ===
                                `user-${user.allowed_user_id}`
                            }
                            onChange={
                              (
                                event
                              ) =>
                                updateUser(
                                  user,
                                  {
                                    role:
                                      event
                                        .target
                                        .value
                                  }
                                )
                            }
                          >
                            <option
                              value="OPERATOR"
                            >
                              Operator
                            </option>

                            <option
                              value="ADMIN"
                            >
                              Admin
                            </option>
                          </select>
                        </td>

                        <td>
                          <label
                            className={
                              styles.switchLabel
                            }
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(
                                user.enabled
                              )}
                              disabled={
                                isSelf ||
                                busy ===
                                  `user-${user.allowed_user_id}`
                              }
                              onChange={
                                (
                                  event
                                ) =>
                                  updateUser(
                                    user,
                                    {
                                      enabled:
                                        event
                                          .target
                                          .checked
                                    }
                                  )
                              }
                            />

                            {user.enabled
                              ? "Enabled"
                              : "Disabled"}
                          </label>
                        </td>

                        <td>
                          {formatDateTime(
                            user.last_login_at,
                            "Never"
                          )}
                        </td>

                        <td>
                          <button
                            type="button"
                            className={
                              styles.deleteButton
                            }
                            disabled={
                              isSelf ||
                              busy ===
                                `user-${user.allowed_user_id}`
                            }
                            onClick={
                              () =>
                                removeUser(
                                  user
                                )
                            }
                          >
                            <Trash2
                              size={
                                16
                              }
                            />

                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        className={
          styles.panel
        }
      >
        <div
          className={
            styles.panelHeader
          }
        >
          <div>
            <h2>
              Feature Access
            </h2>

            <p>
              Choose whether protected
              actions are available to
              operators and admins, or
              admins only.
            </p>
          </div>
        </div>

        <div
          className={
            styles.permissionGrid
          }
        >
          {permissions.map(
            (permission) => (
              <article
                key={
                  permission.permission_key
                }
                className={
                  styles.permissionCard
                }
              >
                <div>
                  <strong>
                    {permission.description ||
                      permission.permission_key}
                  </strong>

                  <span>
                    {
                      permission.permission_key
                    }
                  </span>
                </div>

                <select
                  value={
                    permission.access_level
                  }
                  disabled={
                    busy ===
                    `permission-${permission.permission_key}`
                  }
                  onChange={
                    (event) =>
                      changePermission(
                        permission,
                        event.target.value
                      )
                  }
                >
                  {Object.entries(
                    ACCESS_LABELS
                  ).map(
                    ([
                      value,
                      label
                    ]) => (
                      <option
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {
                          label
                        }
                      </option>
                    )
                  )}
                </select>
              </article>
            )
          )}
        </div>
      </section>
    </div>
  );
}

export default Admin;