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
  return (
    <div className={styles.layout}>
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        onLogout={onLogout}
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