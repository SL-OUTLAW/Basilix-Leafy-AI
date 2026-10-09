import { useState } from "react";

import {
  setEcTarget,
  setFan,
  setIrrigation,
  setLighting,
  setPhTarget
} from "../../../services/farmApi";

import styles from "./ManualOverrideTab.module.css";

function ManualOverrideTab({
  data = null,
  loading = false,
  error = false,
  token,
  onTokenRefresh,
  user,
  access
}) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [phTarget, setPhTargetValue] = useState("");
  const [ecTarget, setEcTargetValue] = useState("");

  async function run(name, operation) {
    setBusy(name);
    setMessage("");

    try {
      await operation();
      setMessage(`${name} command completed.`);
    } catch (operationError) {
      setMessage(operationError.message || `${name} command failed.`);
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <section className={styles.override}>
        <h2>Manual Override</h2>
        <p>Loading farm control state...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.override}>
        <h2>Manual Override</h2>
        <p>Farm controls are unavailable.</p>
      </section>
    );
  }

  return (
    <section className={styles.override}>
      <h2>Manual Override</h2>
      <p>Commands are validated by the Engine safety layer.</p>

      <div className={styles.grid}>
        <div className={styles.controlCard}>
          <strong>Lighting Level 1</strong>
          <span>Current: {String(data?.lighting_level_1 ?? "Unknown")}</span>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={Boolean(busy) || !access?.allowed?.MANUAL_CONTROLS}
              onClick={() =>
                run("Lighting Level 1", () =>
                  setLighting(token, onTokenRefresh, 1, true)
                )
              }
            >
              On
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || !access?.allowed?.MANUAL_CONTROLS}
              onClick={() =>
                run("Lighting Level 1", () =>
                  setLighting(token, onTokenRefresh, 1, false)
                )
              }
            >
              Off
            </button>
          </div>
        </div>

        <div className={styles.controlCard}>
          <strong>Lighting Level 2</strong>
          <span>Current: {String(data?.lighting_level_2 ?? "Unknown")}</span>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={Boolean(busy) || !access?.allowed?.MANUAL_CONTROLS}
              onClick={() =>
                run("Lighting Level 2", () =>
                  setLighting(token, onTokenRefresh, 2, true)
                )
              }
            >
              On
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || !access?.allowed?.MANUAL_CONTROLS}
              onClick={() =>
                run("Lighting Level 2", () =>
                  setLighting(token, onTokenRefresh, 2, false)
                )
              }
            >
              Off
            </button>
          </div>
        </div>

        <div className={styles.controlCard}>
          <strong>Irrigation</strong>
          <span>Current: {String(data?.irrigation ?? "Unknown")}</span>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={Boolean(busy) || !access?.allowed?.MANUAL_CONTROLS}
              onClick={() =>
                run("Irrigation", () =>
                  setIrrigation(token, onTokenRefresh, true)
                )
              }
            >
              On
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || !access?.allowed?.MANUAL_CONTROLS}
              onClick={() =>
                run("Irrigation", () =>
                  setIrrigation(token, onTokenRefresh, false)
                )
              }
            >
              Off
            </button>
          </div>
        </div>

        <div className={styles.controlCard}>
          <strong>Fan</strong>
          <span>Current: {String(data?.fan ?? "Unknown")}</span>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={Boolean(busy) || !access?.allowed?.MANUAL_CONTROLS}
              onClick={() =>
                run("Fan", () =>
                  setFan(token, onTokenRefresh, true)
                )
              }
            >
              On
            </button>
            <button
              type="button"
              disabled={Boolean(busy) || !access?.allowed?.MANUAL_CONTROLS}
              onClick={() =>
                run("Fan", () =>
                  setFan(token, onTokenRefresh, false)
                )
              }
            >
              Off
            </button>
          </div>
        </div>
      </div>

      {access?.allowed?.DOSING_TARGETS && (
        <div className={styles.targets}>
          <label>
            pH target
            <input
              type="number"
              step="0.1"
              value={phTarget}
              onChange={(event) => setPhTargetValue(event.target.value)}
            />
            <button
              type="button"
              disabled={Boolean(busy) || phTarget === ""}
              onClick={() =>
                run("pH dosing", () =>
                  setPhTarget(token, onTokenRefresh, phTarget)
                )
              }
            >
              Apply
            </button>
          </label>

          <label>
            EC target
            <input
              type="number"
              step="1"
              value={ecTarget}
              onChange={(event) => setEcTargetValue(event.target.value)}
            />
            <button
              type="button"
              disabled={Boolean(busy) || ecTarget === ""}
              onClick={() =>
                run("EC dosing", () =>
                  setEcTarget(token, onTokenRefresh, ecTarget)
                )
              }
            >
              Apply
            </button>
          </label>
        </div>
      )}

      {message && <p className={styles.message}>{message}</p>}
    </section>
  );
}

export default ManualOverrideTab;
