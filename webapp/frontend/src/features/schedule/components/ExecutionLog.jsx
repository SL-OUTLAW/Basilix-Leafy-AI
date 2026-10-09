import { useState } from "react";
import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";
import MarkdownContent from "../../../components/common/MarkdownContent/MarkdownContent";
import Modal from "../../../components/common/Modal/Modal";
import StateMessage from "../../../components/common/StateMessage/StateMessage";
import { getAIResultContent, getAIResultPreview } from "../../../utils/aiResult";
import { formatDateTime } from "../../../utils/formatters";
import styles from "./ExecutionLog.module.css";

function ExecutionLog({
  executions,
  tasks,
  loading,
  error,
  hasMore = false,
  onLoadMore
}) {
  const [selected, setSelected] = useState(null);
  const taskMap = Object.fromEntries(
    tasks.map((task) => [String(task.schedule_id), task])
  );

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>Task Execution Log</h2>
          <p>Recent scheduled task runs, results and failures. Select a row for the full result.</p>
        </div>
        <span>{executions.length} entries</span>
      </div>

      {loading && executions.length === 0 ? (
        <StateMessage message="Loading execution log..." />
      ) : error && executions.length === 0 ? (
        <StateMessage tone="error" message={error} />
      ) : executions.length === 0 ? (
        <StateMessage message="No task executions have been recorded yet." />
      ) : (
        <div className={styles.list}>
          {executions.map((execution) => {
            const task = taskMap[String(execution.schedule_id)] || {};
            const resultContent = getAIResultContent(execution.result);
            const preview =
              execution.error_message ||
              getAIResultPreview(resultContent, 300) ||
              "No result details";

            return (
              <button
                key={execution.execution_id}
                type="button"
                className={styles.row}
                onClick={() => setSelected({ execution, task, resultContent })}
              >
                <ActionIcon
                  action={execution.task_action || task.task_action}
                  size={20}
                />

                <span className={styles.copy}>
                  <strong>
                    {execution.task_name || task.task_name || `Schedule #${execution.schedule_id}`}
                  </strong>
                  <span>{preview}</span>
                </span>

                <span className={styles.meta}>
                  <span
                    className={`${styles.status} ${
                      styles[String(execution.status || "").toLowerCase()] || ""
                    }`}
                  >
                    {execution.status}
                  </span>
                  <time>{formatDateTime(execution.scheduled_for || execution.created_at)}</time>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {error && executions.length > 0 && (
        <div className={styles.inlineError}>{error}</div>
      )}

      {hasMore && (
        <button
          type="button"
          className={styles.loadMore}
          onClick={onLoadMore}
          disabled={loading}
        >
          {loading ? "Loading..." : "Load more executions"}
        </button>
      )}

      {selected && (
        <Modal
          title={
            selected.execution.task_name ||
            selected.task.task_name ||
            `Task execution #${selected.execution.execution_id}`
          }
          onClose={() => setSelected(null)}
        >
          <div className={styles.resultMeta}>
            <span>{selected.execution.status}</span>
            <span>{selected.execution.task_action || selected.task.task_action}</span>
            <span>{formatDateTime(selected.execution.scheduled_for || selected.execution.created_at)}</span>
          </div>

          <div className={styles.resultView}>
            {selected.execution.error_message ? (
              <p className={styles.errorMessage}>{selected.execution.error_message}</p>
            ) : selected.resultContent ? (
              <MarkdownContent value={selected.resultContent} />
            ) : (
              <p className={styles.emptyResult}>No stored result details.</p>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}

export default ExecutionLog;
