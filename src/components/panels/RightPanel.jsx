/**
 * <RightPanel> — the properties panel. What it shows depends on the selection:
 *   nothing selected  → the open workspace (name, background color/image, grid)
 *   one note          → <NoteProps>          one group/frame → <RegionProps>
 *   several           → <MultiProps> (align, distribute, color, delete)
 *
 * Props:
 *   workspace, imageUrl, canDelete
 *   objects        selection as [{ kind: 'note'|'region', id, item }]
 *   regions, notes of the open workspace (to count what is inside a group)
 *   handlers       actions supplied by <Workspace> (see the calls below)
 */
import MultiProps from './MultiProps.jsx';
import NoteProps from './NoteProps.jsx';
import RegionProps from './RegionProps.jsx';
import WorkspaceProps from './WorkspaceProps.jsx';
import { parseChecklist } from '../../lib/noteUtils.js';

export default function RightPanel({ workspace, imageUrl, canDelete, objects, regions, notes, handlers: h }) {
  let body = null;
  if (objects.length === 0) {
    body = (
      <WorkspaceProps
        workspace={workspace} imageUrl={imageUrl} canDelete={canDelete} noteCount={notes.length}
        onChange={h.changeWorkspace} onPickImage={h.pickImage} onRemoveImage={h.removeImage} onFit={h.zoomToFit}
        onPinAll={() => h.pinWorkspace(true)} onUnpinAll={() => h.pinWorkspace(false)}
        onDuplicate={() => h.duplicateWorkspace(workspace)} onDelete={() => h.deleteWorkspace(workspace)}
      />
    );
  } else if (objects.length === 1 && objects[0].kind === 'note') {
    const note = objects[0].item;
    body = (
      <NoteProps
        key={note.id} note={note} groupTitle={regions.find((region) => region.id === note.groupId)?.title}
        onChange={(changes) => h.applyChanges(note, changes)} onEdit={() => h.edit(note)}
        onTogglePin={() => h.togglePin(note)} onToggleComplete={() => h.toggleComplete(note)}
        onToggleTask={(index, done) => h.applyChanges(note, { checklist: JSON.stringify(parseChecklist(note.checklist).map((task, i) => (i === index ? { ...task, done } : task))) })}
        onDelete={() => h.remove([note])}
      />
    );
  } else if (objects.length === 1) {
    const region = objects[0].item;
    const contained = notes.filter((note) => note.groupId === region.id);
    body = (
      <RegionProps
        key={region.id} region={region} contained={contained}
        onChange={(changes) => h.applyChanges(region, changes)} onSelectContents={() => h.selectContents(region)}
        onPinAll={() => h.pinMany(contained.filter((note) => !note.pinned), true)}
        onUnpinAll={() => h.pinMany(contained.filter((note) => note.pinned), false)}
        onDelete={() => h.remove([region])}
      />
    );
  } else {
    body = (
      <MultiProps
        objects={objects} onAlign={(mode) => h.align(objects, mode)} onDistribute={(axis) => h.distribute(objects, axis)}
        onColor={(color) => h.setColor(objects.map((object) => object.item), color)}
        onPin={(pinned) => h.pinMany(objects.filter((object) => object.kind === 'note').map((object) => object.item).filter((note) => note.pinned !== pinned), pinned)}
        onDelete={() => h.remove(objects.map((object) => object.item))}
      />
    );
  }
  return <aside className="right-panel" aria-label="Properties"><div className="panel-title">Properties</div><div className="panel-body">{body}</div></aside>;
}
