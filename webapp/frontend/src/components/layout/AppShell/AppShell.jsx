import { useState } from "react";

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
  subtitle
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className={`${styles.layout} ${
        sidebarCollapsed ? styles.sidebarCollapsed : ""
      }`}
    >
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />

      <div className={styles.main}>
        <Header
          title={title}
          subtitle={subtitle}
        />

        <main className={styles.content}>
          {children}
        </main>
      </div>

      <MobileNav
        activePage={activePage}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />
    </div>
  );
}

export default AppShell;
