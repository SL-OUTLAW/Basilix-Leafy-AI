import {
  CalendarClock,
  Check,
  Pencil,
  Power,
  X
} from "lucide-react";

import TaskIcon from "./TaskIcon";

import styles from "./TaskDetails.module.css";

function formatTime(value) {
  if (!value) {
    return "—";
  }

  if (/^\d{2}:\d{2}/.test(value)) {
    const [hourValue, minute] = value.split(":");
    const hour = Number(hourValue);
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatLevel(level) {
  if (level === 0) {
    return "All";
  }

  if (level === null || level === undefined) {
    return "—";
  }

  return `Level ${level}`;
}

function formatAction(value) {
  if (!value) {
    return "—";
  }

  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatus(task) {
  if (!task.enabled) {
    return {
      label: "Disabled",
      className: styles.disabled
    };
  }

  const status = String(task.status || "").toUpperCase();

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

function TaskDetails({
  task,
  onClose,
  onEdit,
  onToggleEnabled
}) {
  if (!task) {
    return null;
  }

  const status = getStatus(task);

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2>Task Details</h2>

        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close task details"
        >
          <X size={18} />
        </button>
      </div>

      <div className={styles.taskHeading}>
        <TaskIcon
          iconName={task.icon_name}
          iconKey={task.icon_key}
          tone={task.icon_tone}
          action={task.task_action}
          size={27}
        />

        <h3>{task.task_name || "Scheduled Task"}</h3>

        <span
          className={`${styles.status} ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <dl className={styles.information}>
        <div>
          <dt>Time</dt>
          <dd>{formatTime(task.start_time)}</dd>
        </div>

        <div>
          <dt>Level</dt>
          <dd>{formatLevel(task.level_no)}</dd>
        </div>

        <div>
          <dt>Action</dt>
          <dd>{formatAction(task.task_action)}</dd>
        </div>

        <div>
          <dt>Status</dt>
          <dd>{status.label}</dd>
        </div>

        <div>
          <dt>Automation</dt>
          <dd>{task.enabled ? "Enabled" : "Disabled"}</dd>
        </div>
      </dl>

      <div className={styles.description}>
        <h3>Description</h3>

        <p>
          {task.description || "No description available."}
        </p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.completeButton}
          disabled
        >
          Mark Complete
          <Check size={17} />
        </button>

        <button
          type="button"
          className={styles.cancelButton}
          onClick={onToggleEnabled}
          disabled={!onToggleEnabled}
        >
          {task.enabled ? "Disable Task" : "Enable Task"}
          <Power size={17} />
        </button>

        <button
          type="button"
          className={styles.secondaryButton}
          onClick={onEdit}
          disabled={!onEdit}
        >
          Edit Task
          <Pencil size={17} />
        </button>

        <button
          type="button"
          className={styles.secondaryButton}
          disabled
        >
          Reschedule
          <CalendarClock size={17} />
        </button>
      </div>
    </section>
  );
}

export default TaskDetails;
