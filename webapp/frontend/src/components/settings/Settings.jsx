import styles from "./Settings.module.css";

function Settings({ theme, setTheme }) {
  return (
    <div className={styles.settings}>
      <div className={styles.section}>
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
            <span className={styles.previewDark}></span>

            <div>
              <strong>Dark</strong>
              <span>Dark background with light text</span>
            </div>
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
            <span className={styles.previewLight}></span>

            <div>
              <strong>Light</strong>
              <span>Light background with dark text</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Settings;