# Step 3A — navigation tree and pinned-note dragging

## Included

- Adds a searchable sidebar tree using the existing note and group data model.
- Lists groups with their assigned notes, plus ungrouped notes.
- Selecting a note or group switches to a compatible board view and centers the canvas on the selected item.
- Adds quick actions to create a note or group.
- Replaces native title-bar drag behavior in pinned-note windows with pointer-driven Tauri positioning for Linux/X11 desktop-type windows.

## Scope boundary

This is Step 3A, not the full multi-workspace implementation. The current schema stores one global set of notes and regions and one global canvas camera. It has no workspace entity or per-workspace note ownership. Adding true independent workspaces requires a deliberate SQLite migration, updates to note/region CRUD and backup/restore, a workspace selector, and a migration strategy that keeps all existing notes in a default workspace. This overlay does not pretend that the current Everything/Daily/Weekly/Completed views are separate workspaces.

## Validation

The supplied archives do not include the project root `package.json`, lockfile, or Tauri configuration, so a full frontend/Rust build cannot be run from this overlay alone. Run the patch in the complete repository and test:

1. `npm run build`
2. `cd src-tauri && cargo check`
3. Start Desknote and drag a pinned note by its header.
4. Search for a note, select it, and verify the canvas centers on the selected item.
5. Select a group and verify the canvas centers on the group.
6. Confirm existing note editing, pinning, board tabs, and backups still work.

## Known limitation

Pointer-drag uses screen pointer deltas and Tauri's physical window positions scaled by `scaleFactor`. Verify on the actual display, especially if fractional display scaling is enabled.
