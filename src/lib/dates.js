/**
 * dates.js — date helpers. Pure functions: no React, no Tauri.
 * All "day" strings use the local format YYYY-MM-DD.
 */

/** Formats a Date as local "YYYY-MM-DD". */
export const formatLocalDate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Today's date as "YYYY-MM-DD". */
export const today = () => formatLocalDate(new Date());

/** ISO timestamp → value for <input type="datetime-local"> ("" if empty/invalid). */
export const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${formatLocalDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

/** <input type="datetime-local"> value → ISO timestamp (null if empty). */
export const fromLocalDateTime = (value) => (value ? new Date(value).toISOString() : null);

/**
 * The next due date of a repeating task.
 * @param {string} due         current due date "YYYY-MM-DD"
 * @param {string} recurrence  'daily' | 'weekly' | 'monthly' | 'yearly'
 * Monthly/yearly clamp to the last day of short months (Jan 31 → Feb 28).
 */
export const nextOccurrence = (due, recurrence) => {
  const [year, month, day] = due.split('-').map(Number);
  let nextYear = year;
  let nextMonth = month - 1;
  if (recurrence === 'daily' || recurrence === 'weekly') {
    const next = new Date(year, month - 1, day, 12);
    next.setDate(next.getDate() + (recurrence === 'weekly' ? 7 : 1));
    return formatLocalDate(next);
  }
  if (recurrence === 'monthly') {
    nextMonth += 1;
    if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
  } else if (recurrence === 'yearly') nextYear += 1;
  const lastDay = new Date(nextYear, nextMonth + 1, 0).getDate();
  const nextDay = Math.min(day, lastDay);
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
};

/** [monday, sunday] ("YYYY-MM-DD" each) of the week containing `dayKey`. */
export const weekBounds = (dayKey) => {
  const date = new Date(`${dayKey}T12:00:00`);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [formatLocalDate(monday), formatLocalDate(sunday)];
};
