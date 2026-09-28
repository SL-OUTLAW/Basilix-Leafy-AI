import { CalendarDays, X } from "lucide-react";

import styles from "./FullCalendar.module.css";

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

function FullCalendar({ tasks, onClose }) {
  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className={styles.modal}>
        <div className={styles.header}>
          <div>
            <CalendarDays size={22} />
            <h2>Full Schedule</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close full schedule"
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.list}>
          {tasks.length === 0 ? (
            <p className={styles.empty}>
              No scheduled tasks.
            </p>
          ) : (
            tasks.map((task) => (
              <div
                key={task.schedule_id}
                className={styles.row}
              >
                <span className={styles.time}>
                  {formatTime(task.start_time)}
                </span>

                <div>
                  <strong>{task.task_name}</strong>
                  <span>
                    {task.description || "Scheduled task"}
                  </span>
                </div>

                <span className={styles.status}>
                  {String(task.status || "Scheduled")
                    .toLowerCase()
                    .replace(/^\w/, (letter) =>
                      letter.toUpperCase()
                    )}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default FullCalendar;
