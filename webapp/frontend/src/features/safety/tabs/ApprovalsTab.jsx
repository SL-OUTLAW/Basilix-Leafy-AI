import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";

import styles from "../Safety.module.css";

function ApprovalsTab({
  data = [],
  loading = false,
  error = false,
  canReview = false,
  onApprove,
  onReject,
  hasMore = false,
  loadingMore = false,
  onLoadMore
}) {
  const items = Array.isArray(data) ? data : [];

  return (
    <section className={styles.fullPanel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>Approvals</h2>
          <p>Review commands that require human approval.</p>
        </div>

        <span>{canReview ? "Admin review" : "Read only"}</span>
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
            <h3>No approval requests</h3>
            <p>No approval requests are currently available.</p>
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
                variant="activity" size={17}
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

              {canReview && item.status === "PENDING" ? (
                <div className={styles.approvalActions}>
                  <button
                    type="button"
                    onClick={() => onApprove?.(item.id)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject?.(item.id)}
                  >
                    Reject
                  </button>
                </div>
              ) : (
                <span className={styles.pendingBadge}>
                  {item.status || "Pending approval"}
                </span>
              )}
            </article>
          ))}
        </div>
      )}
      {hasMore && !loading && <button type="button" className={styles.aiToggle} onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? "Loading..." : "Load more approvals"}</button>}
    </section>
  );
}

export default ApprovalsTab;
