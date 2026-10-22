/** SidebarTree — searchable navigation for notes and groups on the current canvas. */
import { useMemo, useState } from 'react';

export default function SidebarTree({ notes, regions, onNavigate, onCreateNote, onCreateGroup }) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const normalized = query.trim().toLocaleLowerCase();
  const matches = (item) => !normalized || `${item.title || ''} ${item.body || ''}`.toLocaleLowerCase().includes(normalized);
  const grouped = useMemo(() => {
    const result = new Map();
    for (const region of regions.filter((item) => item.kind === 'group')) result.set(region.id, []);
    for (const note of notes) if (note.groupId != null && result.has(note.groupId)) result.get(note.groupId).push(note);
    return result;
  }, [notes, regions]);
  const groupedIds = new Set([...grouped.values()].flat().map((note) => note.id));
  const ungrouped = notes.filter((note) => !groupedIds.has(note.id));
  const visibleRegions = regions.filter((region) => region.kind === 'group' && (matches(region) || (grouped.get(region.id) || []).some(matches)));
  const renderNote = (note) => (
    <button className="tree-item tree-note" key={`note-${note.id}`} title={note.title || 'Untitled'} onClick={() => onNavigate({ type: 'note', item: note })}>
      <span className="tree-item-icon" aria-hidden="true">{note.completed ? '✓' : note.pinned ? '⌖' : '▤'}</span>
      <span className="tree-item-label">{note.title?.trim() || 'Untitled note'}</span>
      {note.pinned && <span className="tree-state" title="Pinned">●</span>}
    </button>
  );
  return (
    <aside className="sidebar-tree" aria-label="Workspace navigation">
      <div className="sidebar-heading"><span>Navigate</span><button onClick={onCreateNote} title="Create note" aria-label="Create note">＋</button></div>
      <label className="tree-search-label">
        <span className="sr-only">Search notes and groups</span>
        <input className="tree-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes and groups…" />
      </label>
      <div className="tree-scroll">
        <div className="tree-section-label">GROUPS</div>
        {visibleRegions.map((region) => {
          const children = (grouped.get(region.id) || []).filter(matches);
          const isCollapsed = Boolean(collapsed[region.id]) && !normalized;
          return <section className="tree-group" key={`group-${region.id}`}>
            <div className="tree-group-row">
              <button className="tree-disclosure" aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${region.title}`} onClick={() => setCollapsed((state) => ({ ...state, [region.id]: !state[region.id] }))}>{isCollapsed ? '▸' : '▾'}</button>
              <button className="tree-item tree-group-button" onClick={() => onNavigate({ type: 'region', item: region })} title={region.title}><span className="tree-item-icon">▰</span><span className="tree-item-label">{region.title}</span></button>
            </div>
            {!isCollapsed && children.map(renderNote)}
          </section>;
        })}
        <div className="tree-section-label tree-section-spaced">NOTES</div>
        {ungrouped.filter(matches).map(renderNote)}
        {normalized && !visibleRegions.length && !ungrouped.some(matches) && <p className="tree-empty">No matching notes or groups.</p>}
        <button className="tree-add-group" onClick={onCreateGroup}>＋ New group</button>
      </div>
      <div className="sidebar-footnote">Select an item to locate it on the canvas.</div>
    </aside>
  );
}
