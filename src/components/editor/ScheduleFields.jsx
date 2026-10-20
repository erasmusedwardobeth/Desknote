/**
 * <ScheduleFields> — due date, reminder, repeat and group pickers of the note editor.
 *
 * Props:
 *   draft    the note being edited
 *   patch    patch({ due: '2026-10-20' }) → merges changes into the draft
 *   regions  all groups/frames (only kind 'group' is offered)
 */
import { fromLocalDateTime, toLocalDateTime } from '../../lib/dates.js';

export default function ScheduleFields({ draft, patch, regions }) {
  return (
    <section className="schedule">
      <label>Due
        <input type="date" value={draft.due || ''} onChange={(event) => patch({ due: event.target.value || null })} />
      </label>
      <label>Reminder
        <input type="datetime-local" value={toLocalDateTime(draft.reminderAt)} onChange={(event) => patch({ reminderAt: fromLocalDateTime(event.target.value) })} />
      </label>
      <label>Repeat
        <select value={draft.recurrence || ''} onChange={(event) => patch({ recurrence: event.target.value || null })}>
          <option value="">Never</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
      </label>
      <label>Group
        <select value={draft.groupId || ''} onChange={(event) => patch({ groupId: event.target.value ? Number(event.target.value) : null })}>
          <option value="">No group</option>
          {regions.filter((item) => item.kind === 'group').map((region) => (
            <option key={region.id} value={region.id}>{region.title}</option>
          ))}
        </select>
      </label>
    </section>
  );
}
