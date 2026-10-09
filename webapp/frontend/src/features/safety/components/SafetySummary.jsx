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
  error = false,
  emergencyStop = false,
  canAdmin = false,
  onEmergencyStop
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

        <button
          type="button"
          disabled={!canAdmin || loading || !onEmergencyStop}
          onClick={onEmergencyStop}
        >
          <TriangleAlert size={19} strokeWidth={1.9} />
          <span>
            {emergencyStop
              ? "Clear Emergency Stop"
              : "Emergency Stop"}
          </span>
        </button>
      </article>

      <MetricCard
        label="Commands"
        value={value(data?.commands)}
        footer="Total • recent"
      />

      <MetricCard
        label="Commands blocked / Rejected"
        value={value(data?.blocked)}
        footer="Recent executions"
        tone="red"
      />

      <MetricCard
        label="Commands auto executed"
        value={value(data?.autoExecuted)}
        footer="Completed executions"
        tone="green"
      />

      <MetricCard
        label="Commands pending approval"
        value={value(data?.pending)}
        footer="Pending approvals"
        tone="orange"
      />
    </section>
  );
}

export default SafetySummary;
