import { useState } from "react";
import { AlertTriangle, BotOff } from "lucide-react";
import Sidebar from "../Sidebar/Sidebar";
import Header from "../Header/Header";
import MobileNav from "../MobileNav/MobileNav";
import styles from "./AppShell.module.css";

function AppShell({
  children,
  activePage,
  onNavigate,
  onLogout,
  title,
  subtitle,
  user,
  safetyState,
  access,
  onClearEmergency,
  onEmergencyStop,
  token,
  onTokenRefresh
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const emergency = Boolean(safetyState?.emergency_stop);
  const aiDisabled = safetyState && safetyState.ai_enabled === false;

  return (
    <div className={`${styles.layout} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}>
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        user={user}
        access={access}
        onEmergencyStop={onEmergencyStop}
      />

      <div className={styles.main}>
        <Header
          title={title}
          subtitle={subtitle}
          profileImage={user?.avatar_url}
          profileName={user?.full_name || user?.email || "User"}
          token={token}
          onTokenRefresh={onTokenRefresh}
        />

        {aiDisabled && !emergency && (
          <button
            type="button"
            className={styles.aiWarning}
            onClick={() => onNavigate("safety")}
          >
            <BotOff size={17} />
            AI is disabled. Open Safety to enable Leafy AI.
          </button>
        )}

        <main className={styles.content}>{children}</main>
      </div>

      <MobileNav
        activePage={activePage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        user={user}
        access={access}
        onEmergencyStop={onEmergencyStop}
      />

      {emergency && (
        <div className={styles.emergencyOverlay} role="alert" aria-live="assertive">
          <AlertTriangle size={58} />
          <h1>EMERGENCY STOP ACTIVE</h1>
          <p>Farm automation and protected actions are stopped. Resolve the cause before clearing emergency mode.</p>
          <div className={styles.emergencyActions}>
            {access?.allowed?.CLEAR_EMERGENCY_STOP ? (
              <button type="button" onClick={onClearEmergency}>Clear Emergency Stop</button>
            ) : (
              <span>An authorised user must clear emergency mode.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AppShell;
