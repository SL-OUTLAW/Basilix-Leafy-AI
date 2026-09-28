import { useState } from "react";

import LeafyTabs from "./components/LeafyTabs";

import LeafyOverviewTab from "./tabs/LeafyOverviewTab";
import RecommendationsTab from "./tabs/RecommendationsTab";
import ActivityTab from "./tabs/ActivityTab";

import styles from "./LeafyAI.module.css";

function LeafyAI({
  data = null,
  loading = false,
  error = ""
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const hasError = Boolean(error);

  return (
    <div className={styles.leafyAI}>
      <LeafyTabs
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "overview" && (
        <LeafyOverviewTab
          data={data}
          loading={loading}
          error={hasError}
        />
      )}

      {activeTab === "recommendations" && (
        <RecommendationsTab
          data={data?.recommendations}
          loading={loading}
          error={hasError}
        />
      )}

      {activeTab === "activity" && (
        <ActivityTab
          data={data?.activity}
          loading={loading}
          error={hasError}
        />
      )}
    </div>
  );
}

export default LeafyAI;
