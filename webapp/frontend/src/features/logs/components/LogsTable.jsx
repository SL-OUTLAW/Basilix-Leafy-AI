import { useEffect, useMemo, useState } from "react";

import styles from "./LogsTable.module.css";

const PAGE_SIZE = 10;

function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from(
      { length: totalPages },
      (_, index) => index + 1
    );
  }

  if (currentPage <= 3) {
    return [1, 2, 3, "ellipsis", totalPages];
  }

  if (currentPage >= totalPages - 2) {
    return [
      1,
      "ellipsis",
      totalPages - 2,
      totalPages - 1,
      totalPages
    ];
  }

  return [
    1,
    "ellipsis-start",
    currentPage,
    "ellipsis-end",
    totalPages
  ];
}

function LogsTable({
  logs,
  selectedLog,
  onSelectLog,
  onClearSelection,
  invalidDateRange,
  loading,
  error
}) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(logs.length / PAGE_SIZE)
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
      onClearSelection();
    }
  }, [currentPage, totalPages, onClearSelection]);

  const visibleLogs = useMemo(() => {
    const start =
      (currentPage - 1) * PAGE_SIZE;

    return logs.slice(
      start,
      start + PAGE_SIZE
    );
  }, [logs, currentPage]);

  const firstItem =
    logs.length === 0
      ? 0
      : (currentPage - 1) * PAGE_SIZE + 1;

  const lastItem = Math.min(
    currentPage * PAGE_SIZE,
    logs.length
  );

  const pageNumbers = getPageNumbers(
    currentPage,
    totalPages
  );

  function changePage(page) {
    setCurrentPage(page);
    onClearSelection();
  }

  return (
    <section className={styles.tablePanel}>
      <div className={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Date</th>
              <th>Actor</th>
              <th>Level</th>
              <th>Type</th>
              <th>Event</th>
            </tr>
          </thead>

          <tbody>
            {visibleLogs.length > 0 ? (
              visibleLogs.map((log) => (
                <tr
                  key={log.id}
                  className={
                    selectedLog?.id === log.id
                      ? styles.selectedRow
                      : styles.logRow
                  }
                  onClick={() =>
                    onSelectLog(log)
                  }
                >
                  <td>{log.time}</td>
                  <td>{log.date}</td>
                  <td>{log.actor}</td>
                  <td>{log.level}</td>

                  <td>
                    <span
                      className={`${styles.typeBadge} ${
                        styles[`type${log.type}`]
                      }`}
                    >
                      {log.type}
                    </span>
                  </td>

                  <td>{log.event}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6">
                  <div className={styles.emptyState}>
                    <div>
                      <h3>
                        {loading
                          ? "Loading audit logs"
                          : error
                            ? "Audit logs unavailable"
                            : invalidDateRange
                              ? "Invalid date range"
                              : "No matching logs"}
                      </h3>

                      <p>
                        {loading
                          ? "Audit log data is being loaded."
                          : error
                            ? "The audit log data could not be loaded."
                            : invalidDateRange
                              ? "Choose a To date that is the same as or later than the From date."
                              : "No logs match the selected filters."}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.tableFooter}>
        <span>
          {logs.length === 0
            ? "No matching events"
            : `Showing ${firstItem} to ${lastItem} of ${logs.length} events`}
        </span>

        <div className={styles.pagination}>
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() =>
              changePage(currentPage - 1)
            }
            aria-label="Previous page"
          >
            ‹
          </button>

          {pageNumbers.map((page) => {
            if (
              typeof page === "string"
            ) {
              return (
                <span
                  key={page}
                  className={styles.pageEllipsis}
                >
                  …
                </span>
              );
            }

            return (
              <button
                key={page}
                type="button"
                className={
                  page === currentPage
                    ? styles.currentPage
                    : ""
                }
                onClick={() =>
                  changePage(page)
                }
              >
                {page}
              </button>
            );
          })}

          <button
            type="button"
            disabled={
              logs.length === 0 ||
              currentPage >= totalPages
            }
            onClick={() =>
              changePage(currentPage + 1)
            }
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}

export default LogsTable;
