import { useState } from "react";

import FarmCamera from "./FarmCamera";

import styles from "./FarmOverviewPanel.module.css";

function FarmOverviewPanel({
  data,
  loading = false,
  error = false,
  onGoToFarm
}) {
  const levels = Array.isArray(data?.levels)
    ? data.levels
    : [];

  const [selectedLevelId, setSelectedLevelId] = useState(null);

  const selectedLevel =
    levels.find((level) => level.id === selectedLevelId) ||
    levels[0] ||
    null;

  let levelState = "";

  if (loading) {
    levelState = "Loading farm levels...";
  } else if (error) {
    levelState = "Farm levels unavailable.";
  } else if (levels.length === 0) {
    levelState = "No farm levels available.";
  }

  return (
    <section className={styles.panel}>
      <h2>Farm Levels</h2>

      <div className={styles.content}>
        <FarmCamera
          levelName={selectedLevel?.name}
          status={
            selectedLevel?.camera?.status ||
            data?.camera?.status
          }
          loading={loading}
          error={error}
        />

        <div className={styles.overlay}>
          <div className={styles.levelList}>
            {levelState ? (
              <div className={styles.levelState}>
                {levelState}
              </div>
            ) : (
              levels.map((level) => {
                const alertCount =
                  Number.isFinite(level.alertCount)
                    ? level.alertCount
                    : null;

                const isSelected =
                  selectedLevel?.id === level.id;

                return (
                  <button
                    key={level.id || level.name}
                    type="button"
                    className={
                      isSelected
                        ? `${styles.level} ${styles.selectedLevel}`
                        : styles.level
                    }
                    onClick={() =>
                      setSelectedLevelId(level.id)
                    }
                    aria-pressed={isSelected}
                  >
                    <span>
                      {level.name || "Unnamed level"}
                    </span>

                    <strong>
                      {alertCount === null
                        ? "—"
                        : `${alertCount} ${
                            alertCount === 1
                              ? "Alert"
                              : "Alerts"
                          }`}
                    </strong>
                  </button>
                );
              })
            )}
          </div>

          {onGoToFarm && (
            <button
              type="button"
              className={styles.farmButton}
              onClick={onGoToFarm}
            >
              Go to Farm
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default FarmOverviewPanel;
