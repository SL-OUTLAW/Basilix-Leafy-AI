import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { Expand } from "lucide-react";

import { getSystemIcon } from "../../../components/common/ActionIcon/ActionIcon";
import { getSensorReadings } from "../../../services/farmApi";

import ExpandModal from "./ExpandModal";

import styles from "./FarmSensorCard.module.css";

const SensorHistoryChart = lazy(() => import("./SensorHistoryChart"));

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
      const x = (index / (numericValues.length - 1)) * 100;

      const y = 34 - ((value - min) / range) * 28;

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
      <div className={styles.waterFill} style={{ height: `${value}%` }} />
    </div>
  );
}

function SensorTypeIcon({ sensorType, title }) {
  const Icon = getSystemIcon({
    sensorType: sensorType || title,
  });

  return <Icon size={18} aria-hidden="true" />;
}

function toDateTimeLocal(value) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function mapReadingResponse(response) {
  return Array.isArray(response?.readings)
    ? response.readings
        .map((item) => ({
          time: item?.time,
          value: Number(item?.value),
          qualityStatus: item?.quality_status,
        }))
        .filter(
          (item) =>
            item.time &&
            Number.isFinite(new Date(item.time).getTime()) &&
            Number.isFinite(item.value),
        )
    : [];
}

function mergeHistory(current, incoming) {
  const byTime = new Map();

  [
    ...(Array.isArray(current) ? current : []),
    ...(Array.isArray(incoming) ? incoming : []),
  ].forEach((item) => {
    const time = new Date(item?.time).getTime();
    const value = Number(item?.value);

    if (Number.isFinite(time) && Number.isFinite(value)) {
      byTime.set(time, {
        ...item,
        time: new Date(time).toISOString(),
        value,
      });
    }
  });

  return [...byTime.values()].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
  );
}

function FarmSensorCard({
  title,
  data = null,
  loading = false,
  error = false,
  tone = "neutral",
  type = "line",
  token,
  onTokenRefresh,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState([]);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [customRange, setCustomRange] = useState(false);

  const value =
    data?.value === null || data?.value === undefined || data?.value === ""
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
      ? data.history.map((item) => Number(item?.value)).filter(Number.isFinite)
      : Array.isArray(data?.trend)
        ? data.trend
        : [];

  const history = Array.isArray(data?.history) ? data.history : [];

  useEffect(() => {
    if (!isExpanded || customRange) {
      return;
    }

    setExpandedHistory(history);
  }, [history, isExpanded, customRange]);

  const openExpanded = () => {
    const now = new Date();
    const first = history[0]?.time
      ? new Date(history[0].time)
      : new Date(now.getTime() - 30 * 60 * 1000);
    const last = history[history.length - 1]?.time
      ? new Date(history[history.length - 1].time)
      : now;

    setExpandedHistory(history);
    setRangeStart(toDateTimeLocal(first));
    setRangeEnd(toDateTimeLocal(last));
    setRangeError("");
    setCustomRange(false);
    setIsExpanded(true);
  };

  const requestRange = useCallback(
    async (startTime, endTime, replace = false) => {
      if (!data?.type || !token) {
        return;
      }

      setRangeLoading(true);
      setRangeError("");

      try {
        const response = await getSensorReadings(
          token,
          onTokenRefresh,
          data.type,
          startTime,
          endTime,
        );
        const incoming = mapReadingResponse(response);

        setExpandedHistory((current) =>
          replace ? incoming : mergeHistory(current, incoming),
        );
        setCustomRange(true);
      } catch (requestError) {
        setRangeError(
          requestError.message || "Unable to load sensor readings.",
        );
      } finally {
        setRangeLoading(false);
      }
    },
    [data?.type, token, onTokenRefresh],
  );

  const loadCustomRange = async (event) => {
    event.preventDefault();

    const start = new Date(rangeStart);
    const end = new Date(rangeEnd);

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start
    ) {
      setRangeError("Choose a valid start and end time.");
      return;
    }

    await requestRange(start, end, true);
  };

  const handleChartRangeRequest = useCallback(
    async (startTime, endTime) => {
      setRangeStart(toDateTimeLocal(startTime));
      setRangeEnd(toDateTimeLocal(endTime));
      await requestRange(startTime, endTime, true);
    },
    [requestRange],
  );

  const hasTrend =
    !loading && !error && trend.filter(Number.isFinite).length >= 2;

  const hasWaterLevel = !loading && !error && Number.isFinite(data?.percentage);

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
      return <WaterGauge percentage={data.percentage} />;
    }

    if (hasTrend) {
      return <Sparkline values={trend} />;
    }

    return <span>{chartMessage}</span>;
  };

  const renderExpandedChart = () => (
    <Suspense fallback={<span>Loading chart...</span>}>
      <SensorHistoryChart
        history={expandedHistory}
        tone={tone}
        unit={data?.unit || ""}
        onRangeRequest={handleChartRangeRequest}
      />
    </Suspense>
  );

  return (
    <>
      <article className={`${styles.card} ${styles[tone] || styles.neutral}`}>
        <div className={styles.top}>
          <div>
            <h3 className={styles.title}>
              <SensorTypeIcon sensorType={data?.type} title={title} />
              {title}
            </h3>
            <p className={styles.value}>{value}</p>
          </div>

          <button
            className={styles.expandButton}
            type="button"
            onClick={openExpanded}
            aria-label={`Expand ${title}`}
          >
            <Expand aria-hidden="true" />
          </button>
        </div>

        <div className={styles.chart}>{renderSummaryChart()}</div>

        <div className={styles.bottom}>
          <span className={styles.statusText}>{status}</span>

          <span className={connectionClass}>● {connection}</span>
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
              <p className={styles.expandedValue}>{value}</p>

              <span className={connectionClass}>● {connection}</span>
            </div>

            <form className={styles.rangeControls} onSubmit={loadCustomRange}>
              <label>
                <span>From</span>
                <input
                  type="datetime-local"
                  value={rangeStart}
                  onChange={(event) => setRangeStart(event.target.value)}
                />
              </label>

              <label>
                <span>To</span>
                <input
                  type="datetime-local"
                  value={rangeEnd}
                  onChange={(event) => setRangeEnd(event.target.value)}
                />
              </label>

              <button type="submit" disabled={rangeLoading}>
                {rangeLoading ? "Loading..." : "Load range"}
              </button>

              <span className={styles.rangeHint}>
                Zoom or pan the chart to request that exact raw range.
              </span>
            </form>

            {rangeError && (
              <div className={styles.rangeError}>{rangeError}</div>
            )}

            <div className={styles.expandedChart}>{renderExpandedChart()}</div>

            <div className={styles.expandedBottom}>
              <span className={styles.statusText}>{status}</span>
            </div>
          </div>
        </ExpandModal>
      )}
    </>
  );
}

export default FarmSensorCard;
