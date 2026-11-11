# Architecture

## Current boundaries

Desknote is a modular, single-process desktop application. Tauri owns the application lifecycle and native windows; React renders the workspace and each pinned-note window; Rust commands form the local API; SQLite is the authoritative store.

```text
Workspace React window ─┐
Pinned-note React windows ├─ Tauri commands/events ─ SQLite
Background reminder loop ┘          │
                                     └─ Linux desktop-layer adapter
```

The workspace owns visual organization: workspaces, canvas camera state, note canvas coordinates, groups, and frames. Notes remain persisted independently of whether they are pinned. Desktop coordinates and dimensions have separate database columns from canvas coordinates. Pin state is persisted on the note; startup queries pinned notes and reconstructs one native webview per note. Hiding the main window does not close pinned windows. The workspace is the authoring and organization surface; pinned windows are projections of the same canonical note records.

The Tauri command modules are the application service boundary. `commands/notes.rs` validates note operations and emits `notes-changed`; `database.rs` owns SQLite reads, writes, and migrations; `window_manager.rs` translates pin and lifecycle operations into native windows. The frontend calls commands through `src/api/` wrappers and listens for change events.

## Ownership and limitations

SQLite is canonical for note content, presentation choice, tasks, schedule fields, publication state, and geometry. The workspace and pinned views are projections of those records. Pinned widgets currently run as additional windows in the same Tauri process; they are separate from the workspace window, but they are not a separate executable or independently supervised service. Closing the workspace hides it. The explicit quit action ends the application and its pinned windows.

The Rust model uses a shared `Note` record with a validated `noteType` presentation discriminator, category tags, plain-text body, and a serialized nested task list with its display style. Legacy flat checklist arrays remain readable. Rich structured content blocks, conflict revisions, a general event stream, recurring visibility windows, and multi-monitor identity are not implemented.

## Change flow

1. The workspace or pinned window invokes a typed Tauri command through an API wrapper.
2. Rust validates and writes through the shared SQLite connection.
3. Commands emit `notes-changed` for data changes.
4. Frontend windows reload canonical rows. Native window-manager move/resize gestures update the window geometry; native move/resize events persist desktop geometry separately.

## Platform boundary

`desktop_layer.rs` contains platform-specific window behavior. Linux uses GTK window hints intended for X11/XWayland. It currently forces GTK's X11 backend when `GDK_BACKEND` is unset. This is not a native Wayland protocol integration, and support depends on the compositor/window manager. Non-Linux builds currently use Tauri's always-on-top property as a fallback, not a true desktop-layer implementation. See [platform adapters](PLATFORM_ADAPTERS.md).

## Data safety

SQLite migrations add columns in place and default legacy notes to the sticky presentation. JSON backup import validates before writing, saves a recovery backup, and applies the replacement in a transaction. Never reset the application database to test a migration; use an in-memory or disposable copy.
