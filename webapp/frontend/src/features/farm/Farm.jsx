import { useState } from "react";

import MonitoringTab from "./tabs/MonitoringTab";
import AIInsightTab from "./tabs/AIInsightTab";
import GrowRoutineTab from "./tabs/GrowRoutineTab";
import ManualOverrideTab from "./tabs/ManualOverrideTab";

import styles from "./Farm.module.css";

function Farm({
  data = null,
  loading = false,
  error = "",
  token,
  onTokenRefresh,
  user,
  access
}) {
  const [activeTab, setActiveTab] = useState("monitoring");

  const hasError = Boolean(error);

  return (
    <div className={styles.farm}>
      <nav
        className={styles.tabs}
        aria-label="Farm sections"
      >
        <button
          className={
            activeTab === "monitoring"
              ? styles.activeTab
              : ""
          }
          type="button"
          onClick={() => setActiveTab("monitoring")}
        >
          Monitoring
        </button>

        <button
          className={
            activeTab === "insight"
              ? styles.activeTab
              : ""
          }
          type="button"
          onClick={() => setActiveTab("insight")}
        >
          AI Insight
        </button>

        <button
          className={
            activeTab === "routine"
              ? styles.activeTab
              : ""
          }
          type="button"
          onClick={() => setActiveTab("routine")}
        >
          Grow Routine
        </button>

        <button
          className={
            activeTab === "override"
              ? styles.activeTab
              : ""
          }
          type="button"
          onClick={() => setActiveTab("override")}
        >
          Manual Override
        </button>
      </nav>

      {activeTab === "monitoring" && (
        <MonitoringTab
          data={data?.monitoring}
          loading={loading}
          error={hasError}
          token={token}
          onTokenRefresh={onTokenRefresh}
        />
      )}

      {activeTab === "insight" && (
        <AIInsightTab
          data={data?.insight}
          loading={loading}
          error={hasError}
        />
      )}

      {activeTab === "routine" && (
        <GrowRoutineTab
          data={data?.routine}
          loading={loading}
          error={hasError}
          token={token}
          onTokenRefresh={onTokenRefresh}
          access={access}
        />
      )}

      {activeTab === "override" && (
        <ManualOverrideTab
          data={data?.controls}
          loading={loading}
          error={hasError}
          token={token}
          onTokenRefresh={onTokenRefresh}
          user={user}
          access={access}
        />
      )}
    </div>
  );
}

export default Farm;
