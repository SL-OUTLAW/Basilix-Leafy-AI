import { useEffect, useState } from "react";

import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";
import Modal from "../../../components/common/Modal/Modal";
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

  useEffect(() => {
    setForm(initialValues(task));
  }, [task]);

  const action = form.task_action;
  const isLighting = action === "SET_LIGHTING";
  const isDosing = action === "DOSE_PH" || action === "DOSE_EC";
  const isTimed = ["SET_LIGHTING", "RUN_IRRIGATION", "SET_FAN"].includes(action);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function submit(event) {
    event.preventDefault();

    onSave({
      ...form,
      level_no: isLighting ? Number(form.level_no) : 0,
      interval_seconds:
        form.interval_seconds === "" ? null : Number(form.interval_seconds),
      duration_seconds:
        isTimed && form.duration_seconds !== ""
          ? Number(form.duration_seconds)
          : null,
      target_value:
        isDosing && form.target_value !== ""
          ? Number(form.target_value)
          : null,
      unit: isDosing
        ? form.unit || (action === "DOSE_PH" ? "pH" : "uS/cm")
        : null
    });
  }

  const footer = (
    <div className={styles.actions}>
      <button type="button" onClick={onClose} disabled={busy}>
        Cancel
      </button>
      <button type="submit" form="schedule-task-form" disabled={busy}>
        {busy ? "Saving..." : task ? "Save Changes" : "Create Task"}
      </button>
    </div>
  );

  return (
    <Modal
      title={task ? "Edit Task" : "Add Task"}
      subtitle="Configure a farm schedule task."
      onClose={busy ? undefined : onClose}
      size="large"
      footer={footer}
    >
      <form id="schedule-task-form" className={styles.form} onSubmit={submit}>
        <div className={styles.actionPreview}>
          <ActionIcon action={action} size={21} />
          <span>{ACTIONS.find(([value]) => value === action)?.[1] || action}</span>
        </div>

        <div className={styles.grid}>
          <label>
            Task name
            <input
              value={form.task_name}
              onChange={(event) => update("task_name", event.target.value)}
              required
            />
          </label>

          <label>
            Action
            <select
              value={action}
              onChange={(event) => update("task_action", event.target.value)}
            >
              {ACTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Start time
            <input
              type="time"
              value={form.start_time?.slice(0, 5)}
              onChange={(event) => update("start_time", event.target.value)}
              required
            />
          </label>

          {isLighting && (
            <label>
              Level
              <select
                value={form.level_no}
                onChange={(event) => update("level_no", event.target.value)}
              >
                <option value="1">Level 1</option>
                <option value="2">Level 2</option>
              </select>
            </label>
          )}

          <label>
            Repeat interval (seconds)
            <input
              type="number"
              min="1"
              value={form.interval_seconds}
              onChange={(event) => update("interval_seconds", event.target.value)}
              placeholder="Optional"
            />
          </label>

          {isTimed && (
            <label>
              Duration (seconds)
              <input
                type="number"
                min="1"
                value={form.duration_seconds}
                onChange={(event) => update("duration_seconds", event.target.value)}
                placeholder="Optional"
              />
            </label>
          )}

          {isDosing && (
            <label>
              Target value
              <input
                type="number"
                step="any"
                value={form.target_value}
                onChange={(event) => update("target_value", event.target.value)}
                required
              />
            </label>
          )}

          <label className={styles.full}>
            Description
            <textarea
              value={form.task_description}
              onChange={(event) => update("task_description", event.target.value)}
              rows="3"
            />
          </label>
        </div>
      </form>
    </Modal>
  );
}

export default TaskForm;
