import TaskIcon from "./TaskIcon";
import styles from "./ExecutionLog.module.css";

function ExecutionLog({ executions, tasks, loading, error }) {
  const taskMap = Object.fromEntries(tasks.map((task) => [String(task.schedule_id), task]));
  return (
    <section className={styles.panel}>
      <div className={styles.header}><div><h2>Task Execution Log</h2><p>Recent scheduled task runs, results and failures.</p></div><span>{executions.length} entries</span></div>
      {loading ? <div className={styles.state}>Loading execution log...</div> : error ? <div className={styles.state}>{error}</div> : executions.length === 0 ? <div className={styles.state}>No task executions have been recorded yet.</div> : (
        <div className={styles.list}>{executions.map((execution) => {
          const task = taskMap[String(execution.schedule_id)] || {};
          return <article key={execution.execution_id} className={styles.row}>
            <TaskIcon action={task.task_action} size={20} />
            <div className={styles.copy}><strong>{task.task_name || `Schedule #${execution.schedule_id}`}</strong><span>{execution.error_message || (execution.result ? JSON.stringify(execution.result) : "No result details")}</span></div>
            <div className={styles.meta}><span className={`${styles.status} ${styles[String(execution.status || "").toLowerCase()] || ""}`}>{execution.status}</span><time>{new Date(execution.scheduled_for || execution.created_at).toLocaleString()}</time></div>
          </article>;
        })}</div>
      )}
    </section>
  );
}
export default ExecutionLog;
