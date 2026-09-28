import { useState } from "react";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";

import ExpandModal from "./ExpandModal";
import styles from "./CameraCard.module.css";

function CameraCard({
  data = null,
  levels = [],
  loading = false,
  error = false
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState(null);

  const farmLevels = Array.isArray(levels)
    ? levels
    : [];

  const selectedIndex = Math.max(
    0,
    farmLevels.findIndex(
      (level) => level.id === selectedLevelId
    )
  );

  const selectedLevel =
    farmLevels[selectedIndex] || null;

  const cameraStatus =
    selectedLevel?.camera?.status ||
    data?.status ||
    "";

  let cameraMessage = "Camera feed unavailable";

  if (loading) {
    cameraMessage = "Loading camera status...";
  } else if (error) {
    cameraMessage = "Camera unavailable";
  } else if (cameraStatus === "connecting") {
    cameraMessage = "Connecting to camera...";
  } else if (cameraStatus === "offline") {
    cameraMessage = "Camera offline";
  }

  const selectLevel = (index) => {
    const level = farmLevels[index];

    if (level) {
      setSelectedLevelId(level.id);
    }
  };

  const canGoBack = selectedIndex > 0;

  const canGoForward =
    selectedIndex < farmLevels.length - 1;

  return (
    <>
      <section className={styles.card}>
        <div className={styles.header}>
          <h2>Camera</h2>

          <button
            className={styles.expandButton}
            type="button"
            aria-label="Expand camera"
            onClick={() => setIsExpanded(true)}
          >
            <Expand aria-hidden="true" />
          </button>
        </div>

        <div className={styles.cameraArea}>
          <span>{cameraMessage}</span>
        </div>

        <div className={styles.controls}>
          <span className={styles.count}>
            {farmLevels.length
              ? `${selectedIndex + 1} / ${farmLevels.length}`
              : "— / —"}
          </span>

          <div className={styles.levelControls}>
            <button
              type="button"
              disabled={!canGoBack}
              onClick={() =>
                selectLevel(selectedIndex - 1)
              }
            >
              <ChevronLeft aria-hidden="true" />
            </button>

            <span>
              {selectedLevel?.name || "Farm Level —"}
            </span>

            <button
              type="button"
              disabled={!canGoForward}
              onClick={() =>
                selectLevel(selectedIndex + 1)
              }
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {isExpanded && (
        <ExpandModal
          title="Camera"
          onClose={() => setIsExpanded(false)}
          fullScreen
        >
          <div className={styles.expandedCamera}>
            {cameraMessage}
          </div>
        </ExpandModal>
      )}
    </>
  );
}

export default CameraCard;