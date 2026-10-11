import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Scale,
  Sprout,
  Wheat,
} from "lucide-react";

import styles from "./HarvestCard.module.css";

function formatWeight(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "-";
  }

  return `${number.toLocaleString()} g`;
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getCycleAge(startedAt, completedAt) {
  if (!startedAt) {
    return null;
  }

  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const days = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 86400000),
  );

  return days;
}

function HarvestCard({ data, loading = false, error = false }) {
  if (loading) {
    return (
      <section className={styles.card}>
        <div className={styles.emptyState}>Loading harvest information...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.card}>
        <div className={styles.emptyState}>
          Harvest information unavailable.
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2>Harvest Tracker</h2>
          </div>
        </div>

        <div className={styles.emptyState}>
          No harvest information available.
        </div>
      </section>
    );
  }

  const cycleName =
    data.cycleName ??
    data.cycle_name ??
    data.growCycleName ??
    data.grow_cycle_name ??
    "No grow cycle";

  const latestWeight =
    data.latestWeight ??
    data.latest_weight ??
    data.latestHarvestWeight ??
    data.latest_harvest_weight ??
    data.weight ??
    null;

  const totalWeight =
    data.totalWeight ??
    data.total_weight ??
    data.totalHarvestWeight ??
    data.total_harvest_weight ??
    latestWeight;

  const harvestCount =
    Number(
      data.harvestCount ??
        data.harvest_count ??
        data.recordCount ??
        data.record_count ??
        0,
    ) || 0;

  const startedAt =
    data.startedAt ??
    data.started_at ??
    data.startDate ??
    data.start_date ??
    null;

  const completedAt =
    data.completedAt ??
    data.completed_at ??
    data.endDate ??
    data.end_date ??
    null;

  const prediction =
    data.harvestPrediction ??
    data.harvest_prediction ??
    data.predictedHarvestDate ??
    data.predicted_harvest_date ??
    null;

  const age = getCycleAge(startedAt, completedAt);

  const averageWeight =
    harvestCount > 0 && Number.isFinite(Number(totalWeight))
      ? Number(totalWeight) / harvestCount
      : null;

  const isCompleted = status === "COMPLETED";

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <h2>Harvest Tracker</h2>
        </div>
      </div>

      <div className={styles.cycle}>
        <div className={styles.cycleIcon}>
          <Sprout />
        </div>

        <div className={styles.cycleText}>
          <span>Grow Cycle</span>

          <strong>{cycleName}</strong>
        </div>
      </div>

      <div className={styles.primaryMetric}>
        <div className={styles.metricIcon}>
          <Scale />
        </div>

        <div>
          <span>Latest Harvest</span>

          <strong>{formatWeight(latestWeight)}</strong>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.stat}>
          <span>Total Harvested</span>

          <strong>{formatWeight(totalWeight)}</strong>
        </div>

        <div className={styles.stat}>
          <span>Harvest Records</span>

          <strong>{harvestCount}</strong>
        </div>

        <div className={styles.stat}>
          <span>Average Harvest</span>

          <strong>{formatWeight(averageWeight)}</strong>
        </div>

        <div className={styles.stat}>
          <span>{isCompleted ? "Cycle Duration" : "Cycle Age"}</span>

          <strong>{age == null ? "-" : `${age} days`}</strong>
        </div>
      </div>

      <div className={styles.timeline}>
        <div className={styles.timelineItem}>
          <CalendarDays />

          <div>
            <span>Started</span>

            <strong>{formatDate(startedAt)}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HarvestCard;
