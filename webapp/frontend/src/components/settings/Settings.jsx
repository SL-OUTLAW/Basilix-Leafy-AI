import { useEffect, useState } from "react";
import { Camera, RefreshCw, RotateCcw, Save } from "lucide-react";

import {
  addCamera,
  getCameras,
  getEngineSettings,
  reloadEngineSettings,
  resetEngineSettings,
  updateEngineSettings
} from "../../services/settingsApi";

import styles from "./Settings.module.css";

const EMPTY_CAMERA = {
  camera_name: "",
  level_no: 1,
  ip_address: "",
  rtsp_path: ""
};

function Settings({ theme, setTheme, token, onTokenRefresh, user, access }) {
  const [engineSettings, setEngineSettings] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [cameras, setCameras] = useState([]);
  const [camera, setCamera] = useState(EMPTY_CAMERA);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const canEdit =
    user?.role === "ADMIN" &&
    access?.allowed?.SETTINGS_MANAGE !== false;

  function applySettings(settings) {
    const next = settings || {};
    setEngineSettings(next);
    setDrafts(
      Object.fromEntries(
        Object.entries(next).map(([key, value]) => [
          key,
          JSON.stringify(value, null, 2)
        ])
      )
    );
  }

  async function loadSettings(reload = false) {
    if (user?.role !== "ADMIN" || !token) return;

    setLoading(true);
    setError("");

    try {
      const [data, cameraData] = await Promise.all([
        reload
          ? reloadEngineSettings(token, onTokenRefresh)
          : getEngineSettings(token, onTokenRefresh),
        getCameras(token, onTokenRefresh)
      ]);

      applySettings(data.settings);
      setCameras(
        Array.isArray(cameraData.cameras)
          ? cameraData.cameras
          : []
      );
    } catch (loadError) {
      setError(loadError.message || "Unable to load Engine settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings(false);
  }, [token, user?.role]);

  async function saveGroup(key) {
    setBusy(key);
    setError("");

    try {
      let value = JSON.parse(drafts[key]);

      if (key === "security") {
        const { ai_enabled, emergency_stop, ...editable } = value;
        value = editable;
      }

      const data = await updateEngineSettings(
        token,
        onTokenRefresh,
        { [key]: value }
      );

      applySettings(data.settings);
    } catch (saveError) {
      setError(
        saveError instanceof SyntaxError
          ? `Invalid JSON in ${key}`
          : saveError.message || "Unable to save setting"
      );
    } finally {
      setBusy("");
    }
  }

  async function restoreGroup(key) {
    if (!window.confirm(`Restore ${key} to safe defaults?`)) return;

    setBusy(`reset-${key}`);
    setError("");

    try {
      const data = await resetEngineSettings(token, onTokenRefresh, key);
      applySettings(data.settings);
    } catch (resetError) {
      setError(resetError.message || "Unable to restore defaults");
    } finally {
      setBusy("");
    }
  }

  async function createCamera(event) {
    event.preventDefault();
    setBusy("camera");
    setError("");

    try {
      await addCamera(token, onTokenRefresh, {
        camera_name: camera.camera_name.trim(),
        level_no: Number(camera.level_no),
        ip_address: camera.ip_address.trim(),
        rtsp_path: camera.rtsp_path.trim() || null
      });

      setCamera(EMPTY_CAMERA);
      await loadSettings(false);
    } catch (cameraError) {
      setError(cameraError.message || "Unable to add camera");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className={styles.settings}>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>
          <h2>Appearance</h2>
          <p>Choose how Leafy AI looks on your device.</p>
        </div>

        <div className={styles.themeOptions}>
          <button
            type="button"
            className={
              theme === "dark"
                ? `${styles.themeButton} ${styles.selected}`
                : styles.themeButton
            }
            onClick={() => setTheme("dark")}
          >
            <span className={styles.previewDark} />
            <div><strong>Dark</strong><span>Dark background with light text</span></div>
          </button>

          <button
            type="button"
            className={
              theme === "light"
                ? `${styles.themeButton} ${styles.selected}`
                : styles.themeButton
            }
            onClick={() => setTheme("light")}
          >
            <span className={styles.previewLight} />
            <div><strong>Light</strong><span>Light background with dark text</span></div>
          </button>
        </div>
      </section>

      {user?.role === "ADMIN" && (
        <>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <h2>Camera Management</h2>
              <p>Add farm cameras. The Engine reloads the camera list after creation.</p>
            </div>

            <form className={styles.cameraForm} onSubmit={createCamera}>
              <input
                value={camera.camera_name}
                onChange={(event) => setCamera({ ...camera, camera_name: event.target.value })}
                placeholder="Camera name"
                required
              />
              <select
                value={camera.level_no}
                onChange={(event) => setCamera({ ...camera, level_no: event.target.value })}
              >
                <option value="1">Level 1</option>
                <option value="2">Level 2</option>
              </select>
              <input
                value={camera.ip_address}
                onChange={(event) => setCamera({ ...camera, ip_address: event.target.value })}
                placeholder="IP address"
                required
              />
              <input
                value={camera.rtsp_path}
                onChange={(event) => setCamera({ ...camera, rtsp_path: event.target.value })}
                placeholder="RTSP path (optional)"
              />
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={!canEdit || busy === "camera"}
              >
                <Camera size={16} />
                {busy === "camera" ? "Adding..." : "Add Camera"}
              </button>
            </form>

            <div className={styles.cameraList}>
              {cameras.map((item) => (
                <span key={item.camera_id}>
                  {item.camera_name} · Level {item.level_no} · {item.status}
                </span>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>
              <h2>Engine Settings</h2>
              <p>
                Edit persisted settings. Invalid or missing values are repaired from
                Engine defaults. AI and emergency state can only be changed in Safety.
              </p>
            </div>

            <div className={styles.engineSettingsHeader}>
              <span>
                {loading
                  ? "Loading..."
                  : engineSettings
                    ? `${Object.keys(engineSettings).length} setting groups loaded`
                    : "No settings loaded"}
              </span>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => loadSettings(true)}
                disabled={loading}
              >
                <RefreshCw size={15} />
                Reload
              </button>
            </div>

            {error && <p className={styles.settingsError}>{error}</p>}

            {engineSettings && (
              <div className={styles.editorGrid}>
                {Object.keys(engineSettings).sort().map((key) => (
                  <article key={key} className={styles.editorCard}>
                    <div className={styles.editorHeader}>
                      <strong>{key}</strong>
                      <div>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => restoreGroup(key)}
                          disabled={!canEdit || busy === `reset-${key}`}
                        >
                          <RotateCcw size={14} />
                          Defaults
                        </button>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={() => saveGroup(key)}
                          disabled={!canEdit || busy === key}
                        >
                          <Save size={14} />
                          {busy === key ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={drafts[key] || ""}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [key]: event.target.value }))
                      }
                      spellCheck="false"
                      readOnly={!canEdit}
                    />
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default Settings;
