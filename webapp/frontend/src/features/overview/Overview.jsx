import farmHealthIcon from "../../assets/overview/farm-health.svg";
import plantsIcon from "../../assets/overview/plants.svg";
import alertsIcon from "../../assets/overview/alerts.svg";
import pendingIcon from "../../assets/overview/pending.svg";
import autoExecutedIcon from "../../assets/overview/auto-executed.svg";
import approvedIcon from "../../assets/overview/approved.svg";

import StatusCard from "./components/StatusCard";
import SensorCard from "./components/SensorCard";
import styles from "./Overview.module.css";


function Overview() {
  return (
    <div className={styles.overview}>
      <section className={styles.statusSection}>
        <StatusCard
          title="Farm Health"
          value="—"
          note="Not available yet"
          icon={farmHealthIcon}
        />

        <StatusCard
          title="Plants"
          value="—"
          note="Not available yet"
          icon={plantsIcon}
        />

        <StatusCard
          title="Alerts"
          value="—"
          note="Waiting for live data"
          icon={alertsIcon}
        />

        <StatusCard
          title="Pending"
          value="—"
          note="Approval API not ready"
          icon={pendingIcon}
        />

        <StatusCard
          title="Auto Executed"
          value="—"
          note="Not available yet"
          icon={autoExecutedIcon}
        />

        <StatusCard
          title="Approved"
          value="—"
          note="Not available yet"
          icon={approvedIcon}
        />
      </section>

      <div className={styles.mainRow}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Farm Overview</h2>
          </div>

          <div className={styles.emptyState}>
            <p>Farm overview data is not available yet.</p>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Leafy AI Recommendations</h2>
            <span>24h</span>
          </div>

          <div className={styles.emptyState}>
            <p>
              Recommendations will appear here after authentication is connected.
            </p>
          </div>
        </section>
      </div>

      <section className={styles.sensorSection}>
        <SensorCard
            title="pH Level"
            value="—"
            status="Not available"
        />

        <SensorCard
            title="Temperature"
            value="—"
            status="Not available"
        />

        <SensorCard
            title="Water Level"
            value="—"
            status="Not available"
        />

        <SensorCard
            title="EC Level"
            value="—"
            status="Not available"
        />
        </section>
    </div>
  );
}

export default Overview;