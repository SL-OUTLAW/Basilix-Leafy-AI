import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "./components/layout/AppShell/AppShell";
import GoogleLogin from "./components/auth/GoogleLogin";
import Settings from "./components/settings/Settings";
import Overview from "./features/overview/Overview";
import Farm from "./features/farm/Farm";
import LeafyAI from "./features/leafyAI/LeafyAI";
import Safety from "./features/safety/Safety";
import Logs from "./features/logs/Logs";
import Schedule from "./features/schedule/Schedule";
import Admin from "./features/admin/Admin";
import { getCurrentUser, refreshSession, logout } from "./services/authApi";
import { getOverviewData, mergeOverviewSensorSnapshot } from "./services/overviewApi";
import { getFarmData, mergeFarmSensorSnapshot } from "./services/farmApi";
import { getLeafyAiData } from "./services/leafyAiApi";
import { getSafetyData, getSafetyState, activateEmergencyStop, clearEmergencyStop } from "./services/safetyApi";
import { getLogsData } from "./services/logsApi";
import { getMyAccess } from "./services/adminApi";
import { streamSensors } from "./services/sensorStream";

const pages = {
  overview: { title: "System Overview", subtitle: "Real-time summary of your farm" },
  farm: { title: "Farm Management", subtitle: "Monitor the farm and control equipment" },
  leafyAI: { title: "Leafy AI", subtitle: "Review recommendations and system activity" },
  safety: { title: "Safety Management", subtitle: "Manage AI, approvals, emergency controls and safety" },
  logs: { title: "Audit Logs", subtitle: "Track and review system activities" },
  schedule: { title: "Task Schedule", subtitle: "Manage scheduled tasks and execution history" },
  settings: { title: "Settings", subtitle: "Configure Leafy AI and farm system settings" },
  admin: { title: "Administration", subtitle: "Manage users, roles and feature access" }
};

const pathToPage = {
  "/": "overview",
  "/overview": "overview",
  "/farm": "farm",
  "/leafy-ai": "leafyAI",
  "/safety": "safety",
  "/logs": "logs",
  "/schedule": "schedule",
  "/settings": "settings",
  "/admin": "admin"
};

const pageToPath = {
  overview: "/overview",
  farm: "/farm",
  leafyAI: "/leafy-ai",
  safety: "/safety",
  logs: "/logs",
  schedule: "/schedule",
  settings: "/settings",
  admin: "/admin"
};

function emptyPageState() {
  return { data: null, loading: false, error: "" };
}

