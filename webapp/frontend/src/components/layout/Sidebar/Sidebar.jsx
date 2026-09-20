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
  onLogout
}) {

  const handleNavigate = (page) => {
    onNavigate(page);
  };

  return (
    <aside className={styles.sidebar}>

      <div className={styles.logo}>
        <img src={logo} alt="Leafy AI logo" />

        <span>Leafy AI</span>

      </div>

      <nav>
        <button
          className={
            activePage === "overview" ? styles.active : ""
          }
          type="button"
          onClick={() => handleNavigate("overview")}
        >
          <img src={overview} alt="" />
          <span>Overview</span>
        </button>

        <button
          className={activePage === "farm" ? styles.active : ""}
          type="button"
          onClick={() => handleNavigate("farm")}
        >
          <img src={farm} alt="" />
          <span>Farm</span>
        </button>

        <button
          className={
            activePage === "leafyAI" ? styles.active : ""
          }
          type="button"
          onClick={() => handleNavigate("leafyAI")}
        >
          <img src={leafyAI} alt="" />
          <span>Leafy AI</span>
        </button>

        <button
          className={
            activePage === "safety" ? styles.active : ""
          }
          type="button"
          onClick={() => handleNavigate("safety")}
        >
          <img src={safety} alt="" />
          <span>Safety</span>
        </button>

        <button
          className={activePage === "logs" ? styles.active : ""}
          type="button"
          onClick={() => handleNavigate("logs")}
        >
          <img src={logs} alt="" />
          <span>Logs</span>
        </button>

        <button
          className={
            activePage === "schedule" ? styles.active : ""
          }
          type="button"
          onClick={() => handleNavigate("schedule")}
        >
          <img src={schedule} alt="" />
          <span>Schedule</span>
        </button>
      </nav>

      <button
        className={styles.emergency}
        type="button"
      >
        <img src={emergency} alt="" />
        <span>Emergency</span>
      </button>

      <div className={styles.bottom}>
        <button
          className={
            activePage === "settings" ? styles.active : ""
          }
          type="button"
          onClick={() => handleNavigate("settings")}
        >
          <img src={settings} alt="" />
          <span>Setting</span>
        </button>

        <button
          type="button"
          onClick={onLogout}
        >
          <img src={logout} alt="" />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
