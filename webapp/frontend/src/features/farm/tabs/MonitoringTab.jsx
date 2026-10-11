import FarmSensorCard from "../components/FarmSensorCard";
import CameraCard from "../components/CameraCard";
import HarvestCard from "../components/HarvestCard";
import styles from "./MonitoringTab.module.css";

const sensorCards = [
  ["pH Level", "ph", "green"],
  ["EC Level", "ec", "green"],
  ["Ambient Temperature", "temperature", "orange"],
  ["Water Temperature", "waterTemperature", "blue"],
  ["Humidity", "humidity", "orange"],
  ["Dew Point", "dewPoint", "orange"],
  ["Water Level", "waterLevel", "blue"],
];

function MonitoringTab({
  data = null,
  loading = false,
  error = false,
  token,
  onTokenRefresh,
}) {
  const sensors = data?.sensors ?? {};
  const cameras = data?.cameras ?? [];

  return (
    <div className={styles.monitoringLayout}>
      <section className={styles.topGrid}>
        <CameraCard
          title="Level 1 Camera"
          level={1}
          cameras={cameras}
          loading={loading}
          error={error}
          token={token}
          onTokenRefresh={onTokenRefresh}
        />

        <CameraCard
          title="Level 2 Camera"
          level={2}
          cameras={cameras}
          loading={loading}
          error={error}
          token={token}
          onTokenRefresh={onTokenRefresh}
        />

        <HarvestCard data={data?.harvest} loading={loading} error={error} />
      </section>

      <section className={styles.sensorPanel}>
        <div className={styles.groupHeader}>
          <div>
            <h2>Farm Sensors</h2>
            <p>Latest live sensor readings</p>
          </div>

          <span className={styles.sensorCount}>
            {sensorCards.length} sensors
          </span>
        </div>

        <div className={styles.sensorGrid}>
          {sensorCards.map(([title, key, tone, type]) => (
            <FarmSensorCard
              key={key}
              title={title}
              data={sensors[key]}
              loading={loading}
              error={error}
              tone={tone}
              type={type}
              token={token}
              onTokenRefresh={onTokenRefresh}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default MonitoringTab;
