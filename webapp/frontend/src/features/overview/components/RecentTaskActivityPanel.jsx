import { CheckCircle2, Clock3, XCircle } from "lucide-react";

import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";
import styles from "./RecentTaskActivityPanel.module.css";

function statusIcon(status) {
  if (status === "COMPLETED") return CheckCircle2;
  if (["FAILED", "BLOCKED", "SKIPPED"].includes(status)) return XCircle;
  return Clock3;
}

function RecentTaskActivityPanel({ executions = [], loading = false, error = false, onOpenSchedule }) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>Recent Task Activity</h2>
          <p>Latest scheduled farm and AI task executions.</p>
        </div>
        {onOpenSchedule && (
          <button type="button" onClick={onOpenSchedule}>Open Schedule</button>
        )}
      </div>

      {loading ? (
        <p className={styles.empty}>Loading task activity...</p>
      ) : error ? (
        <p className={styles.empty}>Task activity unavailable.</p>
      ) : executions.length === 0 ? (
        <p className={styles.empty}>No task executions in the last 24 hours.</p>
      ) : (
        <div className={styles.list}>
          {executions.slice(0, 6).map((item) => {
            const StatusIcon = statusIcon(item.status);
            return (
              <article key={item.execution_id} className={styles.row}>
                <ActionIcon type={item.task_action} size={18} />
                <div>
                  <strong>{item.task_name || item.task_action || "Scheduled task"}</strong>
                  <span>{item.time}</span>
                </div>
                <span className={styles.status}>
                  <StatusIcon size={15} />
                  {item.status}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default RecentTaskActivityPanel;
