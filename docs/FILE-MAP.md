# Desknote — File Map

"I want to change X → open file Y." Keep this file updated when you add features.

## Frontend (`src/`) — React, runs inside the Tauri window

| I want to change…                                  | Open this file                                   |
|----------------------------------------------------|--------------------------------------------------|
| Which window is shown (workspace vs pinned note)   | `App.jsx`                                        |
| The whole workspace screen logic (save, pin, etc.) | `components/workspace/Workspace.jsx`             |
| How a note card looks / behaves                    | `components/workspace/NoteCard.jsx` + `styles/note-card.css` |
| How a group / frame looks / behaves                | `components/workspace/RegionBox.jsx` + `styles/region.css` |
| The top bar (tabs, buttons)                        | `components/workspace/TopBar.jsx` + `styles/topbar.css` |
| The bottom bar and zoom buttons                    | `components/workspace/Footer.jsx` + `styles/footer.css` |
| The note editor dialog                             | `components/editor/NoteEditor.jsx`               |
| The checklist inside the editor                    | `components/editor/ChecklistEditor.jsx`          |
| Due / reminder / repeat / group fields             | `components/editor/ScheduleFields.jsx`           |
| The settings dialog                                | `components/settings/SettingsPanel.jsx`          |
| The shortcut list shown in settings                | `components/settings/ShortcutList.jsx`           |
| The pinned note on the desktop                     | `components/pinned/PinnedNoteWindow.jsx` + `styles/pinned.css` |
| Reusable pieces (dialog, "⋯" menu, toast, × button)| `components/ui/*.jsx`                            |
| Mouse dragging / resizing / panning                | `hooks/useCanvasDrag.js`                         |
| Zoom level and camera position                     | `hooks/useWorkspaceView.js`                      |
| Keyboard shortcuts (Ctrl+N, Ctrl+D, Esc)           | `hooks/useWorkspaceShortcuts.js`                 |
| Loading notes/regions + live updates               | `hooks/useBoardData.js`                          |
| Short pop-up messages                              | `hooks/useToast.js`                              |
| Which notes each tab shows                         | `lib/boards.js`                                  |
| Date math (due dates, repeats, weeks)              | `lib/dates.js`                                   |
| The shape of a new note                            | `lib/noteUtils.js` (and `src-tauri/src/models.rs`) |
| Limits and numbers (zoom range, min sizes)         | `lib/constants.js`                               |
| Colors and fonts                                   | `styles/theme.css` (variables) and the other `styles/*.css` |
| A call from the UI into Rust                       | `api/*.js` (one function per Rust command)       |

## Backend (`src-tauri/src/`) — Rust

| I want to change…                                  | Open this file                  |
|----------------------------------------------------|---------------------------------|
| Start-up order, which commands exist               | `lib.rs`                        |
| What a Note / Region contains                      | `models.rs`                     |
| Database tables, columns, migrations               | `database.rs`                   |
| Create / save / complete / delete notes            | `commands/notes.rs`             |
| Groups and frames                                  | `commands/regions.rs`           |
| Saved zoom/pan, launch at login                    | `commands/settings.rs`          |
| Export / restore backups                           | `commands/backup.rs`            |
| Pinned windows, hide/show workspace, quit          | `window_manager.rs`             |
| Reminder notifications                             | `reminders.rs`                  |
| Which windows may use which Tauri features         | `../capabilities/default.json`  |

## How a click travels through the app

```
Button in a component
   → handler in Workspace.jsx          (components/workspace/)
   → function in api/notes.js          (invoke('save_note', …))
   → #[tauri::command] save_note       (src-tauri/src/commands/notes.rs)
   → SQLite (database.rs schema)
   → Rust emits "notes-changed"
   → useBoardData.js reloads           → every window redraws
```

## Rules that keep the project understandable

1. **A component never calls `invoke` directly.** It calls a function from `api/`.
2. **Adding a note field** = edit `models.rs`, `database.rs` (+ migration), `commands/notes.rs`,
   `commands/backup.rs`, and `lib/noteUtils.js`. Search for an existing field such as `reminder_at` to see every place.
3. **Adding a Rust command** = write it in `commands/…`, add it to `generate_handler!` in `lib.rs`,
   add a wrapper in `api/…`.
4. **Colors/spacing** go in `styles/theme.css` as variables, not scattered as hex codes.
5. **One component = one file = one job.** If a file passes ~200 lines, split it.
