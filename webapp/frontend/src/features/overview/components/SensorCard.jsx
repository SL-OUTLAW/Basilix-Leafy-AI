import {
  Droplets,
  FlaskConical,
  Gauge,
  Thermometer
} from "lucide-react";

import styles from "./SensorCard.module.css";

const sensorIcons = {
  ph: FlaskConical,
  temperature: Thermometer,
  water: Droplets,
  ec: Gauge
};

function SensorIcon({ type }) {
  const Icon = sensorIcons[type] || FlaskConical;

  return (
    <Icon
      className={styles.iconGraphic}
      aria-hidden="true"
    />
  );
}

function Sparkline({ values = [] }) {
  if (!Array.isArray(values) || values.length < 2) {
    return null;
  }

  const numericValues = values.filter(Number.isFinite);

  if (numericValues.length < 2) {
    return null;
  }

  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const range = max - min || 1;

  const points = numericValues
    .map((value, index) => {
      const x =
        (index / (numericValues.length - 1)) * 100;

      const y =
        30 - ((value - min) / range) * 24;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className={styles.sparkline}
      viewBox="0 0 100 34"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} />
    </svg>
  );
}

function SensorCard({
  type = "ph",
  title,
  value,
  status,
  tone = "neutral",
  trend = [],
  percentage = null
}) {
  const displayValue =
    value === null || value === undefined || value === ""
      ? "—"
      : value;

  const displayStatus = status || "Not available";

  const validPercentage =
    Number.isFinite(percentage)
      ? Math.max(0, Math.min(100, percentage))
      : null;

  return (
    <div className={`${styles.card} ${styles[tone]}`}>
      <div className={`${styles.iconArea} ${styles[`${type}Icon`] || ""}`}>
        <SensorIcon type={type} />
      </div>

      <div className={styles.content}>
        <h3>{title}</h3>

        <p className={styles.value}>
          {displayValue}
        </p>

        <span className={styles.status}>
          {displayStatus}
        </span>
      </div>

      <div className={styles.visual}>
        {type === "water" && validPercentage !== null ? (
          <div className={styles.waterTrack}>
            <div
              className={styles.waterFill}
              style={{ height: `${validPercentage}%` }}
            />
          </div>
        ) : (
          <Sparkline values={trend} />
        )}
      </div>
    </div>
  );
}

export default SensorCard;
