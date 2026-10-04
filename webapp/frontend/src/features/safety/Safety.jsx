import { useEffect, useState } from "react";
import { Activity, ListChecks, ShieldCheck, SlidersHorizontal } from "lucide-react";

import Tabs from "../../components/common/Tabs/Tabs";
import SafetyOverviewTab from "./tabs/SafetyOverviewTab";
import ApprovalsTab from "./tabs/ApprovalsTab";
import ConfigurationTab from "./tabs/ConfigurationTab";
import SafetyActivityTab from "./tabs/SafetyActivityTab";

import {
  activateEmergencyStop,
  approveRequest,
  clearEmergencyStop,
  getSafetyData,
  getSafetyActivityPage,
  getApprovalsPage,
  rejectRequest,
  setAiEnabled
} from "../../services/safetyApi";

import styles from "./Safety.module.css";

const tabs = [
  { id: "overview", label: "Overview", Icon: ShieldCheck },
  { id: "approvals", label: "Approvals", Icon: ListChecks },
  { id: "activity", label: "Safety Activity", Icon: Activity },
  { id: "configuration", label: "Configuration", Icon: SlidersHorizontal }
];

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
  const [activityItems, setActivityItems] = useState([]);
  const [activityMore, setActivityMore] = useState(true);
  const [approvalItems, setApprovalItems] = useState([]);
  const [approvalsMore, setApprovalsMore] = useState(true);

  const hasError = Boolean(error);
  const canEmergency = Boolean(access?.allowed?.EMERGENCY_STOP);
  const canClearEmergency = Boolean(access?.allowed?.CLEAR_EMERGENCY_STOP);
  const canReview = Boolean(access?.allowed?.APPROVAL_REVIEW);
  const canToggleAi = Boolean(access?.allowed?.AI_TOGGLE);

  useEffect(() => { setActivityItems(Array.isArray(data?.safetyActivity) ? data.safetyActivity : []); }, [data?.safetyActivity]);
  useEffect(() => { setApprovalItems(Array.isArray(data?.approvals) ? data.approvals : []); }, [data?.approvals]);

  async function loadMoreApprovals() {
    setActionBusy(true);
    try { const next = await getApprovalsPage(token, onTokenRefresh, approvalItems.length, 50); setApprovalItems((current) => [...current, ...next]); setApprovalsMore(next.length === 50); }
    finally { setActionBusy(false); }
  }

  async function loadMoreSafetyActivity() {
    setActionBusy(true);
    try {
      const next = await getSafetyActivityPage(token, onTokenRefresh, activityItems.length, 50);
      setActivityItems((current) => [...current, ...next]);
      setActivityMore(next.length === 50);
    } finally { setActionBusy(false); }
  }

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
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
        ariaLabel="Safety sections"
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
            data={approvalItems}
            loading={loading}
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
            hasMore={approvalsMore}
            loadingMore={actionBusy}
            onLoadMore={loadMoreApprovals}
          />
        )}

        {activeTab === "activity" && (
          <SafetyActivityTab data={activityItems} loading={loading} error={hasError} hasMore={activityMore} loadingMore={actionBusy} onLoadMore={loadMoreSafetyActivity} />
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
