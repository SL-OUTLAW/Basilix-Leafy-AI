import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";
import styles from "../Safety.module.css";

function SafetyActivityTab({
  data = [],
  loading = false,
  error = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  const items = Array.isArray(data) ? data : [];
  return (
    <section className={styles.fullPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>Safety Activity · Last 24 Hours</h2>
          <p>
            Safety-related approvals, rejected or blocked actions, and executed
            protected tasks.
          </p>
        </div>
      </div>
      {loading ? (
        <div className={styles.fullEmptyState}>Loading safety activity...</div>
      ) : error ? (
        <div className={styles.fullEmptyState}>
          Safety activity unavailable.
        </div>
      ) : items.length === 0 ? (
        <div className={styles.fullEmptyState}>
          No safety activity in the last 24 hours.
        </div>
      ) : (
        <div className={styles.configurationList}>
          {items.map((item) => (
            <article key={item.id} className={styles.configurationRow}>
              <ActionIcon type={item.type} variant="activity" size={17} />
              <div className={styles.configurationCopy}>
                <strong>{item.command}</strong>
                <span>{item.description}</span>
                <small>
                  {item.time} · {item.source}
                </small>
              </div>
              <div className={styles.configurationMeta}>
                <span>{item.status}</span>
                {item.risk && <small>{item.risk} risk</small>}
              </div>
            </article>
          ))}
        </div>
      )}
      {hasMore && !loading && (
        <button
          type="button"
          className={styles.aiToggle}
          onClick={onLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more safety activity"}
        </button>
      )}
    </section>
  );
}
export default SafetyActivityTab;
