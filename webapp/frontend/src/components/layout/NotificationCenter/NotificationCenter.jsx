import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, ChevronDown, X } from "lucide-react";
import { getNotifications, markAllNotificationsRead, markNotificationRead, streamNotifications } from "../../../services/notificationApi";
import styles from "./NotificationCenter.module.css";

function NotificationCenter({ token, onTokenRefresh }) {
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const latestId = useRef(0);
  const pageSize = 30;

  async function load(reset = false) {
    if (!token || loading) return;
    setLoading(true);
    try {
      const nextOffset = reset ? 0 : offset;
      const data = await getNotifications(token, onTokenRefresh, { limit: pageSize, offset: nextOffset });
      const next = Array.isArray(data.notifications) ? data.notifications : [];
      setItems((current) => reset ? next : [...current, ...next.filter((item) => !current.some((old) => old.notification_id === item.notification_id))]);
      setUnreadCount(Number(data.unread_count || 0));
      setHasMore(next.length === pageSize);
      setOffset(nextOffset + next.length);
      if (next.length) latestId.current = Math.max(latestId.current, ...next.map((item) => Number(item.notification_id || 0)));
    } finally { setLoading(false); if (reset) setInitialized(true); }
  }

  useEffect(() => { setInitialized(false); setOffset(0); latestId.current = 0; load(true); }, [token]);

  useEffect(() => {
    if (!token || !initialized) return undefined;
    const controller = new AbortController();
    streamNotifications(token, onTokenRefresh, latestId.current, (item) => {
      latestId.current = Math.max(latestId.current, Number(item.notification_id || 0));
      setItems((current) => [item, ...current.filter((old) => old.notification_id !== item.notification_id)]);
      setUnreadCount((count) => count + 1);
      const toastId = `${item.notification_id}-${Date.now()}`;
      setToasts((current) => [{ ...item, toastId }, ...current].slice(0, 4));
      window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.toastId !== toastId)), 7000);
    }, controller.signal).catch((error) => {
      if (error.name !== "AbortError") console.error("Notification stream failed:", error);
    });
    return () => controller.abort();
  }, [token, onTokenRefresh, initialized]);

  const unreadIds = useMemo(() => new Set(items.filter((item) => item.unread).map((item) => item.notification_id)), [items]);

  async function readOne(item) {
    if (!item.unread) return;
    await markNotificationRead(token, onTokenRefresh, item.notification_id);
    setItems((current) => current.map((entry) => entry.notification_id === item.notification_id ? { ...entry, unread: false } : entry));
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  async function readAll() {
    await markAllNotificationsRead(token, onTokenRefresh);
    setItems((current) => current.map((item) => ({ ...item, unread: false })));
    setUnreadCount(0);
  }

  return (
    <>
      <div className={styles.center}>
        <button type="button" className={styles.bellButton} onClick={() => setOpen((value) => !value)} aria-label="Notifications">
          <Bell size={21} />
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
        </button>

        {open && (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div><strong>Notifications</strong><span>{unreadCount} unread</span></div>
              <div className={styles.headerActions}>
                {unreadCount > 0 && <button type="button" onClick={readAll}><CheckCheck size={15} /> Mark all read</button>}
                <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={17} /></button>
              </div>
            </div>
            <div className={styles.list}>
              {items.length === 0 && !loading ? <p className={styles.empty}>No notifications yet.</p> : items.map((item) => (
                <button key={item.notification_id} type="button" className={`${styles.item} ${unreadIds.has(item.notification_id) ? styles.unread : ""}`} onClick={() => readOne(item)}>
                  <span className={`${styles.severity} ${styles[String(item.severity || "INFO").toLowerCase()]}`}></span>
                  <span className={styles.copy}><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.created_at).toLocaleString()}</small></span>
                </button>
              ))}
              {hasMore && <button type="button" className={styles.loadMore} disabled={loading} onClick={() => load(false)}><ChevronDown size={16} /> {loading ? "Loading..." : "Load more"}</button>}
            </div>
          </section>
        )}
      </div>

      <div className={styles.toastStack} aria-live="polite">
        {toasts.map((item) => (
          <article key={item.toastId} className={styles.toast}>
            <span className={`${styles.severity} ${styles[String(item.severity || "INFO").toLowerCase()]}`}></span>
            <div><strong>{item.title}</strong><p>{item.message}</p></div>
            <button type="button" onClick={() => setToasts((current) => current.filter((toast) => toast.toastId !== item.toastId))}><X size={15} /></button>
          </article>
        ))}
      </div>
    </>
  );
}

export default NotificationCenter;
