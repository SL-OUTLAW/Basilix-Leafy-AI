import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";
import StateMessage from "../../../components/common/StateMessage/StateMessage";

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
          <StateMessage compact message="Loading pending approvals..." />
        ) : error ? (
          <StateMessage compact tone="error" message="Pending approvals unavailable." />
        ) : items.length === 0 ? (
          <StateMessage compact message="No pending approvals available." />
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={styles.row}
            >
              <time>{item.time || "—"}</time>

              <ActionIcon type={item.type} variant="compact" size={16} />

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
