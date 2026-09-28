import ActionIcon from "./ActionIcon";

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
          <div className={styles.state}>
            Loading safety activity...
          </div>
        ) : error ? (
          <div className={styles.state}>
            Safety activity unavailable.
          </div>
        ) : items.length === 0 ? (
          <div className={styles.state}>
            No recent safety activity available.
          </div>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={styles.row}
            >
              <time>{item.time || "—"}</time>

              <ActionIcon type={item.type} size="activity" />

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
