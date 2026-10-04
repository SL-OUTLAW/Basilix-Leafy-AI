import { X } from "lucide-react";
import styles from "./Modal.module.css";

function Modal({
  open = true,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  onClose,
  size = "medium",
  fullScreen = false,
  contentClassName = "",
  ariaLabel
}) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={`${styles.overlay} ${fullScreen ? styles.fullScreenOverlay : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
      role="presentation"
    >
      <section
        className={`${styles.modal} ${styles[size] || styles.medium} ${
          fullScreen ? styles.fullScreen : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || (typeof title === "string" ? title : "Dialog")}
      >
        {(title || subtitle || Icon || onClose) && (
          <header className={styles.header}>
            <div className={styles.heading}>
              {Icon && <Icon className={styles.headerIcon} aria-hidden="true" />}
              <div>
                {title && <h2>{title}</h2>}
                {subtitle && <p>{subtitle}</p>}
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                className={styles.closeButton}
                onClick={onClose}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </header>
        )}

        <div className={`${styles.content} ${contentClassName}`.trim()}>
          {children}
        </div>

        {footer && <footer className={styles.footer}>{footer}</footer>}
      </section>
    </div>
  );
}

export default Modal;
