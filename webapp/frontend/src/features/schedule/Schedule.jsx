import { useEffect, useMemo, useState } from "react";

import { getFarmSchedule } from "../../services/scheduleApi";

import FullCalendar from "./components/FullCalendar";
import ScheduleOverview from "./components/ScheduleOverview";
import TaskDetails from "./components/TaskDetails";
import TaskList from "./components/TaskList";

import styles from "./Schedule.module.css";

function Schedule({ token }) {
  const [tasks, setTasks] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSchedule() {
      setLoading(true);
      setError("");

      try {
        const data = await getFarmSchedule(token);

        if (!active) {
          return;
        }

        if (!Array.isArray(data)) {
          throw new Error("Invalid schedule response");
        }

        setTasks(data);
      } catch (err) {
        if (!active) {
          return;
        }

        setTasks([]);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load farm schedule"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (token) {
      loadSchedule();
    } else {
      setTasks([]);
      setError("Authentication required");
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [token]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      return String(a.start_time || "").localeCompare(
        String(b.start_time || "")
      );
    });
  }, [tasks]);

  const selectedTask = useMemo(() => {
    return (
      tasks.find(
        (task) =>
          String(task.schedule_id) === String(selectedId)
      ) || null
    );
  }, [tasks, selectedId]);

  function handleSelectTask(id) {
    setSelectedId((current) =>
      String(current) === String(id) ? null : id
    );
  }

  return (
    <div className={styles.schedule}>
      <div
        className={`${styles.topGrid} ${
          selectedTask ? styles.withDetails : styles.listOnly
        }`}
      >
        <TaskList
          tasks={sortedTasks}
          selectedId={selectedId}
          onSelect={handleSelectTask}
          loading={loading}
          error={error}
        />

        {selectedTask && (
          <TaskDetails
            task={selectedTask}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <div className={styles.bottomGrid}>
        <ScheduleOverview
          tasks={tasks}
          mode="calendar"
          onOpenCalendar={() => setCalendarOpen(true)}
        />

        <ScheduleOverview
          tasks={tasks}
          mode="summary"
        />
      </div>

      {calendarOpen && (
        <FullCalendar
          tasks={sortedTasks}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  );
}

export default Schedule;
