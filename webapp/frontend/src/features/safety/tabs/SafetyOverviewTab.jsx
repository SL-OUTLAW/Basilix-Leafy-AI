import SafetySummary from "../components/SafetySummary";
import PendingApprovals from "../components/PendingApprovals";
import RiskAssessment from "../components/RiskAssessment";
import RecentSafetyActivity from "../components/RecentSafetyActivity";

import styles from "./SafetyOverviewTab.module.css";

function SafetyOverviewTab({
  data = null,
  loading = false,
  error = false,
  onOpenApprovals,
  onOpenConfiguration,
  canAdmin = false,
  onEmergencyStop
}) {
  return (
    <div className={styles.overview}>
      <SafetySummary
        data={data?.summary}
        loading={loading}
        error={error}
        emergencyStop={Boolean(data?.state?.emergency_stop)}
        canAdmin={canAdmin}
        onEmergencyStop={onEmergencyStop}
      />

      <div className={styles.middle}>
        <PendingApprovals
          data={data?.pendingApprovals}
          loading={loading}
          error={error}
          onViewAll={onOpenApprovals}
        />

        <RiskAssessment
          data={data?.riskAssessment}
          loading={loading}
          error={error}
          onConfigure={onOpenConfiguration}
        />
      </div>

      <RecentSafetyActivity
        data={data?.recentActivity}
        loading={loading}
        error={error}
      />
    </div>
  );
}

export default SafetyOverviewTab;
