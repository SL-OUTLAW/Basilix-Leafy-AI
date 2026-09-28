import styles from "./LeafyOverviewTab.module.css";

function SummaryCard({
  label,
  value,
  description
}) {
  return (
    <article className={styles.summaryCard}>
      <span className={styles.cardLabel}>
        {label}
      </span>

      <strong className={styles.cardValue}>
        {value}
      </strong>

      <p>{description}</p>
    </article>
  );
}

function LeafyOverviewTab({
  data = null,
  loading = false,
  error = false
}) {
  const status = data?.status ?? {};

  const feed = Array.isArray(data?.feed)
    ? data.feed
    : [];

  const recommendations = Array.isArray(
    data?.recommendations
  )
    ? data.recommendations
    : [];

  const activity = Array.isArray(data?.activity)
    ? data.activity
    : [];

  const latestRecommendation =
    recommendations[0] || null;

  const latestActivity = activity[0] || null;

  const statusValue = (value) => {
    if (loading) {
      return "Loading...";
    }

    if (error) {
      return "Unavailable";
    }

    return value || "—";
  };

  return (
    <div className={styles.overview}>
      <div className={styles.statusGrid}>
        <SummaryCard
          label="AI Status"
          value={statusValue(status.aiStatus)}
          description={
            loading
              ? "Loading system status..."
              : error
                ? "AI status is unavailable."
                : status.aiStatus
                  ? "Leafy AI is reporting its latest available system state."
                  : "AI status is not available yet."
          }
        />

        <SummaryCard
          label="Last Analysis"
          value={statusValue(
            status.lastAnalysis
          )}
          description={
            loading
              ? "Loading analysis information..."
              : error
                ? "Analysis information is unavailable."
                : status.lastAnalysis
                  ? "Latest available analysis timestamp."
                  : "No analysis timestamp available."
          }
        />

        <SummaryCard
          label="Safety Status"
          value={statusValue(
            status.safetyStatus
          )}
          description={
            loading
              ? "Loading safety status..."
              : error
                ? "Safety status is unavailable."
                : status.safetyStatus
                  ? "Latest available safety state."
                  : "Safety status is not available yet."
          }
        />
      </div>

      <div className={styles.highlightGrid}>
        <section className={styles.highlightCard}>
          <div className={styles.highlightHeader}>
            <div>
              <span className={styles.eyebrow}>
                Latest recommendation
              </span>

              <h2>
                {loading
                  ? "Loading..."
                  : latestRecommendation?.title ||
                    "No recommendation available"}
              </h2>
            </div>

            <span className={styles.readOnly}>
              Read only
            </span>
          </div>

          <p className={styles.highlightDescription}>
            {loading
              ? "Loading recommendation information..."
              : error
                ? "Recommendation information is unavailable."
                : latestRecommendation?.summary ||
                  "No recent recommendation is available."}
          </p>

          {latestRecommendation && (
            <div className={styles.chipRow}>
              {latestRecommendation.priority && (
                <span className={styles.chip}>
                  {latestRecommendation.priority}
                </span>
              )}

              {latestRecommendation.type && (
                <span className={styles.chip}>
                  {latestRecommendation.type}
                </span>
              )}

              {latestRecommendation.area && (
                <span className={styles.chip}>
                  {latestRecommendation.area}
                </span>
              )}
            </div>
          )}
        </section>

        <section className={styles.highlightCard}>
          <div className={styles.highlightHeader}>
            <div>
              <span className={styles.eyebrow}>
                Recent activity
              </span>

              <h2>
                {loading
                  ? "Loading..."
                  : latestActivity?.title ||
                    "No recent activity"}
              </h2>
            </div>

            <span className={styles.highlightTime}>
              {latestActivity?.time || "—"}
            </span>
          </div>

          <p className={styles.highlightDescription}>
            {loading
              ? "Loading recent activity..."
              : error
                ? "Recent activity is unavailable."
                : latestActivity?.description ||
                  "No recent activity is available."}
          </p>

          {latestActivity && (
            <div className={styles.chipRow}>
              {latestActivity.category && (
                <span className={styles.chip}>
                  {latestActivity.category}
                </span>
              )}

              {latestActivity.source && (
                <span className={styles.chip}>
                  {latestActivity.source}
                </span>
              )}
            </div>
          )}
        </section>
      </div>

      <section className={styles.aiFeed}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>AI Feed</h2>
            <p>
              Recent Leafy AI analysis and system activity.
            </p>
          </div>

          <span className={styles.readOnly}>
            Read only
          </span>
        </div>

        {loading ? (
          <div className={styles.feedEmptyState}>
            <div>
              <h3>Loading AI activity</h3>
              <p>
                Recent activity is loading.
              </p>
            </div>
          </div>
        ) : error ? (
          <div className={styles.feedEmptyState}>
            <div>
              <h3>AI activity unavailable</h3>
              <p>
                Recent activity could not be loaded.
              </p>
            </div>
          </div>
        ) : feed.length === 0 ? (
          <div className={styles.feedEmptyState}>
            <div>
              <h3>No AI activity yet</h3>
              <p>
                Leafy AI updates will appear here when activity is available.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.feedList}>
            {feed.map((item) => (
              <article
                key={item.id}
                className={styles.feedItem}
              >
                <span className={styles.feedDot}></span>

                <div className={styles.itemTime}>
                  {item.time || "—"}
                </div>

                <div>
                  <h3>
                    {item.title ||
                      "Leafy AI update"}
                  </h3>

                  <p>
                    {item.description ||
                      "No additional details available."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className={styles.overviewSummaryGrid}>
        <article className={styles.smallSummaryCard}>
          <span className={styles.eyebrow}>
            Recommendations
          </span>

          <strong>
            {loading
              ? "—"
              : error
                ? "—"
                : recommendations.length}
          </strong>

          <p>
            {loading
              ? "Loading recommendations..."
              : error
                ? "Recommendations unavailable."
                : recommendations.length === 1
                  ? "recommendation currently available"
                  : "recommendations currently available"}
          </p>
        </article>

        <article className={styles.smallSummaryCard}>
          <span className={styles.eyebrow}>
            Recent activity
          </span>

          <strong>
            {loading
              ? "—"
              : error
                ? "—"
                : activity.length}
          </strong>

          <p>
            {loading
              ? "Loading activity..."
              : error
                ? "Activity unavailable."
                : activity.length === 1
                  ? "activity entry currently available"
                  : "activity entries currently available"}
          </p>
        </article>
      </div>
    </div>
  );
}

export default LeafyOverviewTab;
