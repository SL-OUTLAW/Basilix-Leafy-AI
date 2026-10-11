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

function formatMetadataKey(key) {
  return String(key)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMetadataValue(value) {
  if (value == null || value === "") {
    return "-";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "-";
    }

    return value
      .map((item) =>
        typeof item === "object" ? JSON.stringify(item) : String(item),
      )
      .join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function MetadataValue({ value }) {
  if (value !== null && typeof value === "object") {
    return (
      <pre
        style={{
          margin: 0,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          font: "inherit",
        }}
      >
        {formatMetadataValue(value)}
      </pre>
    );
  }

  return formatMetadataValue(value);
}

function AuditDetails({ log, onClose }) {
  if (!log) {
    return null;
  }

  const metadata =
    log.metadata && typeof log.metadata === "object" ? log.metadata : {};

  const metadataEntries = Object.entries(metadata);

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

            <dd className={getStatusClass(log.status)}>{log.status}</dd>
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

      {metadataEntries.length > 0 && (
        <div className={styles.detailSection}>
          <h3>Metadata</h3>

          <dl>
            {metadataEntries.map(([key, value]) => (
              <div key={key}>
                <dt>{formatMetadataKey(key)}</dt>

                <dd>
                  <MetadataValue value={value} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </aside>
  );
}

export default AuditDetails;
