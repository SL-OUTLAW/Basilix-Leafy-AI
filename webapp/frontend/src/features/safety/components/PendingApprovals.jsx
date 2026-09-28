import ActionIcon from "./ActionIcon";

import styles from "./PendingApprovals.module.css";

function PendingApprovals({
  data = [],
  loading = false,
  error = false,
  onViewAll
}) {
  const items = Array.isArray(data) ? data : [];

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>Pending Approvals • 24h</h2>
          <p>Commands awaiting human review.</p>
        </div>

        <button
          type="button"
          onClick={onViewAll}
        >
          View All
        </button>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.state}>
            Loading pending approvals...
          </div>
        ) : error ? (
          <div className={styles.state}>
            Pending approvals unavailable.
          </div>
        ) : items.length === 0 ? (
          <div className={styles.state}>
            No pending approvals available.
          </div>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={styles.row}
            >
              <time>{item.time || "—"}</time>

              <ActionIcon type={item.type} size="compact" />

              <div className={styles.copy}>
                <strong>{item.command || "Command"}</strong>

                <span>
                  {item.description || "No description available."}
                </span>
              </div>

              <span className={styles.relative}>
                {item.relativeTime || "—"}
              </span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default PendingApprovals;
