import FarmSensorCard from "../components/FarmSensorCard";
import CameraCard from "../components/CameraCard";
import HarvestCard from "../components/HarvestCard";

import styles from "./MonitoringTab.module.css";

function MonitoringTab({
  data = null,
  loading = false,
  error = false,
  token,
  onTokenRefresh
}) {
  const sensors = data?.sensors ?? {};
return (
    <div className={styles.monitoringLayout}>
      <section className={styles.sensorGroup}>
        <div className={styles.groupHeader}>
          <h2>Real-Time Data</h2>
        </div>

        <FarmSensorCard
          title="pH Level"
          data={sensors.ph}
          loading={loading}
          error={error}
          tone="green"
        />

        <FarmSensorCard
          title="Temperature"
          data={sensors.temperature}
          loading={loading}
          error={error}
          tone="orange"
        />

        <FarmSensorCard
          title="Water Level"
          data={sensors.waterLevel}
          loading={loading}
          error={error}
          tone="blue"
          type="water"
        />
      </section>

      <div className={styles.centreColumn}>
        <CameraCard
          data={data?.camera}
          levels={data?.levels}
          loading={loading}
          error={error}
          token={token}
          onTokenRefresh={onTokenRefresh}
        />

        <HarvestCard
          data={data?.harvest}
          loading={loading}
          error={error}
        />
      </div>

      <section className={styles.sensorGroup}>
        <div className={styles.groupHeader}>
          <h2>Real-Time Data</h2>
        </div>

        <FarmSensorCard
          title="EC Level"
          data={sensors.ec}
          loading={loading}
          error={error}
          tone="green"
        />

        <FarmSensorCard
          title="Humidity"
          data={sensors.humidity}
          loading={loading}
          error={error}
          tone="orange"
        />

        <FarmSensorCard
          title="Water Temperature"
          data={sensors.waterTemperature}
          loading={loading}
          error={error}
          tone="blue"
        />
      </section>
    </div>
  );
}

export default MonitoringTab;
