import {
  TriangleAlert
} from "lucide-react";

import styles from "./SafetySummary.module.css";

function MetricCard({
  label,
  value,
  footer,
  tone = "neutral"
}) {
  return (
    <article className={`${styles.metric} ${styles[tone]}`}>
      <span className={styles.label}>
        {label}
      </span>

      <strong className={styles.value}>
        {value}
      </strong>

      <span className={styles.footer}>
        {footer}
      </span>
    </article>
  );
}

function SafetySummary({
  data = null,
  loading = false,
  error = false
}) {
  const value = (item) => {
    if (loading) return "…";
    if (error) return "—";

    return item ?? "—";
  };

  return (
    <section className={styles.grid}>
      <article className={styles.emergency}>
        <div className={styles.emergencyTitle}>
          <TriangleAlert size={22} strokeWidth={1.9} />
          <strong>Emergency Stop</strong>
        </div>

        <p>
          Immediately disconnects supported components and halts connected
          tasks. Requires manual reset.
        </p>

        <button type="button" disabled>
          <TriangleAlert size={19} strokeWidth={1.9} />
          <span>Emergency Stop</span>
        </button>
      </article>

      <MetricCard
        label="Commands"
        value={value(data?.commands)}
        footer="Total • 24h"
      />

      <MetricCard
        label="Commands blocked / Rejected"
        value={value(data?.blocked)}
        footer="High risk • 24h"
        tone="red"
      />

      <MetricCard
        label="Commands auto executed"
        value={value(data?.autoExecuted)}
        footer="Low/Medium risk • 24h"
        tone="green"
      />

      <MetricCard
        label="Commands pending approval"
        value={value(data?.pending)}
        footer="24h"
        tone="orange"
      />
    </section>
  );
}

export default SafetySummary;
