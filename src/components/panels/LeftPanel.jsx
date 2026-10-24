/**
 * <LeftPanel> — the "layers" tree: every workspace and what is in it.
 *
 *   ▣ Workspace
 *      ▭ Frame / ▰ Group
 *          ▤ Note
 *      ▤ Note (not in a group)
 *
 * Click selects (and opens the workspace it belongs to); double-click or F2 renames; right-click
 * opens the context menu; arrow keys move, ← → collapse/expand, Enter selects.
 * The tree itself is built by lib/tree.js; this component only displays it.
 *
 * Props:
 *   tree, expanded (Set of node ids), onToggleExpand(id)
 *   activeWorkspaceId, selection (node ids)
 *   query, onQuery(text), searchRef
 *   renamingId, onRenameCommit(nodeId, text), onRenameCancel()
 *   onSelectNode(node, event), onStartRename(nodeId), onContextMenuNode(event, node)
 *   onCreateWorkspace()
 */
import { useEffect, useRef, useState } from 'react';
import { flattenVisible } from '../../lib/tree.js';

const ICONS = { workspace: '▣', frame: '▭', group: '▰', note: '▤' };

function RenameInput({ initial, onCommit, onCancel }) {
  const skip = useRef(false);
  return (
    <input
      className="tree-rename" autoFocus defaultValue={initial}
      onFocus={(event) => event.target.select()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') event.currentTarget.blur();
        else if (event.key === 'Escape') { skip.current = true; onCancel(); }
      }}
      onBlur={(event) => { if (!skip.current) onCommit(event.target.value); }}
    />
  );
}

export default function LeftPanel({
  tree, expanded, onToggleExpand, activeWorkspaceId, selection, query, onQuery, searchRef,
  renamingId, onRenameCommit, onRenameCancel, onSelectNode, onStartRename, onContextMenuNode, onCreateWorkspace,
}) {
  const rows = flattenVisible(tree, expanded);
  const [focusedId, setFocusedId] = useState(null);
  const listRef = useRef(null);
  const tabbableId = rows.some((row) => row.node.id === focusedId) ? focusedId : rows[0]?.node.id;

  // Move real keyboard focus when the focused row changes by arrow keys.
  useEffect(() => {
    if (!focusedId) return;
    listRef.current?.querySelector(`[data-node-id="${focusedId}"]`)?.focus({ preventScroll: false });
  }, [focusedId]);

  const onKeyDown = (event) => {
    if (renamingId || event.target.tagName === 'INPUT') return;
    const index = rows.findIndex((row) => row.node.id === tabbableId);
    const row = rows[index];
    if (!row) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); setFocusedId(rows[Math.min(rows.length - 1, index + 1)].node.id); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setFocusedId(rows[Math.max(0, index - 1)].node.id); }
    else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (row.node.children.length && !expanded.has(row.node.id)) onToggleExpand(row.node.id);
      else if (row.node.children.length) setFocusedId(rows[index + 1].node.id);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (row.node.children.length && expanded.has(row.node.id)) onToggleExpand(row.node.id);
      else {
        for (let i = index - 1; i >= 0; i -= 1) { if (rows[i].depth < row.depth) { setFocusedId(rows[i].node.id); break; } }
      }
    } else if (event.key === 'Enter') { event.preventDefault(); onSelectNode(row.node, event); }
  };

  return (
    <aside className="left-panel" aria-label="Workspaces and layers">
      <div className="panel-title">Layers</div>
      <label className="tree-search-label">
        <span className="sr-only">Search workspaces and notes</span>
        <input ref={searchRef} className="tree-search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search…  (Ctrl+F)" />
      </label>
      <div className="tree-scroll" role="tree" ref={listRef} onKeyDown={onKeyDown}>
        {rows.map(({ node, depth }) => {
          const hasChildren = node.children.length > 0;
          const isOpen = expanded.has(node.id);
          const isActive = node.type === 'workspace' && node.refId === activeWorkspaceId;
          return (
            <div
              key={node.id} role="treeitem" data-node-id={node.id}
              aria-level={depth + 1} aria-selected={selection.includes(node.id)} aria-expanded={hasChildren ? isOpen : undefined}
              tabIndex={node.id === tabbableId ? 0 : -1}
              className={`tree-row type-${node.type} ${selection.includes(node.id) ? 'selected' : ''} ${isActive ? 'active-workspace' : ''}`}
              style={{ paddingLeft: 6 + depth * 14 }}
              onFocus={() => setFocusedId(node.id)}
              onClick={(event) => onSelectNode(node, event)}
              onDoubleClick={() => onStartRename(node.id)}
              onContextMenu={(event) => onContextMenuNode(event, node)}
            >
              <button
                type="button" tabIndex={-1} className="tree-twist" style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
                onClick={(event) => { event.stopPropagation(); onToggleExpand(node.id); }}
              >{isOpen ? '▾' : '▸'}</button>
              <span className="tree-icon" aria-hidden="true">{ICONS[node.type]}</span>
              {renamingId === node.id
                ? <RenameInput initial={node.name} onCommit={(text) => onRenameCommit(node.id, text)} onCancel={onRenameCancel} />
                : <span className="tree-label">{node.name}</span>}
              {node.meta.pinned && <span className="tree-badge" title="Pinned to the desktop">●</span>}
              {node.meta.completed && <span className="tree-badge" title="Completed">✓</span>}
            </div>
          );
        })}
        {!rows.length && <p className="tree-empty">Nothing matches “{query}”.</p>}
      </div>
      <button type="button" className="tree-add" onClick={onCreateWorkspace}>＋ New workspace</button>
    </aside>
  );
}
