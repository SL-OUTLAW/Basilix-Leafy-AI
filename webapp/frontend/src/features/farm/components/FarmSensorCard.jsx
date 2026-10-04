import {
  lazy,
  Suspense,
  useState
} from "react";

import { Droplets, Expand, FlaskConical, Gauge, Thermometer, Waves } from "lucide-react";

import ExpandModal from "./ExpandModal";

import styles from "./FarmSensorCard.module.css";

const SensorHistoryChart = lazy(
  () => import("./SensorHistoryChart")
);

function Sparkline({ values = [] }) {
  const numericValues = Array.isArray(values)
    ? values.filter(Number.isFinite)
    : [];

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
        34 - ((value - min) / range) * 28;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      className={styles.sparkline}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} />
    </svg>
  );
}

function WaterGauge({ percentage }) {
  const value = Number.isFinite(percentage)
    ? Math.min(100, Math.max(0, percentage))
    : null;

  if (value === null) {
    return null;
  }

  return (
    <div className={styles.waterGauge}>
      <div
        className={styles.waterFill}
        style={{ height: `${value}%` }}
      />
    </div>
  );
}


function SensorTypeIcon({ sensorType, title }) {
  const key = String(sensorType || title || "").toLowerCase();
  const Icon = key.includes("ph") ? FlaskConical : key.includes("ec") ? Gauge : key.includes("water level") ? Waves : key.includes("temperature") ? Thermometer : key.includes("humidity") ? Droplets : Gauge;
  return <Icon size={18} aria-hidden="true" />;
}

function FarmSensorCard({
  title,
  data = null,
  loading = false,
  error = false,
  tone = "neutral",
  type = "line"
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const value =
    data?.value === null ||
    data?.value === undefined ||
    data?.value === ""
      ? "—"
      : data.value;

  const status = loading
    ? "Loading..."
    : error
      ? "Unavailable"
      : data?.status || "Not available";

  const connection = loading
    ? "Checking..."
    : error
      ? "Unavailable"
      : data?.online === true
        ? "Live"
        : data?.online === false
          ? "Offline"
          : "Unknown";

  const trend =
    Array.isArray(data?.history) && data.history.length >= 2
      ? data.history
          .map((item) => Number(item?.value))
          .filter(Number.isFinite)
      : Array.isArray(data?.trend)
        ? data.trend
        : [];

  const history = Array.isArray(data?.history)
    ? data.history
    : [];

  const hasTrend =
    !loading &&
    !error &&
    trend.filter(Number.isFinite).length >= 2;

  const hasHistory =
    !loading &&
    !error &&
    history.length >= 2;

  const hasWaterLevel =
    !loading &&
    !error &&
    Number.isFinite(data?.percentage);

  const chartMessage = loading
    ? "Loading live data..."
    : error
      ? "Live data unavailable"
      : "No live data";

  const connectionClass =
    data?.online === true && !loading && !error
      ? styles.connectionLive
      : data?.online === false && !loading && !error
        ? styles.connectionOffline
        : styles.connectionNeutral;

  const renderSummaryChart = () => {
    if (type === "water" && hasWaterLevel) {
      return (
        <WaterGauge percentage={data.percentage} />
      );
    }

    if (hasTrend) {
      return <Sparkline values={trend} />;
    }

    return <span>{chartMessage}</span>;
  };

  const renderExpandedChart = () => {
    if (hasHistory) {
      return (
        <Suspense fallback={<span>Loading chart...</span>}>
          <SensorHistoryChart
            history={history}
            tone={tone}
            unit={data?.unit || ""}
          />
        </Suspense>
      );
    }

    return renderSummaryChart();
  };

  return (
    <>
      <article
        className={`${styles.card} ${styles[tone] || styles.neutral}`}
      >
        <div className={styles.top}>
          <div>
            <h3 className={styles.title}><SensorTypeIcon sensorType={data?.type} title={title} />{title}</h3>
            <p className={styles.value}>{value}</p>
          </div>

          <button
            className={styles.expandButton}
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label={`Expand ${title}`}
          >
            <Expand aria-hidden="true" />
          </button>
        </div>

        <div className={styles.chart}>
          {renderSummaryChart()}
        </div>

        <div className={styles.bottom}>
          <span className={styles.statusText}>
            {status}
          </span>

          <span className={connectionClass}>
            ● {connection}
          </span>
        </div>
      </article>

      {isExpanded && (
        <ExpandModal
          title={title}
          onClose={() => setIsExpanded(false)}
          fullScreen
        >
          <div
            className={`${styles.expanded} ${styles[tone] || styles.neutral}`}
          >
            <div className={styles.expandedTop}>
              <p className={styles.expandedValue}>
                {value}
              </p>

              <span className={connectionClass}>
                ● {connection}
              </span>
            </div>

            <div className={styles.expandedChart}>
              {renderExpandedChart()}
            </div>

            <div className={styles.expandedBottom}>
              <span className={styles.statusText}>
                {status}
              </span>
            </div>
          </div>
        </ExpandModal>
      )}
    </>
  );
}

export default FarmSensorCard;