import { useCallback, useEffect, useState } from "react";

import AppShell from "./components/layout/AppShell/AppShell";
import GoogleLogin from "./components/auth/GoogleLogin";
import Settings from "./components/settings/Settings";

import Overview from "./features/overview/Overview";
import Farm from "./features/farm/Farm";

import {
  getCurrentUser,
  refreshSession,
  logout
} from "./services/authApi";

import { getOverviewData } from "./services/overviewApi";

const pages = {
  overview: {
    title: "System Overview",
    subtitle: "Real-time summary of your farm"
  },
  farm: {
    title: "Farm Management",
    subtitle: "Manage farm"
  },
  leafyAI: {
    title: "Leafy AI",
    subtitle:
      "Ask questions, review recommendations, and see the reasoning behind them",
    placeholder: "Leafy AI content will go here."
  },
  safety: {
    title: "Safety Management",
    subtitle: "Manage AI, Farm and Tasks Safety",
    placeholder: "Safety content will go here."
  },
  logs: {
    title: "Audit Logs",
    subtitle: "Track and review system activities",
    placeholder: "Audit Logs content will go here."
  },
  schedule: {
    title: "Task Schedule",
    subtitle: "Manage scheduled tasks",
    placeholder: "Schedule content will go here."
  },
  settings: {
    title: "Settings",
    subtitle: "",
    placeholder: "Settings content will go here."
  }
};

function App() {
  const [activePage, setActivePage] = useState("overview");

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    async function checkAuthentication() {
      try {
        const refreshed = await refreshSession();
        const data = await getCurrentUser(refreshed.token);

        if (!cancelled) {
          setToken(refreshed.token);
          setUser(data.user);
        }
      } catch {
        if (!cancelled) {
          setToken("");
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthChecked(true);
        }
      }
    }

    checkAuthentication();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!token || activePage !== "overview") {
      return;
    }

    let cancelled = false;

    async function loadOverview() {
      setOverviewLoading(true);
      setOverviewError("");

      try {
        const data = await getOverviewData(token);

        if (!cancelled) {
          setOverviewData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setOverviewData(null);
          setOverviewError(
            error.message || "Unable to load overview data."
          );
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, [token, activePage]);

  const handleLogin = useCallback((data) => {
    setToken(data.token);
    setUser(data.user);
    setAuthChecked(true);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
    }

    setToken("");
    setUser(null);
    setActivePage("overview");
  }, []);

  if (!authChecked) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--color-bg-main)",
          color: "var(--color-text-muted)"
        }}
      >
        Checking sign in...
      </main>
    );
  }

  if (!token || !user) {
    return <GoogleLogin onLogin={handleLogin} />;
  }

  const currentPage = pages[activePage];

  return (
    <AppShell
      activePage={activePage}
      onNavigate={setActivePage}
      onLogout={handleLogout}
      title={currentPage.title}
      subtitle={currentPage.subtitle}
    >
      {activePage === "overview" ? (
        <Overview
          data={overviewData}
          loading={overviewLoading}
          error={overviewError}
          onGoToFarm={() => setActivePage("farm")}
        />
      ) : activePage === "farm" ? (
        <Farm
          data={null}
          loading={false}
          error=""
        />
      ) : activePage === "settings" ? (
        <Settings
          theme={theme}
          setTheme={setTheme}
        />
      ) : (
        <p>{currentPage.placeholder}</p>
      )}
    </AppShell>
  );
}

export default App;
