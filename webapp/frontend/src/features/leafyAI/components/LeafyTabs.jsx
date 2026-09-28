import styles from "./LeafyTabs.module.css";

function LeafyTabs({ activeTab, onChange }) {
  return (
    <nav className={styles.tabs} aria-label="Leafy AI sections">
      <button
        type="button"
        className={activeTab === "overview" ? styles.active : ""}
        onClick={() => onChange("overview")}
      >
        Overview
      </button>

      <button
        type="button"
        className={
          activeTab === "recommendations" ? styles.active : ""
        }
        onClick={() => onChange("recommendations")}
      >
        Recommendations
      </button>

      <button
        type="button"
        className={activeTab === "activity" ? styles.active : ""}
        onClick={() => onChange("activity")}
      >
        Activity
      </button>
    </nav>
  );
}

export default LeafyTabs;