import {
  Activity,
  Bot,
  Clock3,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import { getAIResultPreview } from "../../../utils/aiResult";
import styles from "./LeafyOverviewTab.module.css";

function MetricCard({ label, value, description, Icon, tone = "green" }) {
  return (
    <article className={`${styles.metricCard} ${styles[tone]}`}>
      <div className={styles.metricIcon}>
        <Icon aria-hidden="true" />
      </div>

      <div className={styles.metricContent}>
        <span className={styles.metricLabel}>{label}</span>
        <strong className={styles.metricValue}>{value}</strong>
        <p>{description}</p>
      </div>
    </article>
  );
}

function LeafyOverviewTab({ data = null, loading = false, error = false }) {
  const status = data?.status ?? {};
  const feed = Array.isArray(data?.feed) ? data.feed : [];
  const recommendations = Array.isArray(data?.recommendations)
    ? data.recommendations
    : [];
  const activity = Array.isArray(data?.activity) ? data.activity : [];

  const pendingRecommendations = recommendations.filter(
    (item) => item.status === "PENDING",
  );

  const latestPendingRecommendation = pendingRecommendations[0] || null;
  const latestActivity = activity[0] || null;

  const displayValue = (value) => {
    if (loading) return "…";
    if (error) return "-";
    return value || "-";
  };

  const latestRecommendationValue = loading
    ? "…"
    : error
      ? "-"
      : latestPendingRecommendation
        ? latestPendingRecommendation.type || "Pending"
        : "None";

  const latestRecommendationDescription = loading
    ? "Loading recommendation information..."
    : error
      ? "Recommendation information is unavailable."
      : latestPendingRecommendation?.title ||
        "No recommendation is currently waiting for review.";

  const latestActivityValue = loading
    ? "…"
    : error
      ? "-"
      : latestActivity?.category || "None";

  const latestActivityDescription = loading
    ? "Loading recent AI activity..."
    : error
      ? "Recent AI activity is unavailable."
      : latestActivity?.title || "No recent AI activity is available.";

  return (
    <div className={styles.overview}>
      <section className={styles.metricGrid}>
        <MetricCard
          label="AI Status"
          value={displayValue(status.aiStatus)}
          description="Current Leafy AI operating state."
          Icon={Bot}
          tone="green"
        />

        <MetricCard
          label="Last Analysis"
          value={displayValue(status.lastAnalysis)}
          description="Latest whole-farm AI analysis."
          Icon={Clock3}
          tone="blue"
        />

        <MetricCard
          label="Safety Status"
          value={displayValue(status.safetyStatus)}
          description="Current farm safety state."
          Icon={ShieldCheck}
          tone="green"
        />

        <MetricCard
          label="Pending Recommendations"
          value={loading || error ? "-" : pendingRecommendations.length}
          description="Recommendations waiting for review."
          Icon={Lightbulb}
          tone="orange"
        />

        <MetricCard
          label="AI Activity · 24h"
          value={loading || error ? "-" : activity.length}
          description="Recommendation and AI task activity."
          Icon={Activity}
          tone="blue"
        />

        <MetricCard
          label="Latest Recommendation"
          value={latestRecommendationValue}
          description={latestRecommendationDescription}
          Icon={Sparkles}
          tone="green"
        />

        <MetricCard
          label="Latest AI Activity"
          value={latestActivityValue}
          description={latestActivityDescription}
          Icon={Workflow}
          tone="blue"
        />
      </section>

      <section className={styles.aiFeed}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Recent AI Activity · 24 Hours</h2>
            <p>
              Recommendations and scheduled AI task activity recorded during the
              last 24 hours.
            </p>
          </div>
        </div>

        {loading ? (
          <div className={styles.feedEmptyState}>
            <div>
              <h3>Loading AI activity</h3>
              <p>Recent activity is loading.</p>
            </div>
          </div>
        ) : error ? (
          <div className={styles.feedEmptyState}>
            <div>
              <h3>AI activity unavailable</h3>
              <p>Recent activity could not be loaded.</p>
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
              <article key={item.id} className={styles.feedItem}>
                <span className={styles.feedDot} />

                <div className={styles.itemTime}>{item.time || "-"}</div>

                <div className={styles.feedContent}>
                  <div className={styles.feedTitleRow}>
                    <h3>{item.title || "Leafy AI update"}</h3>

                    {item.category && (
                      <span className={styles.feedStatus}>{item.category}</span>
                    )}
                  </div>

                  <p>
                    {getAIResultPreview(item.result || item.description, 520) ||
                      "No additional details available."}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default LeafyOverviewTab;
