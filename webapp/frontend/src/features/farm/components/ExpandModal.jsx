import styles from "./ExpandModal.module.css";

function ExpandModal({
  title,
  children,
  onClose,
  fullScreen = false
}) {
  return (
    <div
      className={`${styles.overlay} ${
        fullScreen ? styles.fullScreenOverlay : ""
      }`}
      onClick={onClose}
    >
      <div
        className={`${styles.modal} ${
          fullScreen ? styles.fullScreen : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2>{title}</h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default ExpandModal;