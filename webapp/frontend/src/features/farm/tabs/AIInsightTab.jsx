import { Brain, CheckCircle2, CircleAlert } from "lucide-react";
import MarkdownContent from "../../../components/common/MarkdownContent/MarkdownContent";
import { getAIResultContent } from "../../../utils/aiResult";
import styles from "./AIInsightTab.module.css";

function AIInsightTab({ data = null, loading = false, error = false }) {
  const analyses = Array.isArray(data?.analyses) ? data.analyses : [];

  return (
    <section className={styles.insight}>
      <div className={styles.heading}>
        <div>
          <h2>Farm AI Analysis</h2>
          <p>
            Results from scheduled whole-farm Leafy AI analysis tasks. Recommendations
            created by Leafy AI are managed in Leafy AI → Recommendations.
          </p>
        </div>
        <Brain size={24} />
      </div>

      {loading ? (
        <p>Loading AI analysis results...</p>
      ) : error ? (
        <p>AI analysis data is unavailable.</p>
      ) : analyses.length === 0 ? (
        <p>No farm AI analysis has run yet.</p>
      ) : (
        <div className={styles.list}>
          {analyses.map((item) => {
            const content =
              getAIResultContent(item.result) ||
              item.error_message ||
              "The analysis completed without a text result.";

            return (
              <article key={item.execution_id} className={styles.item}>
                <div className={styles.itemHeader}>
                  <strong>{item.task_name || `Farm analysis #${item.execution_id}`}</strong>
                  <span>
                    {item.status === "COMPLETED" ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <CircleAlert size={15} />
                    )}
                    {item.status}
                  </span>
                </div>

                <div className={styles.analysisContent}>
                  <MarkdownContent value={content} />
                </div>

                <small>
                  {new Date(
                    item.completed_at || item.started_at || item.created_at
                  ).toLocaleString()}
                </small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default AIInsightTab;
