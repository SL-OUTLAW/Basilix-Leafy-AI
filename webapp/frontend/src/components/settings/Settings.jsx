import { useEffect, useState } from "react";
import { Save, RefreshCw } from "lucide-react";
import { getEngineSettings, reloadEngineSettings, updateEngineSettings } from "../../services/settingsApi";
import styles from "./Settings.module.css";

function Settings({ theme, setTheme, token, onTokenRefresh, user, access }) {
  const [engineSettings, setEngineSettings] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const canEdit = user?.role === "ADMIN" && access?.allowed?.SETTINGS_MANAGE !== false;

  function applySettings(settings) {
    const next = settings || {};
    setEngineSettings(next);
    setDrafts(Object.fromEntries(Object.entries(next).map(([key, value]) => [key, JSON.stringify(value, null, 2)])));
  }

  async function loadSettings(reload = false) {
    if (user?.role !== "ADMIN" || !token) return;
    setLoading(true); setError("");
    try {
      const data = reload ? await reloadEngineSettings(token, onTokenRefresh) : await getEngineSettings(token, onTokenRefresh);
      applySettings(data.settings);
    } catch (err) { setError(err.message || "Unable to load Engine settings"); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadSettings(false); }, [token, user?.role]);

  async function saveGroup(key) {
    setBusy(key); setError("");
    try {
      const value = JSON.parse(drafts[key]);
      const data = await updateEngineSettings(token, onTokenRefresh, { [key]: value });
      applySettings(data.settings);
    } catch (err) { setError(err instanceof SyntaxError ? `Invalid JSON in ${key}` : err.message || "Unable to save setting"); }
    finally { setBusy(""); }
  }

  return (
    <div className={styles.settings}>
      <section className={styles.section}>
        <div className={styles.sectionTitle}><h2>Appearance</h2><p>Choose how Leafy AI looks on your device.</p></div>
        <div className={styles.themeOptions}>
          <button type="button" className={theme === "dark" ? `${styles.themeButton} ${styles.selected}` : styles.themeButton} onClick={() => setTheme("dark")}><span className={styles.previewDark}></span><div><strong>Dark</strong><span>Dark background with light text</span></div></button>
          <button type="button" className={theme === "light" ? `${styles.themeButton} ${styles.selected}` : styles.themeButton} onClick={() => setTheme("light")}><span className={styles.previewLight}></span><div><strong>Light</strong><span>Light background with dark text</span></div></button>
        </div>
      </section>

      {user?.role === "ADMIN" && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}><h2>Engine Settings</h2><p>Edit persisted Engine setting groups. Changes are written through the Engine API.</p></div>
          <div className={styles.engineSettingsHeader}><span>{loading ? "Loading..." : engineSettings ? `${Object.keys(engineSettings).length} setting groups loaded` : "No settings loaded"}</span><button type="button" onClick={() => loadSettings(true)} disabled={loading}><RefreshCw size={15} /> Reload</button></div>
          {error && <p className={styles.settingsError}>{error}</p>}
          {engineSettings && <div className={styles.editorGrid}>{Object.keys(engineSettings).sort().map((key) => (
            <article key={key} className={styles.editorCard}>
              <div className={styles.editorHeader}><strong>{key}</strong><button type="button" onClick={() => saveGroup(key)} disabled={!canEdit || busy === key}><Save size={14} /> {busy === key ? "Saving..." : "Save"}</button></div>
              <textarea value={drafts[key] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} spellCheck="false" readOnly={!canEdit} />
            </article>
          ))}</div>}
        </section>
      )}
    </div>
  );
}

export default Settings;
