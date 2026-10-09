import styles from "./StatusCard.module.css";

function StatusCard({
  title,
  value,
  note,
  icon: Icon,
  tone = "green"
}) {
  const displayValue =
    value === null || value === undefined || value === ""
      ? "—"
      : value;

  const displayNote = note || "Not available";

  return (
    <div className={`${styles.card} ${styles[tone]}`}>
      <div className={styles.iconArea}>
        {Icon ? (
          <Icon
            className={styles.iconGraphic}
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className={styles.content}>
        <h3>{title}</h3>
        <p className={styles.value}>{displayValue}</p>
        <span>{displayNote}</span>
      </div>
    </div>
  );
}

export default StatusCard;
