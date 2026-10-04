import { Plus } from "lucide-react";
import TaskIcon from "./TaskIcon";

import styles from "./TaskList.module.css";

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const [hourValue, minute] = String(value).split(":");
  const hour = Number(hourValue);

  if (Number.isNaN(hour)) {
    return String(value);
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${String(displayHour).padStart(2, "0")}:${minute} ${suffix}`;
}

function formatLevel(level) {
  if (level === 0) {
    return "All levels";
  }

  if (level === null || level === undefined) {
    return "";
  }

  return `Level ${level}`;
}

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
          <div className={styles.state}>
            Loading schedule...
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            {error}
          </div>
        ) : tasks.length === 0 ? (
          <div className={styles.state}>
            No scheduled tasks are available.
          </div>
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
                <TaskIcon
                  iconName={task.icon_name}
                  iconKey={task.icon_key}
                  tone={task.icon_tone}
                  action={task.task_action}
                  size={20}
                />

                <span className={styles.time}>
                  {formatTime(task.start_time)}
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
