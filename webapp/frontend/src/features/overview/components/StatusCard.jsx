import styles from "./StatusCard.module.css";

function StatusCard({ title, value, note, icon, valueClass = "" }) {
  return (
    <div className={styles.card}>
      <div className={styles.iconArea}>
        {icon ? <img src={icon} alt="" /> : null}
      </div>

      <div className={styles.content}>
        <h3>{title}</h3>

        <p className={`${styles.value} ${valueClass}`}>
          {value}
        </p>

        <span>{note}</span>
      </div>
    </div>
  );
}

export default StatusCard;