import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";

import styles from "../Safety.module.css";

function ConfigurationTab({
  data = [],
  loading = false,
  error = false,
  state = null,
  canAdmin = false,
  onSetAiEnabled,
}) {
  const items = Array.isArray(data) ? data : [];

  return (
    <section className={styles.fullPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>Safety Configuration</h2>
          <p>Current risk levels and approval requirements.</p>
        </div>

        {canAdmin ? (
          <button
            type="button"
            className={styles.aiToggle}
            disabled={loading || Boolean(state?.emergency_stop)}
            onClick={() => onSetAiEnabled?.(!state?.ai_enabled)}
          >
            {state?.ai_enabled ? "Disable AI" : "Enable AI"}
          </button>
        ) : (
          <span>Read only</span>
        )}
      </div>

      {loading ? (
        <div className={styles.fullEmptyState}>
          <div>
            <h3>Loading configuration</h3>
            <p>Safety configuration is loading.</p>
          </div>
        </div>
      ) : error ? (
        <div className={styles.fullEmptyState}>
          <div>
            <h3>Configuration unavailable</h3>
            <p>Safety configuration could not be loaded.</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.fullEmptyState}>
          <div>
            <h3>No configuration data available</h3>
            <p>Safety configuration is not currently available.</p>
          </div>
        </div>
      ) : (
        <div className={styles.configurationList}>
          {items.map((item) => (
            <article key={item.id} className={styles.configurationRow}>
              <ActionIcon type={item.type} variant="activity" size={17} />

              <div className={styles.configurationCopy}>
                <strong>{item.command || "Action"}</strong>
                <span>{item.description || "No description available."}</span>
              </div>

              <div className={styles.configurationMeta}>
                <span
                  className={
                    item.risk === "Low Risk" ||
                    item.risk === "Monitored" ||
                    item.risk === "Enabled"
                      ? styles.lowBadge
                      : item.risk === "Medium Risk"
                        ? styles.mediumBadge
                        : styles.highBadge
                  }
                >
                  {item.risk || "Unknown"}
                </span>

                <small>
                  {item.approvalText || "Approval status unavailable"}
                </small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ConfigurationTab;
