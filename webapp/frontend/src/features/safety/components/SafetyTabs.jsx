import {
  ShieldCheck,
  ListChecks,
  SlidersHorizontal
} from "lucide-react";

import styles from "./SafetyTabs.module.css";

const tabs = [
  {
    id: "overview",
    label: "Overview",
    Icon: ShieldCheck
  },
  {
    id: "approvals",
    label: "Approvals",
    Icon: ListChecks
  },
  {
    id: "configuration",
    label: "Configuration",
    Icon: SlidersHorizontal
  }
];

function SafetyTabs({
  activeTab,
  onChange
}) {
  return (
    <nav className={styles.tabs} aria-label="Safety sections">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={activeTab === id ? styles.active : ""}
          onClick={() => onChange(id)}
        >
          <Icon size={21} strokeWidth={1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export default SafetyTabs;
