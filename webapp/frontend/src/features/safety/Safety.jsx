import { useState } from "react";

import SafetyTabs from "./components/SafetyTabs";
import SafetyOverviewTab from "./tabs/SafetyOverviewTab";
import ApprovalsTab from "./tabs/ApprovalsTab";
import ConfigurationTab from "./tabs/ConfigurationTab";

import styles from "./Safety.module.css";

function Safety({
  data = null,
  loading = false,
  error = ""
}) {
  const [activeTab, setActiveTab] = useState("overview");

  const hasError = Boolean(error);

  return (
    <section className={styles.safety}>
      <SafetyTabs
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className={styles.content}>
        {activeTab === "overview" && (
          <SafetyOverviewTab
            data={data}
            loading={loading}
            error={hasError}
            onOpenApprovals={() => setActiveTab("approvals")}
            onOpenConfiguration={() => setActiveTab("configuration")}
          />
        )}

        {activeTab === "approvals" && (
          <ApprovalsTab
            data={data?.approvals}
            loading={loading}
            error={hasError}
          />
        )}

        {activeTab === "configuration" && (
          <ConfigurationTab
            data={data?.configuration}
            loading={loading}
            error={hasError}
          />
        )}
      </div>
    </section>
  );
}

export default Safety;
