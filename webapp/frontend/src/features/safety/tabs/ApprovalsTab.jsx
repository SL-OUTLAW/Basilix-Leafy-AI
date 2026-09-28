import ActionIcon from "../components/ActionIcon";

import styles from "../Safety.module.css";

function ApprovalsTab({
  data = [],
  loading = false,
  error = false
}) {
  const items = Array.isArray(data) ? data : [];

  return (
    <section className={styles.fullPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>Approvals</h2>
          <p>Review commands that require human approval.</p>
        </div>

        <span>Read only</span>
      </div>

      {loading ? (
        <div className={styles.fullEmptyState}>
          <div>
            <h3>Loading approvals</h3>
            <p>Approval data is loading.</p>
          </div>
        </div>
      ) : error ? (
        <div className={styles.fullEmptyState}>
          <div>
            <h3>Approvals unavailable</h3>
            <p>Approval data could not be loaded.</p>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className={styles.fullEmptyState}>
          <div>
            <h3>No approval data available</h3>
            <p>
              Approval controls will be added when the backend approval
              workflow is available.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.approvalList}>
          {items.map((item) => (
            <article
              key={item.id}
              className={styles.approvalRow}
            >
              <ActionIcon
                type={item.type}
                size="activity"
              />

              <div className={styles.approvalCopy}>
                <div className={styles.approvalTitle}>
                  <strong>{item.command || "Command"}</strong>

                  <span
                    className={
                      item.risk === "Low Risk"
                        ? styles.lowBadge
                        : item.risk === "Medium Risk"
                          ? styles.mediumBadge
                          : styles.highBadge
                    }
                  >
                    {item.risk || "Unknown"}
                  </span>
                </div>

                <p>
                  {item.description || "No description available."}
                </p>

                <small>
                  {item.time || "—"} • {item.relativeTime || "—"}
                </small>
              </div>

              <span className={styles.pendingBadge}>
                Pending approval
              </span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ApprovalsTab;
