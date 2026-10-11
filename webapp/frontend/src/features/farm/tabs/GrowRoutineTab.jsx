import { useEffect, useState } from "react";

import {
  CheckCircle2,
  ChevronRight,
  Pencil,
  Plus,
  Save,
  Scale,
  Trash2,
  X,
} from "lucide-react";

import {
  completeGrowCycle,
  createGrowCycle,
  deleteGrowCycle,
  getGrowCycleHarvests,
  recordHarvest,
  updateGrowCycle,
} from "../../../services/growCycleApi";

import { formatDateTime } from "../../../utils/formatters";

import styles from "./GrowRoutineTab.module.css";

function GrowRoutineTab({
  data = null,
  loading = false,
  error = false,
  token,
  onTokenRefresh,
  onRefresh,
  access,
}) {
  const [activeCycle, setActiveCycle] = useState(data?.activeCycle || null);

  const [cycleName, setCycleName] = useState("");

  const [cycleNotes, setCycleNotes] = useState("");

  const [weight, setWeight] = useState("");

  const [quality, setQuality] = useState("");

  const [harvestNotes, setHarvestNotes] = useState("");

  const [message, setMessage] = useState("");

  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);

  const [editName, setEditName] = useState("");

  const [editNotes, setEditNotes] = useState("");

  const [selectedCycleId, setSelectedCycleId] = useState(null);

  const [harvestRecords, setHarvestRecords] = useState([]);

  const [harvestRecordsLoading, setHarvestRecordsLoading] = useState(false);

  const [harvestRecordsError, setHarvestRecordsError] = useState("");

  const cycles = Array.isArray(data?.history?.grow_cycles)
    ? data.history.grow_cycles
    : [];

  const canManage = Boolean(access?.allowed?.GROW_CYCLE_MANAGE);

  const canHarvest = Boolean(access?.allowed?.HARVEST_RECORD);

  const allCycles = [
    ...(activeCycle ? [activeCycle] : []),
    ...cycles.filter(
      (cycle) => cycle.grow_cycle_id !== activeCycle?.grow_cycle_id,
    ),
  ];

  const selectedCycle =
    allCycles.find((cycle) => cycle.grow_cycle_id === selectedCycleId) || null;

  useEffect(() => {
    setActiveCycle(data?.activeCycle || null);
  }, [data?.activeCycle]);

  async function refreshFarm() {
    if (typeof onRefresh === "function") {
      await onRefresh();
    }
  }

  async function run(operation, success) {
    setBusy(true);
    setMessage("");

    try {
      const result = await operation();

      if (success) {
        await success(result);
      }

      await refreshFarm();

      setMessage("Saved successfully.");

      return result;
    } catch (e) {
      setMessage(e.message || "Action failed");

      return null;
    } finally {
      setBusy(false);
    }
  }

  function beginEdit() {
    setEditName(activeCycle?.cycle_name || "");

    setEditNotes(activeCycle?.notes || "");

    setEditing(true);
  }

  async function loadHarvestRecords(cycle) {
    if (!cycle?.grow_cycle_id) {
      return;
    }

    setSelectedCycleId(cycle.grow_cycle_id);

    setHarvestRecordsLoading(true);
    setHarvestRecordsError("");

    try {
      const result = await getGrowCycleHarvests(
        token,
        onTokenRefresh,
        cycle.grow_cycle_id,
      );

      const records =
        result?.harvests ?? result?.harvest_records ?? result?.records ?? [];

      setHarvestRecords(Array.isArray(records) ? records : []);
    } catch (e) {
      setHarvestRecords([]);

      setHarvestRecordsError(e.message || "Unable to load harvest records.");
    } finally {
      setHarvestRecordsLoading(false);
    }
  }

  async function refreshSelectedRecords(cycleId) {
    const cycle = allCycles.find((item) => item.grow_cycle_id === cycleId);

    if (cycle) {
      await loadHarvestRecords(cycle);
    }
  }

  return (
    <section className={styles.routine}>
      <h2>Grow Routine</h2>

      {loading ? (
        <p>Loading grow cycle information...</p>
      ) : error ? (
        <p>Grow routine information is unavailable.</p>
      ) : (
        <>
          <div className={styles.content}>
            <article className={styles.cycleCard}>
              <strong>Active Grow Cycle</strong>

              {activeCycle ? (
                editing ? (
                  <div className={styles.editForm}>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />

                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Notes"
                    />

                    <div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () =>
                              updateGrowCycle(
                                token,
                                onTokenRefresh,
                                activeCycle.grow_cycle_id,
                                {
                                  cycle_name: editName,
                                  notes: editNotes || null,
                                },
                              ),
                            (result) => {
                              setActiveCycle(result.grow_cycle);

                              setEditing(false);
                            },
                          )
                        }
                      >
                        <Save size={15} />
                        Save
                      </button>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditing(false)}
                      >
                        <X size={15} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h3>{activeCycle.cycle_name}</h3>

                    <p>Status: {activeCycle.status}</p>

                    <p>Started: {formatDateTime(activeCycle.started_at)}</p>

                    {activeCycle.notes && <p>{activeCycle.notes}</p>}

                    <button
                      type="button"
                      className={styles.viewRecordsButton}
                      onClick={() => loadHarvestRecords(activeCycle)}
                    >
                      View Harvest Records
                      <ChevronRight size={15} />
                    </button>

                    {canManage && (
                      <div className={styles.actionRow}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={beginEdit}
                        >
                          <Pencil size={15} />
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () =>
                                completeGrowCycle(
                                  token,
                                  onTokenRefresh,
                                  activeCycle.grow_cycle_id,
                                ),
                              () => {
                                setActiveCycle(null);

                                setEditing(false);
                              },
                            )
                          }
                        >
                          <CheckCircle2 size={16} />
                          Complete
                        </button>

                        <button
                          type="button"
                          className={styles.danger}
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                "Delete this grow cycle and its harvest/schedule history?",
                              )
                            ) {
                              run(
                                () =>
                                  deleteGrowCycle(
                                    token,
                                    onTokenRefresh,
                                    activeCycle.grow_cycle_id,
                                  ),
                                () => {
                                  if (
                                    selectedCycleId ===
                                    activeCycle.grow_cycle_id
                                  ) {
                                    setSelectedCycleId(null);

                                    setHarvestRecords([]);
                                  }

                                  setActiveCycle(null);

                                  setEditing(false);
                                },
                              );
                            }
                          }}
                        >
                          <Trash2 size={15} />
                          Delete
                        </button>
                      </div>
                    )}
                  </>
                )
              ) : (
                <p>No grow cycle is currently active.</p>
              )}
            </article>

            <article className={styles.cycleCard}>
              <strong>Recent Grow Cycle History</strong>

              {cycles.length === 0 ? (
                <p className={styles.historyEmpty}>
                  No grow cycle history is available.
                </p>
              ) : (
                <ul className={styles.historyList}>
                  {cycles.slice(0, 5).map((cycle) => (
                    <li key={cycle.grow_cycle_id}>
                      <button
                        type="button"
                        className={`${styles.historyButton} ${
                          selectedCycleId === cycle.grow_cycle_id
                            ? styles.historyButtonSelected
                            : ""
                        }`}
                        onClick={() => loadHarvestRecords(cycle)}
                      >
                        <span className={styles.historyName}>
                          {cycle.cycle_name}
                        </span>

                        <span className={styles.historyWeight}>
                          {Number(
                            cycle.harvest_summary?.total_harvest_weight_g || 0,
                          ).toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })}{" "}
                          g
                        </span>

                        <ChevronRight size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          {!activeCycle && canManage && (
            <form
              className={styles.actionForm}
              onSubmit={(e) => {
                e.preventDefault();

                run(
                  () =>
                    createGrowCycle(token, onTokenRefresh, {
                      cycle_name: cycleName,
                      notes: cycleNotes || null,
                    }),
                  (result) => {
                    setActiveCycle(result.grow_cycle);

                    setSelectedCycleId(result.grow_cycle.grow_cycle_id);

                    setHarvestRecords([]);

                    setCycleName("");
                    setCycleNotes("");
                  },
                );
              }}
            >
              <h3>
                <Plus size={17} />
                Start Grow Cycle
              </h3>

              <input
                value={cycleName}
                onChange={(e) => setCycleName(e.target.value)}
                placeholder="Cycle name"
                required
              />

              <input
                value={cycleNotes}
                onChange={(e) => setCycleNotes(e.target.value)}
                placeholder="Notes (optional)"
              />

              <button type="submit" disabled={busy}>
                Start Cycle
              </button>
            </form>
          )}

          {activeCycle && canHarvest && (
            <form
              className={styles.actionForm}
              onSubmit={(e) => {
                e.preventDefault();

                const activeId = activeCycle.grow_cycle_id;

                run(
                  () =>
                    recordHarvest(token, onTokenRefresh, activeId, {
                      harvest_weight_g: Number(weight),
                      quality_score: quality === "" ? null : Number(quality),
                      notes: harvestNotes || null,
                    }),
                  async () => {
                    setWeight("");
                    setQuality("");
                    setHarvestNotes("");

                    if (selectedCycleId === activeId) {
                      await refreshSelectedRecords(activeId);
                    }
                  },
                );
              }}
            >
              <h3>
                <Scale size={17} />
                Record Harvest
              </h3>

              <input
                type="number"
                min="0"
                step="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Harvest weight (g)"
                required
              />

              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                placeholder="Quality score 0–10"
              />

              <input
                value={harvestNotes}
                onChange={(e) => setHarvestNotes(e.target.value)}
                placeholder="Harvest notes"
              />

              <button type="submit" disabled={busy}>
                Record Harvest
              </button>
            </form>
          )}

          <section className={styles.harvestRecords}>
            <div className={styles.recordsHeader}>
              <div>
                <h3>Harvest Records</h3>

                <p>
                  {selectedCycle
                    ? selectedCycle.cycle_name
                    : "Select a grow cycle to view its harvest records."}
                </p>
              </div>

              {selectedCycle && (
                <span className={styles.recordCount}>
                  {harvestRecords.length}{" "}
                  {harvestRecords.length === 1 ? "record" : "records"}
                </span>
              )}
            </div>

            {!selectedCycle ? (
              <div className={styles.recordsEmpty}>
                Select the active grow cycle or a cycle from Recent Grow Cycle
                History.
              </div>
            ) : harvestRecordsLoading ? (
              <div className={styles.recordsEmpty}>
                Loading harvest records...
              </div>
            ) : harvestRecordsError ? (
              <div className={styles.recordsEmpty}>{harvestRecordsError}</div>
            ) : harvestRecords.length === 0 ? (
              <div className={styles.recordsEmpty}>
                No harvest records have been recorded for this grow cycle.
              </div>
            ) : (
              <div className={styles.recordsTableWrap}>
                <table className={styles.recordsTable}>
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Weight</th>
                      <th>Quality</th>
                      <th>Notes</th>
                    </tr>
                  </thead>

                  <tbody>
                    {harvestRecords.map((record) => (
                      <tr
                        key={
                          record.harvest_id ??
                          `${record.harvested_at}-${record.harvest_weight_g}`
                        }
                      >
                        <td>
                          {formatDateTime(
                            record.harvested_at ?? record.created_at,
                          )}
                        </td>

                        <td>
                          {Number(record.harvest_weight_g ?? 0).toLocaleString(
                            undefined,
                            {
                              maximumFractionDigits: 1,
                            },
                          )}{" "}
                          g
                        </td>

                        <td>
                          {record.quality_score == null
                            ? "-"
                            : `${record.quality_score} / 10`}
                        </td>

                        <td>{record.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {message && <p className={styles.message}>{message}</p>}
        </>
      )}
    </section>
  );
}

export default GrowRoutineTab;
