import { useRef } from "react";
import {
  CalendarDays,
  Download,
  ListFilter
} from "lucide-react";

import styles from "../Logs.module.css";

function DateField({
  id,
  label,
  value,
  onChange
}) {
  const inputRef = useRef(null);

  function openDatePicker() {
    if (inputRef.current?.showPicker) {
      inputRef.current.showPicker();
      return;
    }

    inputRef.current?.focus();
  }

  return (
    <div className={styles.dateField}>
      <label htmlFor={id}>{label}</label>

      <div className={styles.dateControl}>
        <input
          ref={inputRef}
          id={id}
          type="date"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          autoComplete="off"
        />

        <button
          type="button"
          className={styles.calendarButton}
          onClick={openDatePicker}
          aria-label={`Choose ${label.toLowerCase()} date`}
        >
          <CalendarDays size={18} />
        </button>
      </div>
    </div>
  );
}

function LogsToolbar({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  showFilters,
  onToggleFilters
}) {
  return (
    <section className={styles.toolbar}>
      <div className={styles.dateRange}>
        <DateField
          id="fromDate"
          label="From"
          value={fromDate}
          onChange={onFromDateChange}
        />

        <DateField
          id="toDate"
          label="To"
          value={toDate}
          onChange={onToDateChange}
        />
      </div>

      <div className={styles.toolbarActions}>
        <button
          type="button"
          className={
            showFilters
              ? `${styles.toolbarButton} ${styles.activeFilterButton}`
              : styles.toolbarButton
          }
          onClick={onToggleFilters}
        >
          <ListFilter size={18} />
          Filter
        </button>

        <button
          type="button"
          className={styles.toolbarButton}
          disabled
        >
          <Download size={18} />
          Export
        </button>
      </div>
    </section>
  );
}

export default LogsToolbar;
