import styles from "./Tabs.module.css";

function Tabs({
  tabs,
  activeTab,
  onChange,
  ariaLabel = "Sections",
  className = ""
}) {
  return (
    <nav
      className={`${styles.tabs} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      {tabs.map(({ id, label, Icon, badge, disabled = false }) => (
        <button
          key={id}
          type="button"
          className={activeTab === id ? styles.active : ""}
          onClick={() => onChange(id)}
          disabled={disabled}
          aria-current={activeTab === id ? "page" : undefined}
        >
          {Icon && <Icon className={styles.icon} aria-hidden="true" />}
          <span>{label}</span>
          {badge !== undefined && badge !== null && (
            <span className={styles.badge}>{badge}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

export default Tabs;
