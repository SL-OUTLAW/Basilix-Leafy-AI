import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./Sidebar.module.css";

import logo from "../../../assets/sidebar/leafy-ai-logo.png";
import overview from "../../../assets/sidebar/overview.svg";
import farm from "../../../assets/sidebar/farm.svg";
import leafyAI from "../../../assets/sidebar/leafy-ai-brain.svg";
import safety from "../../../assets/sidebar/safety.svg";
import logs from "../../../assets/sidebar/logs.svg";
import schedule from "../../../assets/sidebar/schedule.svg";
import emergency from "../../../assets/sidebar/emergency.svg";
import settings from "../../../assets/sidebar/settings.svg";
import logout from "../../../assets/sidebar/logout.svg";

function Sidebar({
  activePage,
  onNavigate,
  onLogout,
  collapsed = false,
  onToggle
}) {
  return (
    <aside
      className={`${styles.sidebar} ${
        collapsed ? styles.collapsed : ""
      }`}
    >
      <div className={styles.sidebarHeader}>
        <div className={styles.brand}>
          <img src={logo} alt="Leafy AI logo" />
          <span>Leafy AI</span>
        </div>

        <button
          className={styles.toggleButton}
          type="button"
          onClick={onToggle}
          aria-label={
            collapsed ? "Expand sidebar" : "Collapse sidebar"
          }
          title={
            collapsed ? "Expand sidebar" : "Collapse sidebar"
          }
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" />
          ) : (
            <ChevronLeft aria-hidden="true" />
          )}
        </button>
      </div>

      <nav>
        <button
          className={activePage === "overview" ? styles.active : ""}
          type="button"
          onClick={() => onNavigate("overview")}
          title={collapsed ? "Overview" : undefined}
        >
          <img src={overview} alt="" />
          <span>Overview</span>
        </button>

        <button
          className={activePage === "farm" ? styles.active : ""}
          type="button"
          onClick={() => onNavigate("farm")}
          title={collapsed ? "Farm" : undefined}
        >
          <img src={farm} alt="" />
          <span>Farm</span>
        </button>

        <button
          className={activePage === "leafyAI" ? styles.active : ""}
          type="button"
          onClick={() => onNavigate("leafyAI")}
          title={collapsed ? "Leafy AI" : undefined}
        >
          <img src={leafyAI} alt="" />
          <span>Leafy AI</span>
        </button>

        <button
          className={activePage === "safety" ? styles.active : ""}
          type="button"
          onClick={() => onNavigate("safety")}
          title={collapsed ? "Safety" : undefined}
        >
          <img src={safety} alt="" />
          <span>Safety</span>
        </button>

        <button
          className={activePage === "logs" ? styles.active : ""}
          type="button"
          onClick={() => onNavigate("logs")}
          title={collapsed ? "Logs" : undefined}
        >
          <img src={logs} alt="" />
          <span>Logs</span>
        </button>

        <button
          className={activePage === "schedule" ? styles.active : ""}
          type="button"
          onClick={() => onNavigate("schedule")}
          title={collapsed ? "Schedule" : undefined}
        >
          <img src={schedule} alt="" />
          <span>Schedule</span>
        </button>
      </nav>

      <button
        className={styles.emergency}
        type="button"
        title={collapsed ? "Emergency" : undefined}
      >
        <img src={emergency} alt="" />
        <span>Emergency</span>
      </button>

      <div className={styles.bottom}>
        <button
          className={activePage === "settings" ? styles.active : ""}
          type="button"
          onClick={() => onNavigate("settings")}
          title={collapsed ? "Setting" : undefined}
        >
          <img src={settings} alt="" />
          <span>Setting</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? "Log out" : undefined}
        >
          <img src={logout} alt="" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
