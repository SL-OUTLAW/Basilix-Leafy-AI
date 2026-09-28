import {
  CalendarClock,
  CalendarDays,
  ShieldQuestion
} from "lucide-react";

import TaskIcon from "./TaskIcon";

import styles from "./ScheduleOverview.module.css";

function isToday(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNextRun(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const runDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const dayDifference = Math.round(
    (runDay - today) / 86400000
  );

  let dayLabel;

  if (dayDifference === 0) {
    dayLabel = "Today";
  } else if (dayDifference === 1) {
    dayLabel = "Tomorrow";
  } else {
    dayLabel = date.toLocaleDateString([], {
      day: "2-digit",
      month: "short"
    });
  }

  return `${dayLabel} • ${formatTime(value)}`;
}

function getNextTask(tasks) {
  const now = Date.now();

  return tasks
    .filter((task) => {
      const status = String(task.status || "").toUpperCase();

      if (
        !task.enabled ||
        !task.next_run_at ||
        status === "COMPLETED" ||
        status === "CANCELLED"
      ) {
        return false;
      }

      const timestamp = new Date(task.next_run_at).getTime();

      return (
        !Number.isNaN(timestamp) &&
        timestamp >= now
      );
    })
    .sort((a, b) => {
      return (
        new Date(a.next_run_at).getTime() -
        new Date(b.next_run_at).getTime()
      );
    })[0];
}

function CalendarOverview({
  tasks,
  onOpenCalendar
}) {
  const completed = tasks.filter((task) => {
    return (
      String(task.status || "").toUpperCase() ===
      "COMPLETED"
    );
  }).length;

  const nextTask = getNextTask(tasks);

  return (
    <section className={styles.calendarPanel}>
      <h2>Schedule Overview</h2>

      <div className={styles.calendarBody}>
        <div className={styles.today}>
          <CalendarDays size={43} />

          <div>
            <strong>Today</strong>

            <span>
              {new Date().toLocaleDateString([], {
                day: "2-digit",
                month: "long",
                year: "numeric"
              })}
            </span>
          </div>
        </div>

        <div className={styles.facts}>
          <p>{tasks.length} scheduled tasks</p>
          <p>{completed} completed</p>

          <p>
            Next task at {formatTime(nextTask?.next_run_at)}
          </p>
        </div>
      </div>

      <button
        type="button"
        className={styles.calendarButton}
        onClick={onOpenCalendar}
      >
        <CalendarDays size={22} />
        View Full Calendar
      </button>
    </section>
  );
}

function SummaryOverview({ tasks }) {
  const completedToday = tasks.filter((task) => {
    return (
      String(task.status || "").toUpperCase() ===
        "COMPLETED" &&
      isToday(task.last_run_at)
    );
  }).length;

  const upcomingToday = tasks.filter((task) => {
    const status = String(task.status || "").toUpperCase();

    return (
      task.enabled &&
      status !== "COMPLETED" &&
      status !== "CANCELLED" &&
      isToday(task.next_run_at)
    );
  }).length;

  const nextTask = getNextTask(tasks);

  return (
    <section className={styles.summaryPanel}>
      <div className={styles.stats}>
        <article>
          <strong>{completedToday}</strong>
          <span>Completed Today</span>
        </article>

        <article>
          <strong>{upcomingToday}</strong>
          <span>Upcoming Today</span>
        </article>

        <article>
          <strong>{tasks.length}</strong>
          <span>Total Tasks</span>
        </article>
      </div>

      <div className={styles.cards}>
        <article className={styles.detailCard}>
          <h3>Next Scheduled Task</h3>

          <div className={styles.detailContent}>
            {nextTask ? (
              <TaskIcon
                iconName={nextTask.icon_name}
                iconKey={nextTask.icon_key}
                tone={nextTask.icon_tone}
                action={nextTask.task_action}
                size={27}
              />
            ) : (
              <div className={styles.neutralIcon}>
                <CalendarClock size={27} />
              </div>
            )}

            <div>
              <strong>
                {nextTask?.task_name || "No upcoming task"}
              </strong>

              <span>
                {nextTask
                  ? `${formatNextRun(nextTask.next_run_at)} • ${
                      nextTask.level_no === 0
                        ? "All levels"
                        : `Level ${nextTask.level_no}`
                    }`
                  : "No upcoming schedule"}
              </span>
            </div>
          </div>

          {nextTask && (
            <span className={styles.upcomingBadge}>
              Upcoming
            </span>
          )}
        </article>

        <article className={styles.detailCard}>
          <h3>Pending Approval</h3>

          <div className={styles.detailContent}>
            <div className={styles.neutralIcon}>
              <ShieldQuestion size={25} />
            </div>

            <div>
              <strong>—</strong>
              <span>Approval data unavailable</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function ScheduleOverview({
  tasks,
  mode,
  onOpenCalendar
}) {
  if (mode === "calendar") {
    return (
      <CalendarOverview
        tasks={tasks}
        onOpenCalendar={onOpenCalendar}
      />
    );
  }

  return <SummaryOverview tasks={tasks} />;
}

export default ScheduleOverview;
