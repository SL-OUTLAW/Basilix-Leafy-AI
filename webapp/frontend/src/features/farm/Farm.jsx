import { useState } from "react";
import { Activity, Brain, SlidersHorizontal, Sprout } from "lucide-react";

import Tabs from "../../components/common/Tabs/Tabs";
import MonitoringTab from "./tabs/MonitoringTab";
import AIInsightTab from "./tabs/AIInsightTab";
import GrowRoutineTab from "./tabs/GrowRoutineTab";
import ManualOverrideTab from "./tabs/ManualOverrideTab";

import styles from "./Farm.module.css";

const tabs = [
  { id: "monitoring", label: "Monitoring", Icon: Activity },
  { id: "insight", label: "AI Insight", Icon: Brain },
  { id: "routine", label: "Grow Routine", Icon: Sprout },
  { id: "override", label: "Manual Override", Icon: SlidersHorizontal }
];

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
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        ariaLabel="Farm sections"
      />

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
