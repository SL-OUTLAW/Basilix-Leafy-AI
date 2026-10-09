import { CalendarDays } from "lucide-react";

import styles from "./HarvestCard.module.css";

function HarvestCard({ data = null, loading = false, error = false }) {
  const value =
    data?.predictedValue === null ||
    data?.predictedValue === undefined ||
    data?.predictedValue === ""
      ? "—"
      : data.predictedValue;

  let trackerText = "Harvest information is not available.";

  if (loading) {
    trackerText = "Loading harvest information...";
  } else if (error) {
    trackerText = "Harvest information is unavailable.";
  } else if (data?.trackerText) {
    trackerText = data.trackerText;
  }

  return (
    <section className={styles.card}>
      <div className={styles.summary}>
        <h2>Harvest</h2>

        <p className={styles.value}>{loading ? "—" : value}</p>

        <span>{data?.label || "Predicted Harvest"}</span>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.tracker}>
        <div className={styles.trackerTitle}>
          <span className={styles.trackerIcon}>
            <CalendarDays aria-hidden="true" />
          </span>

          <h3>{data?.trackerTitle || "Harvest Tracker"}</h3>
        </div>

        <p>{trackerText}</p>
      </div>
    </section>
  );
}

export default HarvestCard;
