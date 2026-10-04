import { useEffect, useState } from "react";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";

import { getCameraImageBlob } from "../../../services/farmApi";
import ExpandModal from "./ExpandModal";
import styles from "./CameraCard.module.css";

function CameraCard({
  data = null,
  levels = [],
  loading = false,
  error = false,
  token,
  onTokenRefresh
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageError, setImageError] = useState(false);

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

  const cameraId = selectedLevel?.camera?.id;

  useEffect(() => {
    if (!selectedLevelId && farmLevels[0]?.id) {
      setSelectedLevelId(farmLevels[0].id);
    }
  }, [farmLevels, selectedLevelId]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    setImageUrl("");
    setImageError(false);

    if (!cameraId || !token) {
      return undefined;
    }

    getCameraImageBlob(cameraId, token, onTokenRefresh)
      .then((blob) => {
        if (!active) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (active) {
          setImageError(true);
        }
      });

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [cameraId, token, onTokenRefresh]);

  const cameraStatus =
    selectedLevel?.camera?.status ||
    data?.status ||
    "";

  let cameraMessage = "Latest image unavailable";

  if (loading) {
    cameraMessage = "Loading camera status...";
  } else if (error || imageError) {
    cameraMessage = "Camera image unavailable";
  } else if (cameraStatus === "connecting") {
    cameraMessage = "Waiting for latest camera image...";
  } else if (cameraStatus === "offline") {
    cameraMessage = "Camera offline";
  } else if (!imageUrl) {
    cameraMessage = "Loading latest image...";
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

  const renderCamera = () => {
    if (imageUrl && !loading && !error && !imageError) {
      return (
        <img
          className={styles.cameraImage}
          src={imageUrl}
          alt={`${selectedLevel?.name || "Farm"} latest camera capture`}
        />
      );
    }

    return <span>{cameraMessage}</span>;
  };

  return (
    <>
      <section className={styles.card}>
        <div className={styles.header}>
          <h2>Latest Farm Image</h2>

          <button
            className={styles.expandButton}
            type="button"
            aria-label="Expand latest farm image"
            onClick={() => setIsExpanded(true)}
          >
            <Expand aria-hidden="true" />
          </button>
        </div>

        <div className={styles.cameraArea}>
          {renderCamera()}
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
          title="Latest Farm Image"
          onClose={() => setIsExpanded(false)}
          fullScreen
        >
          <div className={styles.expandedCamera}>
            {renderCamera()}
          </div>
        </ExpandModal>
      )}
    </>
  );
}

export default CameraCard;
