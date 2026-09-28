import {
  CircleCheck,
  Clock3,
  Gauge,
  HeartPulse,
  TriangleAlert,
  Zap
} from "lucide-react";

import StatusCard from "./components/StatusCard";
import SensorCard from "./components/SensorCard";
import FarmOverviewPanel from "./components/FarmOverviewPanel";
import RecommendationsPanel from "./components/RecommendationsPanel";
import NotificationsPanel from "./components/NotificationsPanel";

import styles from "./Overview.module.css";

function Overview({
  data = null,
  loading = false,
  error = "",
  onGoToFarm,
  onViewNotifications
}) {
  const summary = data?.summary ?? {};
  const sensors = data?.sensors ?? {};

  const recommendations =
    Array.isArray(data?.recommendations)
      ? data.recommendations
      : [];

  const notifications =
    Array.isArray(data?.notifications)
      ? data.notifications
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
        <div
          className={styles.errorState}
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      <section className={styles.statusSection}>
        <StatusCard
          title="Farm Health"
          value={summary.farmHealth?.value}
          note={
            summary.farmHealth?.note ||
            unavailableNote
          }
          icon={HeartPulse}
          tone="green"
        />

        <StatusCard
          title="Active Sensors"
          value={summary.activeSensors?.value}
          note={
            summary.activeSensors?.note ||
            unavailableNote
          }
          icon={Gauge}
          tone="green"
        />

        <StatusCard
          title="Alerts"
          value={summary.alerts?.value}
          note={
            summary.alerts?.note ||
            unavailableNote
          }
          icon={TriangleAlert}
          tone="orange"
        />

        <StatusCard
          title="Pending"
          value={summary.pending?.value}
          note={
            summary.pending?.note ||
            unavailableNote
          }
          icon={Clock3}
          tone="orange"
        />

        <StatusCard
          title="Auto Executed"
          value={summary.autoExecuted?.value}
          note={
            summary.autoExecuted?.note ||
            unavailableNote
          }
          icon={Zap}
          tone="blue"
        />

        <StatusCard
          title="Approved"
          value={summary.approved?.value}
          note={
            summary.approved?.note ||
            unavailableNote
          }
          icon={CircleCheck}
          tone="green"
        />
      </section>

      <div className={styles.mainRow}>
        <FarmOverviewPanel
          data={data?.farmOverview}
          loading={loading}
          error={
            hasError ||
            Boolean(sectionErrors.farmOverview)
          }
          onGoToFarm={onGoToFarm}
        />

        <RecommendationsPanel
          recommendations={recommendations}
          loading={loading}
          error={hasError}
        />
      </div>

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
          type="temperature"
          title="Temperature"
          value={sensors.temperature?.value}
          status={
            sensors.temperature?.status ||
            unavailableNote
          }
          tone={
            sensors.temperature?.tone ||
            "neutral"
          }
          trend={sensors.temperature?.trend}
        />

        <SensorCard
          type="water"
          title="Water Level"
          value={sensors.waterLevel?.value}
          status={
            sensors.waterLevel?.status ||
            unavailableNote
          }
          tone={
            sensors.waterLevel?.tone ||
            "neutral"
          }
          percentage={sensors.waterLevel?.percentage}
        />

        <SensorCard
          type="ec"
          title="EC Level"
          value={sensors.ec?.value}
          status={sensors.ec?.status || unavailableNote}
          tone={sensors.ec?.tone || "neutral"}
          trend={sensors.ec?.trend}
        />
      </section>

      <NotificationsPanel
        notifications={notifications}
        loading={loading}
        error={
          hasError ||
          Boolean(sectionErrors.notifications)
        }
        onViewAll={onViewNotifications}
      />
    </div>
  );
}

export default Overview;
