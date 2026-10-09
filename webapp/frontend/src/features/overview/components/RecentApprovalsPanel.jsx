import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import ActionIcon from "../../../components/common/ActionIcon/ActionIcon";
import styles from "./RecentApprovalsPanel.module.css";

function RecentApprovalsPanel({ approvals = [], loading = false, error = false, onOpenSafety }) {
  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div><h2>Recent Approvals</h2><p>Latest approval decisions and pending requests.</p></div>
        {onOpenSafety && <button type="button" onClick={onOpenSafety}>Open Safety</button>}
      </div>
      {loading ? <p className={styles.empty}>Loading approvals...</p> : error ? <p className={styles.empty}>Approvals unavailable.</p> : approvals.length === 0 ? <p className={styles.empty}>No recent approvals.</p> : (
        <div className={styles.list}>{approvals.slice(0, 6).map((item) => (
          <article key={item.id} className={styles.row}>
            <ActionIcon type={item.action} size={18} />
            <div><strong>{item.label}</strong><span>{item.time}</span></div>
            <span className={styles.status}>{item.status === "APPROVED" ? <CheckCircle2 size={15}/> : item.status === "REJECTED" ? <XCircle size={15}/> : <Clock3 size={15}/>} {item.status}</span>
          </article>
        ))}</div>
      )}
    </section>
  );
}
export default RecentApprovalsPanel;
