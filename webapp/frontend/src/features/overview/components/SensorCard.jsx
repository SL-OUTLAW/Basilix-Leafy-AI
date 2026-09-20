import styles from "./SensorCard.module.css";

function SensorCard({ title, value, status, icon }) {
  return (
    <div className={styles.card}>
      <div className={styles.iconArea}>
        {icon ? <img src={icon} alt="" /> : null}
      </div>

      <div className={styles.content}>
        <h3>{title}</h3>
        <p className={styles.value}>{value}</p>
        <span>{status}</span>
      </div>
    </div>
  );
}

export default SensorCard;