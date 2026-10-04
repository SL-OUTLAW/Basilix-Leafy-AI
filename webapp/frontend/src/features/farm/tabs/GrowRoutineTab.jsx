import { useEffect, useState } from "react";
import { CheckCircle2, Pencil, Plus, Save, Scale, Trash2, X } from "lucide-react";
import { completeGrowCycle, createGrowCycle, deleteGrowCycle, recordHarvest, updateGrowCycle } from "../../../services/growCycleApi";
import { formatDateTime } from "../../../utils/formatters";
import styles from "./GrowRoutineTab.module.css";

function GrowRoutineTab({ data = null, loading = false, error = false, token, onTokenRefresh, access }) {
  const [activeCycle, setActiveCycle] = useState(data?.activeCycle || null);
  const [cycleName, setCycleName] = useState("");
  const [notes, setNotes] = useState("");
  const [weight, setWeight] = useState("");
  const [quality, setQuality] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const cycles = Array.isArray(data?.history?.grow_cycles) ? data.history.grow_cycles : [];
  const canManage = Boolean(access?.allowed?.GROW_CYCLE_MANAGE);
  const canHarvest = Boolean(access?.allowed?.HARVEST_RECORD);

  useEffect(() => setActiveCycle(data?.activeCycle || null), [data?.activeCycle]);
  async function run(operation, success) { setBusy(true); setMessage(""); try { const result = await operation(); success?.(result); setMessage("Saved successfully."); } catch (e) { setMessage(e.message || "Action failed"); } finally { setBusy(false); } }
  function beginEdit() { setEditName(activeCycle?.cycle_name || ""); setEditNotes(activeCycle?.notes || ""); setEditing(true); }

  return (
    <section className={styles.routine}>
      <h2>Grow Routine</h2>
      {loading ? <p>Loading grow cycle information...</p> : error ? <p>Grow routine information is unavailable.</p> : <>
        <div className={styles.content}>
          <article className={styles.cycleCard}>
            <strong>Active Grow Cycle</strong>
            {activeCycle ? editing ? (
              <div className={styles.editForm}><input value={editName} onChange={(e) => setEditName(e.target.value)} /><textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes"/><div><button type="button" disabled={busy} onClick={() => run(() => updateGrowCycle(token, onTokenRefresh, activeCycle.grow_cycle_id, { cycle_name: editName, notes: editNotes || null }), (result) => { setActiveCycle(result.grow_cycle); setEditing(false); })}><Save size={15}/> Save</button><button type="button" onClick={() => setEditing(false)}><X size={15}/> Cancel</button></div></div>
            ) : <><h3>{activeCycle.cycle_name}</h3><p>Status: {activeCycle.status}</p><p>Started: {formatDateTime(activeCycle.started_at)}</p>{activeCycle.notes && <p>{activeCycle.notes}</p>}{canManage && <div className={styles.actionRow}><button type="button" onClick={beginEdit}><Pencil size={15}/> Edit</button><button type="button" disabled={busy} onClick={() => run(() => completeGrowCycle(token, onTokenRefresh, activeCycle.grow_cycle_id), () => setActiveCycle(null))}><CheckCircle2 size={16}/> Complete</button><button type="button" className={styles.danger} disabled={busy} onClick={() => { if (window.confirm("Delete this grow cycle and its harvest/schedule history?")) run(() => deleteGrowCycle(token, onTokenRefresh, activeCycle.grow_cycle_id), () => setActiveCycle(null)); }}><Trash2 size={15}/> Delete</button></div>}</> : <p>No grow cycle is currently active.</p>}
          </article>
          <article className={styles.cycleCard}><strong>Recent Grow Cycle History</strong>{cycles.length === 0 ? <p>No grow cycle history is available.</p> : <ul>{cycles.slice(0,5).map((cycle) => <li key={cycle.grow_cycle_id}><span>{cycle.cycle_name}</span><span>{Math.round(cycle.harvest_summary?.total_harvest_weight_g || 0)} g</span></li>)}</ul>}</article>
        </div>
        {!activeCycle && canManage && <form className={styles.actionForm} onSubmit={(e) => { e.preventDefault(); run(() => createGrowCycle(token, onTokenRefresh, { cycle_name: cycleName, notes: notes || null }), (result) => { setActiveCycle(result.grow_cycle); setCycleName(""); setNotes(""); }); }}><h3><Plus size={17}/> Start Grow Cycle</h3><input value={cycleName} onChange={(e) => setCycleName(e.target.value)} placeholder="Cycle name" required/><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)"/><button disabled={busy}>Start Cycle</button></form>}
        {activeCycle && canHarvest && <form className={styles.actionForm} onSubmit={(e) => { e.preventDefault(); run(() => recordHarvest(token, onTokenRefresh, activeCycle.grow_cycle_id, { harvest_weight_g:Number(weight), quality_score:quality === "" ? null : Number(quality), notes:notes || null }), () => { setWeight(""); setQuality(""); setNotes(""); }); }}><h3><Scale size={17}/> Record Harvest</h3><input type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Harvest weight (g)" required/><input type="number" min="0" max="10" step="0.1" value={quality} onChange={(e) => setQuality(e.target.value)} placeholder="Quality score 0-10"/><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Harvest notes"/><button disabled={busy}>Record Harvest</button></form>}
        {message && <p>{message}</p>}
      </>}
    </section>
  );
}
export default GrowRoutineTab;
