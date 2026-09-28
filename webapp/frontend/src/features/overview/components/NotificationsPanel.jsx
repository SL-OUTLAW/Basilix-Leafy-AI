import {
  Droplets,
  FlaskConical,
  Users
} from "lucide-react";

import styles from "./NotificationsPanel.module.css";

function getNotificationType(type = "") {
  switch (type) {
    case "SENSOR_ALERT":
      return "sensor";

    case "SENSOR_OFFLINE":
      return "sensor";

    case "CAMERA_ALERT":
      return "camera";

    case "CAMERA_OFFLINE":
      return "camera";

    default:
      return "general";
  }
}

const notificationIcons = {
  sensor: FlaskConical,
  camera: Users,
  general: Droplets
};

function NotificationsPanel({
  notifications = [],
  loading = false,
  error = false,
  onViewAll
}) {
  const items = Array.isArray(notifications)
    ? notifications
    : [];

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <h2>AI Notifications · 24h</h2>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
          >
            View All
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.state}>
          Loading notifications...
        </div>
      ) : error ? (
        <div className={styles.state}>
          Notifications could not be loaded.
        </div>
      ) : items.length === 0 ? (
        <div className={styles.state}>
          No notifications available.
        </div>
      ) : (
        <div className={styles.list}>
          {items.map((item) => {
            const type = getNotificationType(item.type);
            const Icon = notificationIcons[type];

            return (
              <article
                key={item.id || `${item.time}-${item.title}`}
                className={styles.notification}
              >
                <span className={styles.time}>
                  {item.time || "—"}
                </span>

                <div
                  className={`${styles.indicator} ${styles[type]}`}
                >
                  <Icon
                    className={styles.iconGraphic}
                    aria-hidden="true"
                  />
                </div>

                <div className={styles.content}>
                  <h3>
                    {item.title || "Notification"}
                  </h3>

                  <p>
                    {item.message ||
                      "No additional details available."}
                  </p>
                </div>

                <span
                  className={`${styles.relativeTime} ${styles[`${type}Time`]}`}
                >
                  {item.relativeTime || ""}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default NotificationsPanel;
