/**
 * <SettingsPanel> — startup option, backup/restore, shortcut list, and Quit.
 *
 * Props:
 *   autostart / setAutostart   current "launch at login" value and its state setter
 *   onClose, onExport, onImport, onQuit   actions owned by <Workspace>
 *   onNotify(text)             show a short message
 */
import { useState } from 'react';
import { setAutostart as saveAutostart } from '../../api/settings.js';
import Modal from '../ui/Modal.jsx';
import ModalHeader from '../ui/ModalHeader.jsx';
import ShortcutList from './ShortcutList.jsx';

export default function SettingsPanel({ autostart, setAutostart, onClose, onExport, onImport, onNotify, onQuit }) {
  const [busy, setBusy] = useState(false);

  const toggleAutostart = async () => {
    setBusy(true);
    try {
      const next = !autostart;
      await saveAutostart(next);
      setAutostart(next);
      onNotify(next ? 'Desknote will start at login.' : 'Login start is off.');
    } catch (cause) { onNotify(`Could not change login start: ${cause}`); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} className="settings-panel" backdropClassName="settings-backdrop" aria-modal="true" aria-labelledby="settings-title">
      <ModalHeader eyebrow="DESKNOTE" title="Settings and backup" titleId="settings-title" closeLabel="Close settings" onClose={onClose} />
      <section className="settings-section">
        <h3>Startup</h3>
        <p>Desknote can start in the background and restore your pinned notes when you sign in.</p>
        <button className="quiet-btn settings-action" disabled={busy} onClick={toggleAutostart}>{autostart ? 'Turn off launch at login' : 'Launch Desknote at login'}</button>
      </section>
      <section className="settings-section">
        <h3>Backup and restore</h3>
        <p>Export stores notes, checklist state, reminder settings, groups, completion history, and workspace and desktop positions in a local JSON file.</p>
        <div className="settings-buttons">
          <button className="quiet-btn settings-action" onClick={onExport}>Export backup…</button>
          <button className="quiet-btn settings-action" onClick={onImport}>Restore backup…</button>
        </div>
        <p className="settings-note">Restore replaces the current collection. Desknote first saves an automatic recovery copy in its local data folder.</p>
      </section>
      <section className="settings-section">
        <h3>Keyboard</h3>
        <ShortcutList />
      </section>
      <div className="editor-actions">
        <button className="danger" onClick={onQuit}>Quit Desknote</button>
        <span className="bar-spacer" />
        <button className="primary" onClick={onClose}>Done</button>
      </div>
    </Modal>
  );
}
