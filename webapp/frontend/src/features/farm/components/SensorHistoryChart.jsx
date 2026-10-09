import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./SensorHistoryChart.module.css";

const WIDTH = 1000;
const HEIGHT = 430;
const PLOT = {
  left: 88,
  right: 28,
  top: 28,
  bottom: 72,
};
const DEFAULT_WINDOW_MS = 30 * 60 * 1000;
const MIN_WINDOW_MS = 60 * 1000;
const REQUEST_DEBOUNCE_MS = 300;

const MIN_TIME_MS = Date.parse("0001-01-01T00:00:00.000Z");
const MAX_TIME_MS = Date.parse("9999-12-31T23:59:59.999Z");

function normalisePoints(history) {
  return Array.isArray(history)
    ? history
        .map((item) => {
          const time = new Date(item?.time).getTime();
          const value = Number(item?.value);

          if (!Number.isFinite(time) || !Number.isFinite(value)) {
            return null;
          }

          return {
            time,
            value,
            qualityStatus: item?.qualityStatus,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time)
    : [];
}

function initialDomain(points) {
  if (points.length >= 2) {
    return [points[0].time, points[points.length - 1].time];
  }

  const end = Date.now();
  return [end - DEFAULT_WINDOW_MS, end];
}

function clampDomain(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return null;
  }

  let nextStart = Math.max(MIN_TIME_MS, start);
  let nextEnd = Math.min(MAX_TIME_MS, end);

  if (nextEnd - nextStart < MIN_WINDOW_MS) {
    const middle = (nextStart + nextEnd) / 2;
    nextStart = middle - MIN_WINDOW_MS / 2;
    nextEnd = middle + MIN_WINDOW_MS / 2;

    if (nextStart < MIN_TIME_MS) {
      nextStart = MIN_TIME_MS;
      nextEnd = MIN_TIME_MS + MIN_WINDOW_MS;
    }

    if (nextEnd > MAX_TIME_MS) {
      nextEnd = MAX_TIME_MS;
      nextStart = MAX_TIME_MS - MIN_WINDOW_MS;
    }
  }

  return [nextStart, nextEnd];
}

function formatTimeTick(timestamp, span) {
  const date = new Date(timestamp);

  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  const options =
    span >= 24 * 60 * 60 * 1000
      ? {
          day: "2-digit",
          month: "short",
          year: span >= 365 * 24 * 60 * 60 * 1000 ? "numeric" : undefined,
          hour: "2-digit",
          minute: "2-digit",
        }
      : {
          hour: "2-digit",
          minute: "2-digit",
        };

  try {
    return new Intl.DateTimeFormat([], options).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function findNearestPoint(points, targetTime) {
  if (points.length === 0) {
    return null;
  }

  let low = 0;
  let high = points.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (points[middle].time < targetTime) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  const right = points[low];
  const left = low > 0 ? points[low - 1] : null;

  if (!left) {
    return right;
  }

  return Math.abs(left.time - targetTime) <= Math.abs(right.time - targetTime)
    ? left
    : right;
}

function SensorHistoryChart({
  history = [],
  tone = "green",
  unit = "",
  onRangeRequest,
}) {
  const points = useMemo(() => normalisePoints(history), [history]);
  const [domain, setDomain] = useState(() => initialDomain(points));
  const [drag, setDrag] = useState(null);
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  const requestTimerRef = useRef(null);
  const lastRequestRef = useRef("");
  const hasInteractedRef = useRef(false);

  useEffect(() => {
    if (hasInteractedRef.current || points.length < 2) {
      return;
    }

    setDomain(initialDomain(points));
  }, [points]);

  useEffect(() => () => window.clearTimeout(requestTimerRef.current), []);

  const requestDomain = useCallback(
    (nextDomain) => {
      if (!onRangeRequest) {
        return;
      }

      const safeDomain = clampDomain(nextDomain?.[0], nextDomain?.[1]);

      if (!safeDomain) {
        return;
      }

      const [start, end] = safeDomain;
      const key = `${Math.round(start)}:${Math.round(end)}`;

      if (key === lastRequestRef.current) {
        return;
      }

      window.clearTimeout(requestTimerRef.current);
      requestTimerRef.current = window.setTimeout(() => {
        lastRequestRef.current = key;

        try {
          onRangeRequest(
            new Date(start).toISOString(),
            new Date(end).toISOString(),
          );
        } catch {
          // ignore an invalid interaction range instead of crashing the chart
        }
      }, REQUEST_DEBOUNCE_MS);
    },
    [onRangeRequest],
  );

  const setInteractiveDomain = useCallback(
    (nextDomain, request = true) => {
      const safeDomain = clampDomain(nextDomain?.[0], nextDomain?.[1]);

      if (!safeDomain) {
        return;
      }

      hasInteractedRef.current = true;
      setDomain(safeDomain);

      if (request) {
        requestDomain(safeDomain);
      }
    },
    [requestDomain],
  );

  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const span = Math.max(domain[1] - domain[0], 1);

  const visiblePoints = useMemo(
    () =>
      points.filter(
        (point) => point.time >= domain[0] && point.time <= domain[1],
      ),
    [points, domain],
  );

  const yBounds = useMemo(() => {
    const source = visiblePoints.length > 0 ? visiblePoints : points;

    if (source.length === 0) {
      return [0, 1];
    }

    let minimum = Infinity;
    let maximum = -Infinity;

    for (const point of source) {
      if (point.value < minimum) minimum = point.value;
      if (point.value > maximum) maximum = point.value;
    }

    if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) {
      return [0, 1];
    }

    if (minimum === maximum) {
      const padding = Math.max(Math.abs(minimum) * 0.05, 1);
      return [minimum - padding, maximum + padding];
    }

    const padding = (maximum - minimum) * 0.1;
    return [minimum - padding, maximum + padding];
  }, [visiblePoints, points]);

  const xFor = useCallback(
    (time) => PLOT.left + ((time - domain[0]) / span) * plotWidth,
    [domain, span, plotWidth],
  );

  const yFor = useCallback(
    (value) => {
      const ySpan = Math.max(yBounds[1] - yBounds[0], Number.EPSILON);
      return (
        PLOT.top + plotHeight - ((value - yBounds[0]) / ySpan) * plotHeight
      );
    },
    [yBounds, plotHeight],
  );

  const path = useMemo(
    () =>
      visiblePoints
        .map((point, index) => {
          const command = index === 0 ? "M" : "L";
          return `${command} ${xFor(point.time)} ${yFor(point.value)}`;
        })
        .join(" "),
    [visiblePoints, xFor, yFor],
  );

  const xTicks = Array.from({ length: 6 }, (_, index) => {
    const ratio = index / 5;
    return domain[0] + span * ratio;
  });

  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return yBounds[1] - (yBounds[1] - yBounds[0]) * ratio;
  });

  const eventPosition = useCallback((event) => {
    const svg = svgRef.current;

    if (!svg) {
      return null;
    }

    const matrix = svg.getScreenCTM();

    if (!matrix) {
      return null;
    }

    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const local = point.matrixTransform(matrix.inverse());

    return {
      x: local.x,
      y: local.y,
    };
  }, []);

  const handleWheel = (event) => {
    event.preventDefault();

    const position = eventPosition(event);

    if (!position) {
      return;
    }

    const ratio = Math.min(
      1,
      Math.max(0, (position.x - PLOT.left) / plotWidth),
    );
    const anchor = domain[0] + span * ratio;
    const zoomFactor = event.deltaY > 0 ? 1.35 : 0.72;
    const requestedSpan = Math.max(MIN_WINDOW_MS, span * zoomFactor);

    const maxSpan = MAX_TIME_MS - MIN_TIME_MS;
    const nextSpan = Math.min(requestedSpan, maxSpan);
    const nextStart = anchor - nextSpan * ratio;
    const nextEnd = nextStart + nextSpan;

    setInteractiveDomain([nextStart, nextEnd]);
  };

  const handlePointerDown = (event) => {
    const position = eventPosition(event);

    if (!position) {
      return;
    }

    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({
      pointerX: position.x,
      domainStart: domain[0],
      domainEnd: domain[1],
    });
  };

  const handlePointerMove = (event) => {
    const position = eventPosition(event);

    if (!position) {
      return;
    }

    if (drag) {
      const svgDelta = position.x - drag.pointerX;
      const timeDelta = -(svgDelta / plotWidth) * span;
      const safeDomain = clampDomain(
        drag.domainStart + timeDelta,
        drag.domainEnd + timeDelta,
      );

      if (safeDomain) {
        hasInteractedRef.current = true;
        setDomain(safeDomain);
      }
      return;
    }

    if (visiblePoints.length === 0) {
      setHover(null);
      return;
    }

    if (
      position.x < PLOT.left ||
      position.x > WIDTH - PLOT.right ||
      position.y < PLOT.top ||
      position.y > HEIGHT - PLOT.bottom
    ) {
      setHover(null);
      return;
    }

    const ratio = (position.x - PLOT.left) / plotWidth;
    const targetTime = domain[0] + ratio * span;
    setHover(findNearestPoint(visiblePoints, targetTime));
  };

  const handlePointerUp = (event) => {
    if (!drag) {
      return;
    }

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setDrag(null);
    hasInteractedRef.current = true;
    requestDomain(domain);
  };

  const toneClass = styles[tone] || styles.green;

  return (
    <div className={`${styles.chart} ${toneClass}`}>
      <svg
        ref={svgRef}
        className={styles.svg}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Sensor history chart${unit ? ` in ${unit}` : ""}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={() => {
          if (!drag) setHover(null);
        }}
      >
        <rect
          className={styles.plotBackground}
          x={PLOT.left}
          y={PLOT.top}
          width={plotWidth}
          height={plotHeight}
        />

        {yTicks.map((value, index) => {
          const y = yFor(value);
          return (
            <g key={`y-${index}`}>
              <line
                className={styles.gridLine}
                x1={PLOT.left}
                x2={WIDTH - PLOT.right}
                y1={y}
                y2={y}
              />
              <text
                className={styles.axisText}
                x={PLOT.left - 12}
                y={y + 4}
                textAnchor="end"
              >
                {formatNumber(value)}
              </text>
            </g>
          );
        })}

        {xTicks.map((time, index) => {
          const x = xFor(time);
          return (
            <g key={`x-${index}`}>
              <line
                className={styles.gridLine}
                x1={x}
                x2={x}
                y1={PLOT.top}
                y2={HEIGHT - PLOT.bottom}
              />
              <text
                className={styles.axisText}
                x={x}
                y={HEIGHT - PLOT.bottom + 24}
                textAnchor="middle"
              >
                {formatTimeTick(time, span)}
              </text>
            </g>
          );
        })}

        <line
          className={styles.axisLine}
          x1={PLOT.left}
          x2={PLOT.left}
          y1={PLOT.top}
          y2={HEIGHT - PLOT.bottom}
        />
        <line
          className={styles.axisLine}
          x1={PLOT.left}
          x2={WIDTH - PLOT.right}
          y1={HEIGHT - PLOT.bottom}
          y2={HEIGHT - PLOT.bottom}
        />

        <text
          className={styles.axisTitle}
          x={PLOT.left + plotWidth / 2}
          y={HEIGHT - 14}
          textAnchor="middle"
        >
          Time
        </text>
        <text
          className={styles.axisTitle}
          x={20}
          y={PLOT.top + plotHeight / 2}
          textAnchor="middle"
          transform={`rotate(-90 20 ${PLOT.top + plotHeight / 2})`}
        >
          {unit || "Value"}
        </text>

        {path ? <path className={styles.dataLine} d={path} /> : null}

        {visiblePoints.length <= 120
          ? visiblePoints.map((point) => (
              <circle
                key={`${point.time}-${point.value}`}
                className={styles.dataPoint}
                cx={xFor(point.time)}
                cy={yFor(point.value)}
                r="3.5"
              />
            ))
          : null}

        {visiblePoints.length === 0 ? (
          <text
            className={styles.emptyText}
            x={PLOT.left + plotWidth / 2}
            y={PLOT.top + plotHeight / 2}
            textAnchor="middle"
          >
            No raw readings in this range
          </text>
        ) : null}

        {hover ? (
          <g pointerEvents="none">
            <line
              className={styles.crosshair}
              x1={xFor(hover.time)}
              x2={xFor(hover.time)}
              y1={PLOT.top}
              y2={HEIGHT - PLOT.bottom}
            />
            <circle
              className={styles.hoverPoint}
              cx={xFor(hover.time)}
              cy={yFor(hover.value)}
              r="5"
            />
          </g>
        ) : null}
      </svg>

      {hover ? (
        <div className={styles.tooltip}>
          <strong>
            {formatNumber(hover.value)}
            {unit ? ` ${unit}` : ""}
          </strong>
          <span>{new Date(hover.time).toLocaleString()}</span>
        </div>
      ) : null}

      <div className={styles.instructions}>
        Mouse wheel to zoom · drag to pan · raw sensor readings
      </div>
    </div>
  );
}

export default SensorHistoryChart;
