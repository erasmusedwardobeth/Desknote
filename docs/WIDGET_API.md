# Widget API

There is no network server. The widget-facing API is the local Tauri command/event boundary.

## Commands

| Operation | Command | Effect |
|---|---|---|
| List canonical notes | `list_notes` | Reads all note rows from SQLite. |
| Save canonical content and properties | `save_note` | Inserts/updates the note and emits `notes-changed`. |
| Publish/unpublish a note | `set_note_pinned` | Persists pin state and creates/closes its native window. |
| Complete a task | `complete_note` | Saves completion and creates a next occurrence when requested. |
| Update native title | `set_note_title` | Updates the OS window title. |
| Move or resize a pinned window | Tauri `Window.startDragging`, `Window.startResizeDragging` | Arrange handles request a native window-manager gesture; native window events persist desktop placement. |
| Restore pinned windows | Startup query of `pinned_notes` | Reconstructs one window per persisted pinned note. |

Frontend wrappers live in `src/api/notes.js`, `src/api/windows.js`, and `src/api/pinnedGeometry.js`. Window changes currently use the `notes-changed` event followed by a reload; there is no revision-based conflict protocol or dedicated subscription API.

## Synchronization rules

SQLite is authoritative. Workspace coordinates (`x`, `y`, `w`, `h`) and desktop coordinates (`desktopX`, `desktopY`, `desktopW`, `desktopH`) are separate. Pinning does not delete the underlying note. Desktop movement and resizing update the desktop geometry fields. Editing content uses `save_note` and is reloaded by open windows.

## Note presentation values

`noteType` accepts `sticky`, `paper`, `parchment`, or `task-list`. Older JSON backups that omit the field and databases migrated from older versions default to `sticky`.
