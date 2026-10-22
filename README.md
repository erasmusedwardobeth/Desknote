# Desknote pinned-note interaction repair

Overlay for the supplied Step 2 source and later interaction patch.

## Fixes
- Unpin action saves editor changes while keeping the note marked pinned, then calls `set_note_pinned(false)` so the Rust command owns the state change and window close. This avoids two competing paths flipping the pinned flag.
- During move/resize gestures, Linux temporarily changes the X11 window hint from strict Desktop to Utility, while preserving keep-below, sticky-workspace, and skip-taskbar flags. Pointer-up restores the desktop-layer hint. This is intended to let Unity's window manager accept geometry changes without permanently changing the pinned-note layer.
- Keeps the existing rounded note styling and resize grip.

## Apply
From the project root, checkpoint first, then unzip this overlay over the repository. Run `npm run build`, `cd src-tauri && cargo check`, and `npm run tauri dev`.

## Test
1. Click the pin icon and confirm unpin; the desktop window should close and the note remain in the workspace.
2. Pin it again. Drag by an empty section of the header, then release. It should return to the desktop layer.
3. Resize with the bottom-right grip, then release. Re-pin and confirm geometry persistence.
4. Confirm the note stays behind other apps and test Super+D.

This source overlay has not been compiled or runtime-tested on the target machine. X11 window managers vary in how dynamically they apply window-type hints; if movement still fails, share `cargo check` output and the result of the four tests rather than changing the hint globally.
