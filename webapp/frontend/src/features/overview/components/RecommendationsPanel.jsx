import {
  Droplets,
  Expand,
  Fan
} from "lucide-react";

import styles from "./RecommendationsPanel.module.css";

function getRecommendationIcon(title = "") {
  const name = title.toLowerCase();

  if (name.includes("fan")) {
    return {
      Icon: Fan,
      className: styles.fanIcon
    };
  }

  if (name.includes("irrigation")) {
    return {
      Icon: Droplets,
      className: styles.irrigationIcon
    };
  }

  return {
    Icon: Expand,
    className: styles.channelIcon
  };
}

function RecommendationsPanel({
  recommendations = [],
  loading = false,
  error = false
}) {
  const items = Array.isArray(recommendations)
    ? recommendations
    : [];

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>Pending Leafy AI Recommendations</h2>
          <p>Recommendations still waiting for review or action.</p>
        </div>

        {!loading && !error && (
          <span className={styles.count}>{items.length}</span>
        )}
      </div>

      {loading ? (
        <div className={styles.state}>
          Loading recommendations...
        </div>
      ) : error ? (
        <div className={styles.state}>
          Recommendations could not be loaded.
        </div>
      ) : items.length === 0 ? (
        <div className={styles.state}>
          No pending recommendations.
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => {
            const recommendationIcon =
              getRecommendationIcon(item.title);

            const Icon = recommendationIcon.Icon;

            return (
              <article
                key={item.id || item.title}
                className={styles.card}
              >
                <div
                  className={`${styles.icon} ${recommendationIcon.className}`}
                >
                  <Icon
                    className={styles.iconGraphic}
                    aria-hidden="true"
                  />
                </div>

                <div className={styles.content}>
                  <div className={styles.cardTop}>
                    <h3>{item.title || "Recommendation"}</h3>
                    <span className={styles.pending}>PENDING</span>
                  </div>

                  <p>
                    {item.description ||
                      "No additional details available."}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default RecommendationsPanel;
