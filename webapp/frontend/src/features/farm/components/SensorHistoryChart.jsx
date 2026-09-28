import { useEffect, useRef } from "react";

import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  TooltipComponent
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

import styles from "./SensorHistoryChart.module.css";

echarts.use([
  LineChart,
  DataZoomComponent,
  GridComponent,
  TooltipComponent,
  CanvasRenderer
]);

function SensorHistoryChart({
  history = [],
  tone = "green",
  unit = ""
}) {
  const chartElement = useRef(null);

  useEffect(() => {
    if (!chartElement.current) {
      return;
    }

    const points = Array.isArray(history)
      ? history
          .map((item) => {
            const time = new Date(item?.timestamp).getTime();
            const value = Number(item?.value);

            if (!Number.isFinite(time) || !Number.isFinite(value)) {
              return null;
            }

            return [time, value];
          })
          .filter(Boolean)
      : [];

    const chart = echarts.init(chartElement.current);

    const timeFormatter = new Intl.DateTimeFormat([], {
      hour: "numeric",
      minute: "2-digit"
    });

    const tooltipTimeFormatter = new Intl.DateTimeFormat([], {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit"
    });

    function applyTheme() {
      const rootStyles = getComputedStyle(
        document.documentElement
      );

      const primary =
        rootStyles.getPropertyValue("--color-text-primary").trim() ||
        "#f2f6f4";

      const secondary =
        rootStyles.getPropertyValue("--color-text-secondary").trim() ||
        "#8f9b96";

      const border =
        rootStyles.getPropertyValue("--color-border").trim() ||
        "#3a4344";

      const background =
        rootStyles.getPropertyValue("--color-bg-card-inner").trim() ||
        "#293133";

      const toneColours = {
        green: "#34d399",
        orange: "#ff7b00",
        blue: "#00a8d2",
        neutral: secondary
      };

      const lineColour =
        toneColours[tone] || toneColours.neutral;

      chart.setOption({
        animation: false,

        grid: {
          left: 62,
          right: 26,
          top: 24,
          bottom: 72
        },

        tooltip: {
          trigger: "axis",
          backgroundColor: background,
          borderColor: border,
          textStyle: {
            color: primary,
            fontSize: 12
          },
          formatter(params) {
            const point = params?.[0];

            if (!point || !Array.isArray(point.value)) {
              return "";
            }

            const timestamp = point.value[0];
            const value = point.value[1];

            return `${tooltipTimeFormatter.format(
              new Date(timestamp)
            )}<br/><strong>${value}${unit ? ` ${unit}` : ""}</strong>`;
          }
        },

        xAxis: {
          type: "time",
          boundaryGap: false,
          axisLine: {
            lineStyle: {
              color: border
            }
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            color: secondary,
            fontSize: 11,
            formatter(value) {
              return timeFormatter.format(new Date(value));
            }
          },
          splitLine: {
            show: true,
            lineStyle: {
              color: border,
              opacity: 0.35
            }
          }
        },

        yAxis: {
          type: "value",
          scale: true,
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            color: secondary,
            fontSize: 11,
            formatter(value) {
              return `${value}${unit ? ` ${unit}` : ""}`;
            }
          },
          splitLine: {
            lineStyle: {
              color: border,
              opacity: 0.45
            }
          }
        },

        dataZoom: [
          {
            type: "inside",
            xAxisIndex: 0,
            filterMode: "none"
          },
          {
            type: "slider",
            xAxisIndex: 0,
            filterMode: "none",
            height: 24,
            bottom: 18,
            borderColor: border,
            backgroundColor: background,
            fillerColor: `${lineColour}22`,
            handleStyle: {
              color: lineColour,
              borderColor: lineColour
            },
            moveHandleStyle: {
              color: lineColour
            },
            textStyle: {
              color: secondary
            }
          }
        ],

        series: [
          {
            type: "line",
            data: points,
            smooth: false,
            showSymbol: false,
            symbolSize: 7,
            lineStyle: {
              width: 2.5,
              color: lineColour
            },
            itemStyle: {
              color: lineColour
            },
            emphasis: {
              focus: "series"
            }
          }
        ]
      });
    }

    applyTheme();

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });

    resizeObserver.observe(chartElement.current);

    const themeObserver = new MutationObserver(() => {
      applyTheme();
    });

    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    return () => {
      resizeObserver.disconnect();
      themeObserver.disconnect();
      chart.dispose();
    };
  }, [history, tone, unit]);

  return (
    <div
      ref={chartElement}
      className={styles.chart}
    />
  );
}

export default SensorHistoryChart;
