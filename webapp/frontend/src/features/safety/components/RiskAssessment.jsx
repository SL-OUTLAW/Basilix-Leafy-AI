import ActionIcon from "./ActionIcon";

import styles from "./RiskAssessment.module.css";

function RiskAssessment({
  data = [],
  loading = false,
  error = false,
  onConfigure
}) {
  const items = Array.isArray(data) ? data : [];

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>Risk Assessment Overview</h2>
          <p>Risk levels are configurable.</p>
        </div>

        <button
          type="button"
          onClick={onConfigure}
        >
          Configure
        </button>
      </div>

      <div className={styles.tableHeader}>
        <span>Action</span>
        <span>Risk Level</span>
      </div>

      <div className={styles.list}>
        {loading ? (
          <div className={styles.state}>
            Loading risk assessment...
          </div>
        ) : error ? (
          <div className={styles.state}>
            Risk assessment unavailable.
          </div>
        ) : items.length === 0 ? (
          <div className={styles.state}>
            No risk assessment data available.
          </div>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={styles.row}
            >
              <div className={styles.action}>
                <ActionIcon type={item.type} size="compact" />

                <div>
                  <strong>{item.command || "Command"}</strong>

                  <span>
                    {item.description || "No description available."}
                  </span>
                </div>
              </div>

              <div className={styles.risk}>
                <span
                  className={
                    item.risk === "Low Risk"
                      ? styles.low
                      : item.risk === "Medium Risk"
                        ? styles.medium
                        : styles.high
                  }
                >
                  {item.risk || "Unknown"}
                </span>

                <small>
                  {item.approvalText || "Approval status unavailable"}
                </small>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default RiskAssessment;
