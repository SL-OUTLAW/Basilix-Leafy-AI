import styles from "./ActivityTab.module.css";

function ActivityTab({
  data = null,
  loading = false,
  error = false
}) {
  const activity = Array.isArray(data)
    ? data
    : [];

  return (
    <section className={styles.activityPanel}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>AI Activity</h2>
          <p>
            Review Leafy AI system activity and analysis history.
          </p>
        </div>

        <span className={styles.readOnly}>
          Read only
        </span>
      </div>

      {loading ? (
        <div className={styles.activityEmptyState}>
          <div>
            <h3>Loading activity</h3>
            <p>
              Recent activity is loading.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className={styles.activityEmptyState}>
          <div>
            <h3>Activity unavailable</h3>
            <p>
              Recent activity could not be loaded.
            </p>
          </div>
        </div>
      ) : activity.length === 0 ? (
        <div className={styles.activityEmptyState}>
          <div>
            <h3>No activity yet</h3>
            <p>
              Leafy AI activity will appear here when system events are available.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.timeline}>
          {activity.map((item) => (
            <article
              key={item.id}
              className={styles.timelineItem}
            >
              <div className={styles.timelineRail}>
                <span
                  className={styles.timelineDot}
                ></span>
              </div>

              <div className={styles.timelineTime}>
                {item.time || "—"}
              </div>

              <div className={styles.timelineContent}>
                <div className={styles.timelineHeading}>
                  <h3>
                    {item.title || "Activity"}
                  </h3>

                  {item.category && (
                    <span className={styles.chip}>
                      {item.category}
                    </span>
                  )}
                </div>

                <p>
                  {item.description ||
                    "No additional details available."}
                </p>

                {item.source && (
                  <span className={styles.sourceText}>
                    {item.source}
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ActivityTab;
