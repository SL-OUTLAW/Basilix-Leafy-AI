import { Plus } from "lucide-react";
import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";
import StateMessage from "../../../components/common/StateMessage/StateMessage";
import { formatClockTime, formatLevel } from "../../../utils/formatters";

import styles from "./TaskList.module.css";


function getStatus(task) {
  const status = String(task.status || "").toUpperCase();

  if (!task.enabled) {
    return {
      label: "Disabled",
      className: styles.disabled
    };
  }

  if (status === "COMPLETED") {
    return {
      label: "Completed",
      className: styles.completed
    };
  }

  if (status === "SCHEDULED") {
    return {
      label: "Scheduled",
      className: styles.scheduled
    };
  }

  return {
    label: "Upcoming",
    className: styles.upcoming
  };
}

function TaskList({
  tasks,
  selectedId,
  onSelect,
  onAdd,
  loading,
  error
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2>Today&apos;s Tasks</h2>

        <span className={styles.count}>
          {tasks.length} Tasks
        </span>
      </div>

      <div className={styles.list}>
        {loading ? (
          <StateMessage compact message="Loading schedule..." />
        ) : error ? (
          <StateMessage compact tone="error" message={error} />
        ) : tasks.length === 0 ? (
          <StateMessage compact message="No scheduled tasks are available." />
        ) : (
          tasks.map((task) => {
            const selected =
              String(task.schedule_id) === String(selectedId);

            const status = getStatus(task);

            const secondaryText =
              task.description ||
              formatLevel(task.level_no) ||
              "Scheduled task";

            return (
              <button
                key={task.schedule_id}
                type="button"
                className={`${styles.task} ${
                  selected ? styles.selected : ""
                }`}
                onClick={() => onSelect(task.schedule_id)}
              >
                <ActionIcon
                  iconName={task.icon_name}
                  iconKey={task.icon_key}
                  tone={task.icon_tone}
                  action={task.task_action}
                  size={20}
                />

                <span className={styles.time}>
                  {formatClockTime(task.start_time)}
                </span>

                <span className={styles.taskText}>
                  <strong>
                    {task.task_name || "Scheduled Task"}
                  </strong>

                  <span>{secondaryText}</span>
                </span>

                <span
                  className={`${styles.status} ${status.className}`}
                >
                  {status.label}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.addButton}
          onClick={onAdd}
          disabled={!onAdd}
        >
          <Plus size={18} />
          Add New Task
        </button>
      </div>
    </section>
  );
}

export default TaskList;
