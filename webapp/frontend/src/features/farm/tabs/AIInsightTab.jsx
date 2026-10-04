import { BrainCircuit, CheckCircle2, CircleAlert } from "lucide-react";
import styles from "./AIInsightTab.module.css";

function extractContent(result) {
  return result?.content || result?.result?.content || result?.response?.content || (typeof result === "string" ? result : null);
}

function AIInsightTab({ data = null, loading = false, error = false }) {
  const analyses = Array.isArray(data?.analyses) ? data.analyses : [];
  return (
    <section className={styles.insight}>
      <div className={styles.heading}><div><h2>Farm AI Analysis</h2><p>Results from scheduled whole-farm Leafy AI analysis tasks. Recommendations created by Leafy AI are managed in the Leafy AI → Recommendations screen.</p></div><BrainCircuit size={24}/></div>
      {loading ? <p>Loading AI analysis results...</p> : error ? <p>AI analysis data is unavailable.</p> : analyses.length === 0 ? <p>No farm AI analysis has run yet.</p> : (
        <div className={styles.list}>{analyses.map((item) => (
          <article key={item.execution_id} className={styles.item}>
            <div className={styles.itemHeader}><strong>{item.task_name || `Farm analysis #${item.execution_id}`}</strong><span>{item.status === "COMPLETED" ? <CheckCircle2 size={15}/> : <CircleAlert size={15}/>} {item.status}</span></div>
            <p>{extractContent(item.result) || item.error_message || "The analysis completed without a text result."}</p>
            <small>{new Date(item.completed_at || item.started_at || item.created_at).toLocaleString()}</small>
          </article>
        ))}</div>
      )}
    </section>
  );
}
export default AIInsightTab;
