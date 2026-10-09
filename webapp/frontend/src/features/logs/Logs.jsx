import { useMemo, useState } from "react";

import LogsToolbar from "./components/LogsToolbar";
import LogsTable from "./components/LogsTable";
import AuditDetails from "./components/AuditDetails";

import { getLogsData } from "../../services/logsApi";
import styles from "./Logs.module.css";

function toIsoDate(date) {
  if (!date) {
    return "";
  }

  const parts = date.split("/");

  if (parts.length !== 3) {
    return date;
  }

  const [day, month, year] = parts;

  return `${year}-${month}-${day}`;
}

function Logs({
  data = null,
  loading = false,
  error = "",
  token,
  onTokenRefresh
}) {
  const [extraLogs, setExtraLogs] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const baseLogs = Array.isArray(data) ? data : [];
  const logs = [...baseLogs, ...extraLogs.filter((item) => !baseLogs.some((base) => base.id === item.id))];

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [levelFilter, setLevelFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedLog, setSelectedLog] = useState(null);

  const invalidDateRange =
    fromDate &&
    toDate &&
    fromDate > toDate;

  const logLevels = useMemo(() => {
    return [
      ...new Set(
        logs
          .map((log) => log.level)
          .filter(Boolean)
      )
    ];
  }, [logs]);

  const logTypes = useMemo(() => {
    return [
      ...new Set(
        logs
          .map((log) => log.type)
          .filter(Boolean)
      )
    ];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (invalidDateRange) {
      return [];
    }

    return logs.filter((log) => {
      const logDate = toIsoDate(log.date);

      const matchesFrom =
        !fromDate ||
        (logDate && logDate >= fromDate);

      const matchesTo =
        !toDate ||
        (logDate && logDate <= toDate);

      const matchesLevel =
        levelFilter === "all" ||
        log.level?.toLowerCase() === levelFilter;

      const matchesType =
        typeFilter === "all" ||
        log.type?.toLowerCase() === typeFilter;

      return (
        matchesFrom &&
        matchesTo &&
        matchesLevel &&
        matchesType
      );
    });
  }, [
    logs,
    fromDate,
    toDate,
    levelFilter,
    typeFilter,
    invalidDateRange
  ]);

  function clearSelectedLog() {
    setSelectedLog(null);
  }

  function handleLogSelect(log) {
    setSelectedLog((current) =>
      current?.id === log.id ? null : log
    );
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await getLogsData(token, onTokenRefresh, { limit: 50, offset: logs.length });
      setExtraLogs((current) => [...current, ...next]);
      setHasMore(next.length === 50);
    } finally { setLoadingMore(false); }
  }

  return (
    <div className={styles.logs}>
      <LogsToolbar
        fromDate={fromDate}
        toDate={toDate}
        onFromDateChange={(value) => {
          setFromDate(value);
          clearSelectedLog();
        }}
        onToDateChange={(value) => {
          setToDate(value);
          clearSelectedLog();
        }}
        showFilters={showFilters}
        onToggleFilters={() =>
          setShowFilters((current) => !current)
        }
      />

      {error && (
        <div className={styles.errorState}>
          {error}
        </div>
      )}

      {invalidDateRange && (
        <div className={styles.dateError}>
          From date cannot be later than To date.
        </div>
      )}

      {showFilters && (
        <section className={styles.filterPanel}>
          <div className={styles.filterField}>
            <label htmlFor="levelFilter">Level</label>

            <select
              id="levelFilter"
              value={levelFilter}
              onChange={(event) => {
                setLevelFilter(event.target.value);
                clearSelectedLog();
              }}
            >
              <option value="all">All levels</option>

              {logLevels.map((level) => (
                <option
                  key={level}
                  value={level.toLowerCase()}
                >
                  {level}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterField}>
            <label htmlFor="typeFilter">Type</label>

            <select
              id="typeFilter"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                clearSelectedLog();
              }}
            >
              <option value="all">All types</option>

              {logTypes.map((type) => (
                <option
                  key={type}
                  value={type.toLowerCase()}
                >
                  {type}
                </option>
              ))}
            </select>
          </div>
        </section>
      )}

      <div
        className={
          selectedLog
            ? `${styles.contentGrid} ${styles.withDetails}`
            : `${styles.contentGrid} ${styles.tableOnly}`
        }
      >
        <LogsTable
          logs={filteredLogs}
          selectedLog={selectedLog}
          onSelectLog={handleLogSelect}
          onClearSelection={clearSelectedLog}
          invalidDateRange={invalidDateRange}
          loading={loading}
          error={error}
        />

        <AuditDetails
          log={selectedLog}
          onClose={clearSelectedLog}
        />
      </div>
      {hasMore && !loading && <button type="button" className={styles.loadMore} onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading..." : "Load more logs"}</button>}
    </div>
  );
}

export default Logs;
