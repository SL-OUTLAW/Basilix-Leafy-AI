import { CalendarDays } from "lucide-react";

import Modal from "../../../components/common/Modal/Modal";
import StateMessage from "../../../components/common/StateMessage/StateMessage";
import { formatClockTime } from "../../../utils/formatters";
import styles from "./FullCalendar.module.css";

function FullCalendar({ tasks, onClose }) {
  return (
    <Modal
      title="Full Schedule"
      icon={CalendarDays}
      onClose={onClose}
      size="small"
      contentClassName={styles.content}
    >
      {tasks.length === 0 ? (
        <StateMessage message="No scheduled tasks." />
      ) : (
        <div className={styles.list}>
          {tasks.map((task) => (
            <div key={task.schedule_id} className={styles.row}>
              <span className={styles.time}>
                {formatClockTime(task.start_time)}
              </span>

              <div>
                <strong>{task.task_name}</strong>
                <span>{task.description || "Scheduled task"}</span>
              </div>

              <span className={styles.status}>
                {String(task.status || "Scheduled")
                  .toLowerCase()
                  .replace(/^\w/, (letter) => letter.toUpperCase())}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default FullCalendar;
