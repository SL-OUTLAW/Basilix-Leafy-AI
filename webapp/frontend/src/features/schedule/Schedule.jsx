import { useEffect, useMemo, useState } from "react";
import { ListTodo, ScrollText } from "lucide-react";

import Tabs from "../../components/common/Tabs/Tabs";
import { createSchedule, getFarmSchedule, setScheduleEnabled, updateSchedule } from "../../services/scheduleApi";
import { getTaskExecutions } from "../../services/taskExecutionApi";
import FullCalendar from "./components/FullCalendar";
import ScheduleOverview from "./components/ScheduleOverview";
import TaskDetails from "./components/TaskDetails";
import TaskList from "./components/TaskList";
import TaskForm from "./components/TaskForm";
import ExecutionLog from "./components/ExecutionLog";
import styles from "./Schedule.module.css";

const tabs = [
  { id: "tasks", label: "Tasks", Icon: ListTodo },
  { id: "log", label: "Execution Log", Icon: ScrollText }
];

function Schedule({ token, onTokenRefresh, access }) {
  const [tasks, setTasks] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [formTask, setFormTask] = useState(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("tasks");
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [logError, setLogError] = useState("");
  const [logHasMore, setLogHasMore] = useState(true);
  const canManage = Boolean(access?.allowed?.SCHEDULE_MANAGE);

  async function loadSchedule() {
    setLoading(true);
    setError("");

    try {
      setTasks(await getFarmSchedule(token, onTokenRefresh));
    } catch (err) {
      setTasks([]);
      setError(err.message || "Failed to load farm schedule");
    } finally {
      setLoading(false);
    }
  }

  async function loadExecutions() {
    setLogLoading(true);
    setLogError("");

    try {
      const page = await getTaskExecutions(token, onTokenRefresh, { limit: 50, offset: 0 });
      setExecutions(page);
      setLogHasMore(page.length === 50);
    } catch (err) {
      setExecutions([]);
      setLogError(err.message || "Failed to load task execution log");
    } finally {
      setLogLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadSchedule();
      loadExecutions();
    }
  }, [token, onTokenRefresh]);

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) =>
        String(a.start_time || "").localeCompare(String(b.start_time || ""))
      ),
    [tasks]
  );

  const selectedTask = useMemo(
    () =>
      tasks.find(
        (task) => String(task.schedule_id) === String(selectedId)
      ) || null,
    [tasks, selectedId]
  );

  async function handleToggleEnabled(task) {
    setError("");

    try {
      const updated = await setScheduleEnabled(
        token,
        onTokenRefresh,
        task.schedule_id,
        !task.enabled
      );

      setTasks((current) =>
        current.map((item) =>
          item.schedule_id === updated.schedule_id ? updated : item
        )
      );
    } catch (err) {
      setError(err.message || "Failed to update schedule state");
    }
  }

  async function handleSave(payload) {
    setSaving(true);
    setError("");

    try {
      if (formTask?.schedule_id) {
        await updateSchedule(
          token,
          onTokenRefresh,
          formTask.schedule_id,
          payload
        );
      } else {
        await createSchedule(token, onTokenRefresh, payload);
      }

      setFormOpen(false);
      setFormTask(undefined);
      await loadSchedule();
    } catch (err) {
      setError(err.message || "Failed to save task");
    } finally {
      setSaving(false);
    }
  }

  async function loadMoreExecutions() {
    if (logLoading || !logHasMore) return;
    setLogLoading(true);
    try {
      const next = await getTaskExecutions(token, onTokenRefresh, { limit: 50, offset: executions.length });
      setExecutions((current) => [...current, ...next]);
      setLogHasMore(next.length === 50);
    } catch (err) { setLogError(err.message || "Failed to load more executions"); }
    finally { setLogLoading(false); }
  }

  function changeTab(tab) {
    setActiveTab(tab);
    if (tab === "log") {
      loadExecutions();
    }
  }

  return (
    <div className={styles.schedule}>
      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={changeTab}
        ariaLabel="Schedule sections"
      />

      {activeTab === "tasks" ? (
        <>
          <div
            className={`${styles.topGrid} ${
              selectedTask ? styles.withDetails : styles.listOnly
            }`}
          >
            <TaskList
              tasks={sortedTasks}
              selectedId={selectedId}
              onSelect={(id) =>
                setSelectedId((current) =>
                  String(current) === String(id) ? null : id
                )
              }
              onAdd={
                canManage
                  ? () => {
                      setFormTask(undefined);
                      setFormOpen(true);
                    }
                  : undefined
              }
              loading={loading}
              error={error}
            />

            {selectedTask && (
              <TaskDetails
                task={selectedTask}
                onClose={() => setSelectedId(null)}
                onToggleEnabled={
                  canManage
                    ? () => handleToggleEnabled(selectedTask)
                    : undefined
                }
                onEdit={
                  canManage
                    ? () => {
                        setFormTask(selectedTask);
                        setFormOpen(true);
                      }
                    : undefined
                }
              />
            )}
          </div>

          <div className={styles.bottomGrid}>
            <ScheduleOverview
              tasks={tasks}
              mode="calendar"
              onOpenCalendar={() => setCalendarOpen(true)}
            />
            <ScheduleOverview tasks={tasks} mode="summary" />
          </div>
        </>
      ) : (
        <ExecutionLog
          executions={executions}
          tasks={tasks}
          loading={logLoading}
          error={logError}
          hasMore={logHasMore}
          onLoadMore={loadMoreExecutions}
        />
      )}

      {calendarOpen && (
        <FullCalendar
          tasks={sortedTasks}
          onClose={() => setCalendarOpen(false)}
        />
      )}

      {formOpen && (
        <TaskForm
          task={formTask}
          busy={saving}
          onClose={() => {
            if (!saving) setFormOpen(false);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default Schedule;