function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const activePage = pathToPage[pathname] || "overview";
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [access, setAccess] = useState(null);
  const [globalSafety, setGlobalSafety] = useState(null);
  const [overview, setOverview] = useState(emptyPageState);
  const [farm, setFarm] = useState(emptyPageState);
  const [leafyAI, setLeafyAI] = useState(emptyPageState);
  const [safety, setSafety] = useState(emptyPageState);
  const [logs, setLogs] = useState(emptyPageState);

  const handleTokenRefresh = useCallback((nextToken) => setToken(nextToken), []);
  const navigatePath = useCallback((path, replace = false) => {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    setPathname(path);
  }, []);
  const handleNavigate = useCallback((page) => navigatePath(pageToPath[page] || "/overview"), [navigatePath]);

  useEffect(() => {
    const onPopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!authChecked || !user) return;
    if (!pathToPage[pathname] || (pathToPage[pathname] === "admin" && user.role !== "ADMIN")) {
      navigatePath("/overview", true);
    }
  }, [authChecked, user, pathname, navigatePath]);

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
        if (!cancelled) { setToken(refreshed.token); setUser(data.user); }
      } catch {
        if (!cancelled) { setToken(""); setUser(null); }
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }
    checkAuthentication();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    async function loadGlobalState() {
      try {
        const [accessData, safetyData] = await Promise.all([
          getMyAccess(token, handleTokenRefresh),
          getSafetyState(token, handleTokenRefresh)
        ]);
        if (active) {
          setAccess(accessData);
          setGlobalSafety(safetyData.safety || {});
        }
      } catch (error) {
        console.error("Global state refresh failed:", error);
      }
    }
    loadGlobalState();
    const timer = window.setInterval(loadGlobalState, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, handleTokenRefresh]);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    streamSensors(token, handleTokenRefresh, (payload) => {
      setFarm((current) => current.data ? { ...current, data: mergeFarmSensorSnapshot(current.data, payload) } : current);
      setOverview((current) => current.data ? { ...current, data: mergeOverviewSensorSnapshot(current.data, payload) } : current);
    }, controller.signal).catch((error) => {
      if (error.name !== "AbortError") console.error("Sensor stream failed:", error);
    });
    return () => controller.abort();
  }, [token, handleTokenRefresh]);

  useEffect(() => {
    if (!token) return;
    const loaders = {
      overview: { load: getOverviewData, set: setOverview },
      farm: { load: getFarmData, set: setFarm },
      leafyAI: { load: getLeafyAiData, set: setLeafyAI },
      safety: { load: getSafetyData, set: setSafety },
      logs: { load: getLogsData, set: setLogs }
    };
    const selected = loaders[activePage];
    if (!selected) return;
    let cancelled = false;
    async function loadPage() {
      selected.set((current) => ({ ...current, loading: true, error: "" }));
      try {
        const data = await selected.load(token, handleTokenRefresh);
        if (!cancelled) selected.set({ data, loading: false, error: "" });
      } catch (error) {
        if (!cancelled) selected.set({ data: null, loading: false, error: error.message || `Unable to load ${activePage} data.` });
      }
    }
    loadPage();
    return () => { cancelled = true; };
  }, [token, activePage, handleTokenRefresh]);

  const handleLogin = useCallback((data) => { setToken(data.token); setUser(data.user); setAuthChecked(true); navigatePath("/overview", true); }, [navigatePath]);
  const handleLogout = useCallback(async () => {
    try { await logout(); } catch {}
    setToken(""); setUser(null); setAccess(null); setGlobalSafety(null);
    setOverview(emptyPageState()); setFarm(emptyPageState()); setLeafyAI(emptyPageState()); setSafety(emptyPageState()); setLogs(emptyPageState());
    navigatePath("/overview", true);
  }, [navigatePath]);

  async function handleEmergencyStop() {
    if (!window.confirm("Activate emergency stop? Farm automation will be stopped.")) return;
    try {
      const result = await activateEmergencyStop(token, handleTokenRefresh);
      setGlobalSafety(result.safety || { ...globalSafety, emergency_stop: true, ai_enabled: false });
    } catch (error) { window.alert(error.message || "Unable to activate emergency stop"); }
  }

  async function handleClearEmergency() {
    if (!window.confirm("Clear emergency stop and allow farm operation to resume?")) return;
    try {
      const result = await clearEmergencyStop(token, handleTokenRefresh);
      setGlobalSafety(result.safety || { ...globalSafety, emergency_stop: false, ai_enabled: false });
    } catch (error) { window.alert(error.message || "Unable to clear emergency stop"); }
  }

  if (!authChecked) return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "var(--color-bg-main)", color: "var(--color-text-muted)" }}>Checking sign in...</main>;
  if (!token || !user) return <GoogleLogin onLogin={handleLogin} />;

  const currentPage = pages[activePage];

  return (
    <AppShell
      activePage={activePage}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      title={currentPage.title}
      subtitle={currentPage.subtitle}
      user={user}
      safetyState={globalSafety}
      access={access}
      onEmergencyStop={handleEmergencyStop}
      onClearEmergency={handleClearEmergency}
    >
      {activePage === "overview" ? (
        <Overview data={overview.data} loading={overview.loading} error={overview.error} onGoToFarm={() => handleNavigate("farm")} onViewNotifications={() => handleNavigate("logs")} />
      ) : activePage === "farm" ? (
        <Farm data={farm.data} loading={farm.loading} error={farm.error} token={token} onTokenRefresh={handleTokenRefresh} user={user} access={access} />
      ) : activePage === "leafyAI" ? (
        <LeafyAI data={leafyAI.data} loading={leafyAI.loading} error={leafyAI.error} />
      ) : activePage === "safety" ? (
        <Safety data={safety.data} loading={safety.loading} error={safety.error} token={token} onTokenRefresh={handleTokenRefresh} user={user} access={access} onDataChange={(data) => { setSafety({ data, loading: false, error: "" }); setGlobalSafety(data?.state || globalSafety); }} />
      ) : activePage === "logs" ? (
        <Logs data={logs.data} loading={logs.loading} error={logs.error} />
      ) : activePage === "schedule" ? (
        <Schedule token={token} onTokenRefresh={handleTokenRefresh} access={access} />
      ) : activePage === "admin" ? (
        <Admin token={token} onTokenRefresh={handleTokenRefresh} currentUser={user} />
      ) : (
        <Settings theme={theme} setTheme={setTheme} token={token} onTokenRefresh={handleTokenRefresh} user={user} access={access} />
      )}
    </AppShell>
  );
}

export default App;
