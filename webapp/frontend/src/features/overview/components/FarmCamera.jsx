import styles from "./FarmCamera.module.css";

function FarmCamera({
  status = "unavailable",
  loading = false,
  error = false
}) {
  let message = "Camera stream unavailable.";

  if (loading) {
    message = "Loading camera status...";
  } else if (error) {
    message = "Farm camera could not be loaded.";
  } else if (status === "offline") {
    message = "Farm camera is offline.";
  } else if (status === "connecting") {
    message = "Loading camera status...";
  }

  return (
    <div className={styles.camera}>
      <div className={styles.status}>
        <span className={styles.indicator} />

        <span>
          Live Farm Camera
        </span>
      </div>

      <div className={styles.placeholder}>
        <span>{message}</span>
      </div>
    </div>
  );
}

export default FarmCamera;
