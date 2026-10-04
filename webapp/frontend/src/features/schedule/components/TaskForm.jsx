import { useEffect, useState } from "react";
import { X } from "lucide-react";
import TaskIcon from "./TaskIcon";
import styles from "./TaskForm.module.css";

const ACTIONS = [
  ["SET_LIGHTING", "Lighting"],
  ["RUN_IRRIGATION", "Irrigation"],
  ["SET_FAN", "Fan"],
  ["DOSE_PH", "Dose pH to target"],
  ["DOSE_EC", "Dose EC to target"],
  ["RUN_AI_ANALYSIS", "AI analysis"]
];

function initialValues(task) {
  return {
    task_name: task?.task_name || "",
    task_description: task?.description || task?.task_description || "",
    task_action: task?.task_action || "RUN_IRRIGATION",
    level_no: task?.level_no ?? 0,
    start_time: task?.start_time?.slice(0, 8) || "08:00",
    interval_seconds: task?.interval_seconds ?? "",
    duration_seconds: task?.duration_seconds ?? "",
    target_value: task?.target_value ?? "",
    unit: task?.unit || ""
  };
}

function TaskForm({ task, onClose, onSave, busy }) {
  const [form, setForm] = useState(() => initialValues(task));
  useEffect(() => setForm(initialValues(task)), [task]);
  const action = form.task_action;
  const isLighting = action === "SET_LIGHTING";
  const isDosing = action === "DOSE_PH" || action === "DOSE_EC";
  const isTimed = ["SET_LIGHTING", "RUN_IRRIGATION", "SET_FAN"].includes(action);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const payload = {
      ...form,
      level_no: isLighting ? Number(form.level_no) : 0,
      interval_seconds: form.interval_seconds === "" ? null : Number(form.interval_seconds),
      duration_seconds: isTimed && form.duration_seconds !== "" ? Number(form.duration_seconds) : null,
      target_value: isDosing && form.target_value !== "" ? Number(form.target_value) : null,
      unit: isDosing ? form.unit || (action === "DOSE_PH" ? "pH" : "uS/cm") : null
    };
    onSave(payload);
  }

  return (
    <div className={styles.backdrop}>
      <form className={styles.modal} onSubmit={submit}>
        <div className={styles.header}>
          <div className={styles.heading}><TaskIcon action={action} /><div><h2>{task ? "Edit Task" : "Add Task"}</h2><p>Configure a farm schedule task.</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </div>
        <div className={styles.grid}>
          <label>Task name<input value={form.task_name} onChange={(e) => update("task_name", e.target.value)} required /></label>
          <label>Action<select value={action} onChange={(e) => update("task_action", e.target.value)}>{ACTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Start time<input type="time" value={form.start_time?.slice(0,5)} onChange={(e) => update("start_time", e.target.value)} required /></label>
          {isLighting && <label>Level<select value={form.level_no} onChange={(e) => update("level_no", e.target.value)}><option value="1">Level 1</option><option value="2">Level 2</option></select></label>}
          <label>Repeat interval (seconds)<input type="number" min="1" value={form.interval_seconds} onChange={(e) => update("interval_seconds", e.target.value)} placeholder="Optional" /></label>
          {isTimed && <label>Duration (seconds)<input type="number" min="1" value={form.duration_seconds} onChange={(e) => update("duration_seconds", e.target.value)} placeholder="Optional" /></label>}
          {isDosing && <label>Target value<input type="number" step="any" value={form.target_value} onChange={(e) => update("target_value", e.target.value)} required /></label>}
          <label className={styles.full}>Description<textarea value={form.task_description} onChange={(e) => update("task_description", e.target.value)} rows="3" /></label>
        </div>
        <div className={styles.actions}><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={busy}>{busy ? "Saving..." : task ? "Save Changes" : "Create Task"}</button></div>
      </form>
    </div>
  );
}

export default TaskForm;
