import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";
import StateMessage from "../../../components/common/StateMessage/StateMessage";
import { formatDateTime } from "../../../utils/formatters";
import styles from "./ExecutionLog.module.css";

function ExecutionLog({ executions, tasks, loading, error, hasMore = false, onLoadMore }) {
  const taskMap = Object.fromEntries(tasks.map((task) => [String(task.schedule_id), task]));
  return (
    <section className={styles.panel}>
      <div className={styles.header}><div><h2>Task Execution Log</h2><p>Recent scheduled task runs, results and failures.</p></div><span>{executions.length} entries</span></div>
      {loading ? <StateMessage message="Loading execution log..." /> : error ? <StateMessage tone="error" message={error} /> : executions.length === 0 ? <StateMessage message="No task executions have been recorded yet." /> : (
        <div className={styles.list}>{executions.map((execution) => {
          const task = taskMap[String(execution.schedule_id)] || {};
          return <article key={execution.execution_id} className={styles.row}>
            <ActionIcon action={task.task_action} size={20} />
            <div className={styles.copy}><strong>{task.task_name || `Schedule #${execution.schedule_id}`}</strong><span>{execution.error_message || (execution.result ? `${JSON.stringify(execution.result).slice(0, 240)}${JSON.stringify(execution.result).length > 240 ? "…" : ""}` : "No result details")}</span></div>
            <div className={styles.meta}><span className={`${styles.status} ${styles[String(execution.status || "").toLowerCase()] || ""}`}>{execution.status}</span><time>{formatDateTime(execution.scheduled_for || execution.created_at)}</time></div>
          </article>;
        })}</div>
      )}
      {hasMore && <button type="button" className={styles.loadMore} onClick={onLoadMore} disabled={loading}>{loading ? "Loading..." : "Load more executions"}</button>}
    </section>
  );
}
export default ExecutionLog;
