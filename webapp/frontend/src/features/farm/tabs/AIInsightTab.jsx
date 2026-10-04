import styles from "./AIInsightTab.module.css";

function AIInsightTab({
  data = null,
  loading = false,
  error = false
}) {
  const recommendations = Array.isArray(data?.recommendations)
    ? data.recommendations
    : [];

  return (
    <section className={styles.insight}>
      <h2>AI Insight</h2>

      {loading ? (
        <p>Loading AI recommendations...</p>
      ) : error ? (
        <p>AI insight data is unavailable.</p>
      ) : recommendations.length === 0 ? (
        <p>No AI recommendations are currently available.</p>
      ) : (
        <div className={styles.list}>
          {recommendations.map((item) => (
            <article
              key={item.recommendation_id}
              className={styles.item}
            >
              <div className={styles.itemHeader}>
                <strong>{item.recommendation_message}</strong>
                <span>{item.status}</span>
              </div>

              <p>{item.recommendation_reason}</p>

              <small>
                {item.level_no === 0
                  ? "Global"
                  : `Level ${item.level_no}`}
                {item.risk_level
                  ? ` • ${item.risk_level} risk`
                  : ""}
              </small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default AIInsightTab;
