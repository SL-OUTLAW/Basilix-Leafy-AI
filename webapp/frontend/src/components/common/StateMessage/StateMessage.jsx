import styles from "./StateMessage.module.css";

function StateMessage({ title, message, tone = "neutral", compact = false }) {
  return (
    <div
      className={`${styles.state} ${styles[tone] || styles.neutral} ${compact ? styles.compact : ""}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {title && <strong>{title}</strong>}
      {message && <span>{message}</span>}
    </div>
  );
}

export default StateMessage;
