import { useState } from "react";
import MarkdownContent from "../../../components/common/MarkdownContent/MarkdownContent";
import Modal from "../../../components/common/Modal/Modal";
import { getAIResultContent, getAIResultPreview } from "../../../utils/aiResult";
import styles from "./ActivityTab.module.css";

function getActivityContent(item) {
  return (
    getAIResultContent(item?.result) ||
    getAIResultContent(item?.description) ||
    "No stored result for this activity."
  );
}

function ActivityTab({
  data = null,
  loading = false,
  error = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore
}) {
  const activity = Array.isArray(data) ? data : [];
  const [selected, setSelected] = useState(null);

  return (
    <section className={styles.activityPanel}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Recent 24hr AI Activity</h2>
          <p>
            Recommendations and scheduled task executions from the last 24 hours.
            Select an item to inspect its complete stored result.
          </p>
        </div>
        <span className={styles.readOnly}>Read only</span>
      </div>

      {loading ? (
        <div className={styles.activityEmptyState}>
          <div><h3>Loading activity</h3><p>Recent activity is loading.</p></div>
        </div>
      ) : error ? (
        <div className={styles.activityEmptyState}>
          <div><h3>Activity unavailable</h3><p>Recent activity could not be loaded.</p></div>
        </div>
      ) : activity.length === 0 ? (
        <div className={styles.activityEmptyState}>
          <div><h3>No activity in the last 24 hours</h3></div>
        </div>
      ) : (
        <div className={styles.timeline}>
          {activity.map((item) => {
            const preview =
              getAIResultPreview(item.result || item.description, 520) ||
              "No additional details available.";

            return (
              <button
                type="button"
                key={item.id}
                className={styles.timelineItem}
                onClick={() => setSelected(item)}
              >
                <div className={styles.timelineRail}>
                  <span className={styles.timelineDot} />
                </div>
                <div className={styles.timelineTime}>{item.time || "—"}</div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineHeading}>
                    <h3>{item.title || "Activity"}</h3>
                    {item.category && <span className={styles.chip}>{item.category}</span>}
                  </div>
                  <p className={styles.preview}>{preview}</p>
                  {item.source && <span className={styles.sourceText}>{item.source}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {hasMore && !loading && (
        <button
          type="button"
          className={styles.loadMore}
          onClick={onLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more activity"}
        </button>
      )}

      {selected && (
        <Modal title={selected.title || "Activity Result"} onClose={() => setSelected(null)}>
          <div className={styles.resultMeta}>
            <span>{selected.time}</span>
            <span>{selected.category}</span>
            <span>{selected.taskAction || selected.source}</span>
          </div>
          <div className={styles.resultView}>
            <MarkdownContent value={getActivityContent(selected)} />
          </div>
        </Modal>
      )}
    </section>
  );
}

export default ActivityTab;
