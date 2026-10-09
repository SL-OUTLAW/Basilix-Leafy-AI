import {
  CircleCheck,
  Camera,
  Clock3,
  HeartPulse,
  TriangleAlert,
  Zap,
} from "lucide-react";

import StatusCard from "./components/StatusCard";
import SensorCard from "./components/SensorCard";
import RecommendationsPanel from "./components/RecommendationsPanel";
import RecentApprovalsPanel from "./components/RecentApprovalsPanel";
import RecentTaskActivityPanel from "./components/RecentTaskActivityPanel";

import styles from "./Overview.module.css";

function Overview({
  data = null,
  loading = false,
  error = "",
  onGoToFarm,
  onOpenSafety,
  onOpenSchedule,
}) {
  const summary = data?.summary ?? {};
  const sensors = data?.sensors ?? {};

  const recommendations = Array.isArray(data?.recommendations)
    ? data.recommendations
    : [];

  const hasError = Boolean(error);
  const sectionErrors = data?.errors ?? {};

  const unavailableNote = loading
    ? "Loading..."
    : hasError
      ? "Unavailable"
      : "Not available";

  const errorMessage =
    typeof error === "string" && error.trim()
      ? error
      : "Unable to load overview data.";

  return (
    <div className={styles.overview}>
      {hasError && (
        <div className={styles.errorState} role="alert">
          {errorMessage}
        </div>
      )}

      <section className={styles.statusSection}>
        <StatusCard
          title="Farm Health"
          value={summary.farmHealth?.value}
          note={summary.farmHealth?.note || unavailableNote}
          icon={HeartPulse}
          tone="green"
        />

        <StatusCard
          title="Active Cameras"
          value={summary.activeCameras?.value}
          note={summary.activeCameras?.note || unavailableNote}
          icon={Camera}
          tone="green"
        />

        <StatusCard
          title="Alerts"
          value={summary.alerts?.value}
          note={summary.alerts?.note || unavailableNote}
          icon={TriangleAlert}
          tone="orange"
        />

        <StatusCard
          title="Pending"
          value={summary.pending?.value}
          note={summary.pending?.note || unavailableNote}
          icon={Clock3}
          tone="orange"
        />

        <StatusCard
          title="Task Runs · 24h"
          value={summary.taskRuns?.value}
          note={summary.taskRuns?.note || unavailableNote}
          icon={Zap}
          tone="blue"
        />

        <StatusCard
          title="Approved"
          value={summary.approved?.value}
          note={summary.approved?.note || unavailableNote}
          icon={CircleCheck}
          tone="green"
        />
      </section>

      <section className={styles.sensorSection}>
        <SensorCard
          type="ph"
          title="pH Level"
          value={sensors.ph?.value}
          status={sensors.ph?.status || unavailableNote}
          tone={sensors.ph?.tone || "neutral"}
          trend={sensors.ph?.trend}
        />

        <SensorCard
          type="ec"
          title="EC"
          value={sensors.ec?.value}
          status={sensors.ec?.status || unavailableNote}
          tone={sensors.ec?.tone || "neutral"}
          trend={sensors.ec?.trend}
        />

        <SensorCard
          type="ambient_temperature"
          title="Ambient Temperature"
          value={sensors.ambientTemperature?.value}
          status={sensors.ambientTemperature?.status || unavailableNote}
          tone={sensors.ambientTemperature?.tone || "neutral"}
          trend={sensors.ambientTemperature?.trend}
        />

        <SensorCard
          type="water_temperature"
          title="Water Temperature"
          value={sensors.waterTemperature?.value}
          status={sensors.waterTemperature?.status || unavailableNote}
          tone={sensors.waterTemperature?.tone || "neutral"}
          trend={sensors.waterTemperature?.trend}
        />

        <SensorCard
          type="humidity"
          title="Humidity"
          value={sensors.humidity?.value}
          status={sensors.humidity?.status || unavailableNote}
          tone={sensors.humidity?.tone || "neutral"}
          trend={sensors.humidity?.trend}
        />

        <SensorCard
          type="dew_point"
          title="Dew Point"
          value={sensors.dewPoint?.value}
          status={sensors.dewPoint?.status || unavailableNote}
          tone={sensors.dewPoint?.tone || "neutral"}
          trend={sensors.dewPoint?.trend}
        />

        <SensorCard
          type="water"
          title="Water Level"
          value={sensors.waterLevel?.value}
          status={sensors.waterLevel?.status || unavailableNote}
          tone={sensors.waterLevel?.tone || "neutral"}
          trend={sensors.waterLevel?.trend}
          percentage={sensors.waterLevel?.percentage}
        />
      </section>

      <div className={styles.mainRow}>
        <RecentApprovalsPanel
          approvals={data?.recentApprovals || []}
          loading={loading}
          error={hasError || Boolean(sectionErrors.approvals)}
          onOpenSafety={onOpenSafety}
        />

        <RecommendationsPanel
          recommendations={recommendations}
          loading={loading}
          error={hasError}
        />
      </div>

      <div className={styles.activityRow}>
        <RecentTaskActivityPanel
          executions={data?.recentExecutions || []}
          loading={loading}
          error={hasError || Boolean(sectionErrors.executions)}
          onOpenSchedule={onOpenSchedule}
        />
      </div>
    </div>
  );
}

export default Overview;
