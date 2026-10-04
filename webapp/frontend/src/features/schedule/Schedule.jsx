import { useEffect, useMemo, useState } from "react";
import { createSchedule, getFarmSchedule, setScheduleEnabled, updateSchedule } from "../../services/scheduleApi";
import { getTaskExecutions } from "../../services/taskExecutionApi";
import FullCalendar from "./components/FullCalendar";
import ScheduleOverview from "./components/ScheduleOverview";
import TaskDetails from "./components/TaskDetails";
import TaskList from "./components/TaskList";
import TaskForm from "./components/TaskForm";
import ExecutionLog from "./components/ExecutionLog";
import styles from "./Schedule.module.css";

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
  const canManage = Boolean(access?.allowed?.SCHEDULE_MANAGE);

  async function loadSchedule() {
    setLoading(true); setError("");
    try { setTasks(await getFarmSchedule(token, onTokenRefresh)); }
    catch (err) { setTasks([]); setError(err.message || "Failed to load farm schedule"); }
    finally { setLoading(false); }
  }

  async function loadExecutions() {
    setLogLoading(true); setLogError("");
    try { setExecutions(await getTaskExecutions(token, onTokenRefresh, { limit: 200 })); }
    catch (err) { setExecutions([]); setLogError(err.message || "Failed to load task execution log"); }
    finally { setLogLoading(false); }
  }

  useEffect(() => { if (token) { loadSchedule(); loadExecutions(); } }, [token, onTokenRefresh]);

  const sortedTasks = useMemo(() => [...tasks].sort((a,b) => String(a.start_time || "").localeCompare(String(b.start_time || ""))), [tasks]);
  const selectedTask = useMemo(() => tasks.find((task) => String(task.schedule_id) === String(selectedId)) || null, [tasks, selectedId]);

  async function handleToggleEnabled(task) {
    setError("");
    try {
      const updated = await setScheduleEnabled(token, onTokenRefresh, task.schedule_id, !task.enabled);
      setTasks((current) => current.map((item) => item.schedule_id === updated.schedule_id ? updated : item));
    } catch (err) { setError(err.message || "Failed to update schedule state"); }
  }

  async function handleSave(payload) {
    setSaving(true); setError("");
    try {
      if (formTask?.schedule_id) await updateSchedule(token, onTokenRefresh, formTask.schedule_id, payload);
      else await createSchedule(token, onTokenRefresh, payload);
      setFormOpen(false); setFormTask(undefined); await loadSchedule();
    } catch (err) { setError(err.message || "Failed to save task"); }
    finally { setSaving(false); }
  }

  return (
    <div className={styles.schedule}>
      <div className={styles.viewTabs}>
        <button type="button" className={activeTab === "tasks" ? styles.activeView : ""} onClick={() => setActiveTab("tasks")}>Tasks</button>
        <button type="button" className={activeTab === "log" ? styles.activeView : ""} onClick={() => { setActiveTab("log"); loadExecutions(); }}>Execution Log</button>
      </div>

      {activeTab === "tasks" ? <>
        <div className={`${styles.topGrid} ${selectedTask ? styles.withDetails : styles.listOnly}`}>
          <TaskList tasks={sortedTasks} selectedId={selectedId} onSelect={(id) => setSelectedId((current) => String(current) === String(id) ? null : id)} onAdd={canManage ? () => { setFormTask(undefined); setFormOpen(true); } : undefined} loading={loading} error={error} />
          {selectedTask && <TaskDetails task={selectedTask} onClose={() => setSelectedId(null)} onToggleEnabled={canManage ? () => handleToggleEnabled(selectedTask) : undefined} onEdit={canManage ? () => { setFormTask(selectedTask); setFormOpen(true); } : undefined} />}
        </div>
        <div className={styles.bottomGrid}><ScheduleOverview tasks={tasks} mode="calendar" onOpenCalendar={() => setCalendarOpen(true)} /><ScheduleOverview tasks={tasks} mode="summary" /></div>
      </> : <ExecutionLog executions={executions} tasks={tasks} loading={logLoading} error={logError} />}

      {calendarOpen && <FullCalendar tasks={sortedTasks} onClose={() => setCalendarOpen(false)} />}
      {formOpen && <TaskForm task={formTask} busy={saving} onClose={() => { if (!saving) setFormOpen(false); }} onSave={handleSave} />}
    </div>
  );
}

export default Schedule;
