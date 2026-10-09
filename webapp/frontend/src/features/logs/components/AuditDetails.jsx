import styles from "./AuditDetails.module.css";

function getStatusClass(status) {
  if (status === "Approved") {
    return styles.statusApproved;
  }

  if (status === "Warning") {
    return styles.statusWarning;
  }

  if (status === "Pending") {
    return styles.statusPending;
  }

  return styles.statusNeutral;
}

function AuditDetails({ log, onClose }) {
  if (!log) {
    return null;
  }

  const details = log.details ?? {};
  const context = log.context ?? {};

  return (
    <aside className={styles.detailsPanel}>
      <div className={styles.detailsHeader}>
        <div>
          <h2>Audit Details</h2>
          <strong>{log.event}</strong>

          <p>
            {log.time} • {log.date}
          </p>
        </div>

        <button
          type="button"
          className={styles.closeDetails}
          onClick={onClose}
          aria-label="Close audit details"
        >
          ×
        </button>
      </div>

      <div className={styles.detailSection}>
        <h3>Log Information</h3>

        <dl>
          <div>
            <dt>Actor</dt>
            <dd>{log.actor}</dd>
          </div>

          <div>
            <dt>Level</dt>
            <dd>{log.level}</dd>
          </div>

          <div>
            <dt>Type</dt>
            <dd>{log.type}</dd>
          </div>

          <div>
            <dt>Status</dt>
            <dd className={getStatusClass(log.status)}>
              {log.status}
            </dd>
          </div>

          <div>
            <dt>Event</dt>
            <dd>{log.event}</dd>
          </div>

          <div>
            <dt>Description</dt>
            <dd>{log.description}</dd>
          </div>
        </dl>
      </div>

      <div className={styles.detailSection}>
        <h3>Details</h3>

        <dl>
          <div>
            <dt>Requested</dt>
            <dd>{details.requested ?? "—"}</dd>
          </div>

          <div>
            <dt>Target EC</dt>
            <dd>{details.targetEC ?? "—"}</dd>
          </div>

          <div>
            <dt>Target pH</dt>
            <dd>{details.targetPH ?? "—"}</dd>
          </div>

          <div>
            <dt>Scheduled</dt>
            <dd>{details.scheduled ?? "—"}</dd>
          </div>

          <div>
            <dt>Requested By</dt>
            <dd>{details.requestedBy ?? "—"}</dd>
          </div>

          <div>
            <dt>Request ID</dt>
            <dd>{details.requestId ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className={styles.detailSection}>
        <h3>Context</h3>

        <dl>
          <div>
            <dt>Water Level</dt>
            <dd>{context.waterLevel ?? "—"}</dd>
          </div>

          <div>
            <dt>Current EC</dt>
            <dd>{context.currentEC ?? "—"}</dd>
          </div>

          <div>
            <dt>Current pH</dt>
            <dd>{context.currentPH ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

export default AuditDetails;