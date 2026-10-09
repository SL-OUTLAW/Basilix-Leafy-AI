import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";
import StateMessage from "../../../components/common/StateMessage/StateMessage";

import styles from "./RecentSafetyActivity.module.css";

function RecentSafetyActivity({
  data = [],
  loading = false,
  error = false
}) {
  const items = Array.isArray(data) ? data : [];

  return (
    <section className={styles.panel}>
      <h2>Recent Safety Activity • 24h</h2>

      <div className={styles.list}>
        {loading ? (
          <StateMessage compact message="Loading safety activity..." />
        ) : error ? (
          <StateMessage compact tone="error" message="Safety activity unavailable." />
        ) : items.length === 0 ? (
          <StateMessage compact message="No recent safety activity available." />
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={styles.row}
            >
              <time>{item.time || "—"}</time>

              <ActionIcon type={item.type} variant="activity" size={17} />

              <div className={styles.copy}>
                <strong>{item.command || "Activity"}</strong>

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

export default RecentSafetyActivity;
