import { useEffect, useState } from "react";

import styles from "./RecommendationsTab.module.css";

function RecommendationsTab({
  data = null,
  loading = false,
  error = false,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}) {
  const recommendations = !loading && !error && Array.isArray(data) ? data : [];

  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (recommendations.length === 0) {
      setSelectedId(null);
      return;
    }

    const stillExists = recommendations.some((item) => item.id === selectedId);

    if (!stillExists) {
      setSelectedId(recommendations[0].id);
    }
  }, [recommendations, selectedId]);

  const selectedRecommendation =
    recommendations.find((item) => item.id === selectedId) || null;

  const renderListState = () => {
    if (loading) {
      return (
        <div className={styles.emptyState}>
          <div>
            <h3>Loading recommendations</h3>
            <p>Recommendation data is loading.</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.emptyState}>
          <div>
            <h3>Recommendations unavailable</h3>
            <p>Recommendation data could not be loaded.</p>
          </div>
        </div>
      );
    }

    if (recommendations.length === 0) {
      return (
        <div className={styles.emptyState}>
          <div>
            <h3>No recommendations</h3>
            <p>Recommendations will appear here when available.</p>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.recommendationList}>
        {recommendations.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              selectedId === item.id
                ? styles.selectedRecommendation
                : styles.recommendationItem
            }
            onClick={() => setSelectedId(item.id)}
          >
            <div className={styles.recommendationTop}>
              <span className={styles.itemTime}>{item.time || "-"}</span>

              <div className={styles.chipRow}>
                {item.priority && (
                  <span className={styles.chip}>{item.priority}</span>
                )}

                {item.status && (
                  <span
                    className={`${styles.chip} ${styles[`status${item.status}`] || ""}`}
                  >
                    {item.status}
                  </span>
                )}

                {item.type && <span className={styles.chip}>{item.type}</span>}
              </div>
            </div>

            <span className={styles.recommendationText}>
              <strong>{item.title || "Recommendation"}</strong>

              <span>{item.summary || "No summary available."}</span>
            </span>
          </button>
        ))}
      </div>
    );
  };

  const renderDetails = () => {
    if (loading) {
      return (
        <div className={styles.emptyState}>
          <div>
            <h3>Loading recommendation details</h3>
            <p>Recommendation details are loading.</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.emptyState}>
          <div>
            <h3>Recommendation details unavailable</h3>
            <p>Recommendation details could not be loaded.</p>
          </div>
        </div>
      );
    }

    if (!selectedRecommendation) {
      return (
        <div className={styles.emptyState}>
          <div>
            <h3>No recommendation selected</h3>
            <p>Select a recommendation to view its details.</p>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.recommendationDetails}>
        <div className={styles.detailHeader}>
          <div>
            <span className={styles.detailTime}>
              {selectedRecommendation.time || "-"}
            </span>

            <h3>{selectedRecommendation.title || "Recommendation"}</h3>
          </div>

          <div className={styles.chipRow}>
            {selectedRecommendation.priority && (
              <span className={styles.chip}>
                {selectedRecommendation.priority}
              </span>
            )}

            {selectedRecommendation.status && (
              <span
                className={`${styles.chip} ${styles[`status${selectedRecommendation.status}`] || ""}`}
              >
                {selectedRecommendation.status}
              </span>
            )}

            {selectedRecommendation.type && (
              <span className={styles.chip}>{selectedRecommendation.type}</span>
            )}
          </div>
        </div>

        <p className={styles.detailSummary}>
          {selectedRecommendation.summary || "No summary available."}
        </p>

        {selectedRecommendation.area && (
          <div className={styles.detailMeta}>
            <span>Area</span>

            <strong>{selectedRecommendation.area}</strong>
          </div>
        )}

        {Array.isArray(selectedRecommendation.context) &&
          selectedRecommendation.context.length > 0 && (
            <>
              <h4>Context</h4>

              <div className={styles.chipRow}>
                {selectedRecommendation.context.map((item) => (
                  <span key={item} className={styles.chip}>
                    {item}
                  </span>
                ))}
              </div>
            </>
          )}

        <h4>Reasoning</h4>

        {Array.isArray(selectedRecommendation.reasoning) &&
        selectedRecommendation.reasoning.length > 0 ? (
          <ul>
            {selectedRecommendation.reasoning.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.detailSummary}>
            No reasoning details available.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className={styles.recommendationsLayout}>
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Recommendations</h2>
            <p>Review the latest available recommendations.</p>
          </div>
        </div>

        {renderListState()}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Recommendation Details</h2>
            <p>Review the selected recommendation and its reasoning.</p>
          </div>
        </div>

        {renderDetails()}
      </section>
      {hasMore && !loading && (
        <button
          type="button"
          className={styles.loadMore}
          onClick={onLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? "Loading..." : "Load more recommendations"}
        </button>
      )}
    </div>
  );
}

export default RecommendationsTab;
