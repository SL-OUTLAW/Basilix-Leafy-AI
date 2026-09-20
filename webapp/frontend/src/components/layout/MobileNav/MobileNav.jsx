import { useState } from "react";
import styles from "./MobileNav.module.css";

import overview from "../../../assets/sidebar/overview.svg";
import farm from "../../../assets/sidebar/farm.svg";
import leafyAI from "../../../assets/sidebar/leafy-ai-brain.svg";
import safety from "../../../assets/sidebar/safety.svg";
import logs from "../../../assets/sidebar/logs.svg";
import schedule from "../../../assets/sidebar/schedule.svg";
import emergency from "../../../assets/sidebar/emergency.svg";
import settings from "../../../assets/sidebar/settings.svg";
import logout from "../../../assets/sidebar/logout.svg";

function MobileNav({
  activePage,
  onNavigate,
  onLogout
}) {
  const [moreOpen, setMoreOpen] = useState(false);

  const handleNavigate = (page) => {
    onNavigate(page);
    setMoreOpen(false);
  };

  const moreActive =
    activePage === "logs" ||
    activePage === "schedule" ||
    activePage === "settings";

  return (
    <>
      {moreOpen && (
        <div className={styles.moreMenu}>
          <button
            type="button"
            onClick={() => handleNavigate("logs")}
          >
            <img src={logs} alt="" />
            Logs
          </button>

          <button
            type="button"
            onClick={() => handleNavigate("schedule")}
          >
            <img src={schedule} alt="" />
            Schedule
          </button>

          <button
            className={styles.emergency}
            type="button"
          >
            <img src={emergency} alt="" />
            Emergency
          </button>

          <button
            type="button"
            onClick={() => handleNavigate("settings")}
          >
            <img src={settings} alt="" />
            Setting
          </button>

          <button
            type="button"
            onClick={onLogout}
          >
            <img src={logout} alt="" />
            Log out
          </button>
        </div>
      )}

      <nav className={styles.mobileNav}>
        <button
          className={
            activePage === "overview" && !moreOpen ? styles.active : ""
          }
          type="button"
          onClick={() => handleNavigate("overview")}
        >
          <img src={overview} alt="" />
          <span>Overview</span>
        </button>

        <button
          className={
            activePage === "farm" && !moreOpen ? styles.active : ""
          }
          type="button"
          onClick={() => handleNavigate("farm")}
        >
          <img src={farm} alt="" />
          <span>Farm</span>
        </button>

        <button
          className={
            activePage === "leafyAI" && !moreOpen ? styles.active : ""
          }
          type="button"
          onClick={() => handleNavigate("leafyAI")}
        >
          <img src={leafyAI} alt="" />
          <span>Leafy AI</span>
        </button>

        <button
          className={
            activePage === "safety" && !moreOpen ? styles.active : ""
          }
          type="button"
          onClick={() => handleNavigate("safety")}
        >
          <img src={safety} alt="" />
          <span>Safety</span>
        </button>

        <button
          className={
            moreOpen || moreActive ? styles.active : ""
          }
          type="button"
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <span className={styles.moreIcon}>☰</span>
          <span>More</span>
        </button>
      </nav>
    </>
  );
}

export default MobileNav;