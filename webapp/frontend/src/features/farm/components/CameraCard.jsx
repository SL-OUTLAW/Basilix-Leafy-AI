import { ChevronLeft, ChevronRight, Expand } from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import Modal from "../../../components/common/Modal/Modal";
import styles from "./CameraCard.module.css";

function CameraCard({
  title,
  level,
  cameras = [],
  loading = false,
  error = false,
}) {
  const [cameraIndex, setCameraIndex] = useState(0);

  const [expanded, setExpanded] = useState(false);

  const levelCameras = useMemo(
    () =>
      cameras
        .filter((camera) => Number(camera.level_no) === Number(level))
        .sort((a, b) => Number(a.camera_id) - Number(b.camera_id)),
    [cameras, level],
  );

  useEffect(() => {
    setCameraIndex((current) => {
      if (current >= levelCameras.length) {
        return 0;
      }

      return current;
    });
  }, [levelCameras.length]);

  const selectedCamera = levelCameras[cameraIndex] ?? null;

  const imageUrl =
    selectedCamera?.image_url ??
    selectedCamera?.latest_image_url ??
    selectedCamera?.latest_image ??
    selectedCamera?.url ??
    null;

  const cameraName =
    selectedCamera?.camera_name ??
    selectedCamera?.name ??
    `Camera ${cameraIndex + 1}`;

  const previousCamera = () => {
    if (levelCameras.length <= 1) {
      return;
    }

    setCameraIndex((current) =>
      current === 0 ? levelCameras.length - 1 : current - 1,
    );
  };

  const nextCamera = () => {
    if (levelCameras.length <= 1) {
      return;
    }

    setCameraIndex((current) =>
      current === levelCameras.length - 1 ? 0 : current + 1,
    );
  };

  const cameraContent = (
    <>
      {loading ? (
        <div className={styles.message}>Loading latest image...</div>
      ) : error ? (
        <div className={styles.message}>Camera data unavailable.</div>
      ) : !selectedCamera ? (
        <div className={styles.message}>
          No active camera configured for Level {level}.
        </div>
      ) : !imageUrl ? (
        <div className={styles.message}>
          No image available for this camera.
        </div>
      ) : (
        <img
          className={styles.cameraImage}
          src={imageUrl}
          alt={`Latest image from ${cameraName}`}
        />
      )}
    </>
  );

  return (
    <>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h2>{title}</h2>

            <p>Latest captured farm image</p>
          </div>

          <button
            type="button"
            className={styles.expandButton}
            onClick={() => setExpanded(true)}
            disabled={!imageUrl}
            aria-label={`Expand ${title}`}
          >
            <Expand />
          </button>
        </div>

        <div className={styles.cameraArea}>{cameraContent}</div>

        <div className={styles.controls}>
          <span className={styles.count}>
            {levelCameras.length > 0
              ? `${cameraIndex + 1}/${levelCameras.length}`
              : "0/0"}
          </span>

          <div className={styles.cameraControls}>
            <button
              type="button"
              onClick={previousCamera}
              disabled={levelCameras.length <= 1}
              aria-label="Previous camera"
            >
              <ChevronLeft />
            </button>

            <span>{selectedCamera ? cameraName : `Level ${level}`}</span>

            <button
              type="button"
              onClick={nextCamera}
              disabled={levelCameras.length <= 1}
              aria-label="Next camera"
            >
              <ChevronRight />
            </button>
          </div>
        </div>
      </section>

      {expanded && imageUrl && (
        <Modal
          title={`${title} - ${cameraName}`}
          onClose={() => setExpanded(false)}
          size="fullscreen"
        >
          <div className={styles.expandedCamera}>
            <img
              className={styles.expandedImage}
              src={imageUrl}
              alt={`Expanded view from ${cameraName}`}
            />
          </div>
        </Modal>
      )}
    </>
  );
}

export default CameraCard;
