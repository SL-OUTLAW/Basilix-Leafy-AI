import { useState } from "react";

import SafetyTabs from "./components/SafetyTabs";
import SafetyOverviewTab from "./tabs/SafetyOverviewTab";
import ApprovalsTab from "./tabs/ApprovalsTab";
import ConfigurationTab from "./tabs/ConfigurationTab";

import {
  activateEmergencyStop,
  approveRequest,
  clearEmergencyStop,
  getSafetyData,
  rejectRequest,
  setAiEnabled
} from "../../services/safetyApi";

import styles from "./Safety.module.css";

function Safety({
  data = null,
  loading = false,
  error = "",
  token,
  onTokenRefresh,
  user,
  access,
  onDataChange
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const hasError = Boolean(error);
  const canEmergency = Boolean(access?.allowed?.EMERGENCY_STOP);
  const canClearEmergency = Boolean(access?.allowed?.CLEAR_EMERGENCY_STOP);
  const canReview = Boolean(access?.allowed?.APPROVAL_REVIEW);
  const canToggleAi = Boolean(access?.allowed?.AI_TOGGLE);

  async function refresh() {
    const updated = await getSafetyData(
      token,
      onTokenRefresh
    );

    onDataChange?.(updated);
  }

  async function runAction(operation) {
    setActionBusy(true);
    setActionError("");

    try {
      await operation();
      await refresh();
    } catch (actionFailure) {
      setActionError(
        actionFailure.message || "Safety action failed"
      );
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <section className={styles.safety}>
      <SafetyTabs
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {actionError && (
        <div className={styles.actionError} role="alert">
          {actionError}
        </div>
      )}

      <div className={styles.content}>
        {activeTab === "overview" && (
          <SafetyOverviewTab
            data={data}
            loading={loading || actionBusy}
            error={hasError}
            onOpenApprovals={() => setActiveTab("approvals")}
            onOpenConfiguration={() => setActiveTab("configuration")}
            canAdmin={data?.state?.emergency_stop ? canClearEmergency : canEmergency}
            onEmergencyStop={() =>
              runAction(() =>
                data?.state?.emergency_stop
                  ? clearEmergencyStop(token, onTokenRefresh)
                  : activateEmergencyStop(token, onTokenRefresh)
              )
            }
          />
        )}

        {activeTab === "approvals" && (
          <ApprovalsTab
            data={data?.approvals}
            loading={loading || actionBusy}
            error={hasError}
            canReview={canReview}
            onApprove={(id) =>
              runAction(() =>
                approveRequest(token, onTokenRefresh, id)
              )
            }
            onReject={(id) =>
              runAction(() =>
                rejectRequest(token, onTokenRefresh, id)
              )
            }
          />
        )}

        {activeTab === "configuration" && (
          <ConfigurationTab
            data={data?.configuration}
            loading={loading || actionBusy}
            error={hasError}
            state={data?.state}
            canAdmin={canToggleAi}
            onSetAiEnabled={(enabled) =>
              runAction(() =>
                setAiEnabled(
                  token,
                  onTokenRefresh,
                  enabled
                )
              )
            }
          />
        )}
      </div>
    </section>
  );
}

export default Safety;
