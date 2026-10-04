import { ChevronLeft, ChevronRight, UserCog } from "lucide-react";
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

function Sidebar({ activePage, onNavigate, onLogout, collapsed = false, onToggle, user, access, onEmergencyStop }) {
  const item = (page, label, icon) => (
    <button
      className={activePage === page ? styles.active : ""}
      type="button"
      onClick={() => onNavigate(page)}
      title={collapsed ? label : undefined}
    >
      {typeof icon === "string" ? <img src={icon} alt="" /> : icon}
      <span>{label}</span>
    </button>
  );

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.sidebarHeader}>
        <div className={styles.brand}><img src={logo} alt="Leafy AI logo" /><span>Leafy AI</span></div>
        <button className={styles.toggleButton} type="button" onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      <nav>
        {item("overview", "Overview", overview)}
        {item("farm", "Farm", farm)}
        {item("leafyAI", "Leafy AI", leafyAI)}
        {item("safety", "Safety", safety)}
        {item("logs", "Logs", logs)}
        {item("schedule", "Schedule", schedule)}
        {user?.role === "ADMIN" && item("admin", "Admin", <UserCog aria-hidden="true" />)}
      </nav>

      {access?.allowed?.EMERGENCY_STOP && (
        <button className={styles.emergency} type="button" onClick={onEmergencyStop} title={collapsed ? "Emergency Stop" : undefined}>
          <img src={emergency} alt="" /><span>Emergency Stop</span>
        </button>
      )}

      <div className={styles.bottom}>
        {item("settings", "Settings", settings)}
        <button type="button" onClick={onLogout} title={collapsed ? "Log out" : undefined}><img src={logout} alt="" /><span>Log out</span></button>
      </div>
    </aside>
  );
}

export default Sidebar;
