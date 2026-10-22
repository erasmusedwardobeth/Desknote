# Desknote pinned-note move, resize, and UI polish patch

This overlay targets the supplied Step 2 source archive. It changes only pinned-note UI/window behavior and the Tauri permissions needed by its geometry controls.

## Apply

From the Desknote repository root, create a checkpoint, extract this ZIP over the repository, then build:

```bash
git add -A && git commit -m "checkpoint before pinned note interaction fix"
unzip -o ~/Downloads/desknote-pinned-interaction-fix.zip -d .
npm run build
cd src-tauri && cargo check && cd ..
npm run tauri dev
```

## What changed

- Pinned note header drag now tracks pointer movement and moves the Tauri window with `setPosition`.
- A visible bottom-right grip resizes the pinned window with `setSize`; the minimum is 250×180 logical pixels.
- The resize and move geometry continues to be persisted by existing Rust `Moved` / `Resized` window events.
- Pinned notes use a 14px radius, cleaner border and shadow, better spacing, and a clear resize affordance.
- Linux default window hint changes from strict X11 `Desktop` to interactive `Utility`, while keeping the window below other windows, sticky across workspaces, and skipped from taskbar/pager. Strict `Desktop` hints are commonly treated as non-movable/non-resizable. If Unity's Show Desktop behavior regresses, test the trade-off explicitly with `DESKNOTE_HINT=desktop npm run tauri dev`.
- Tauri capabilities explicitly allow setting and reading window geometry.

## Test

1. Drag the pinned note by an empty part of its title bar (not the pin/menu buttons).
2. Resize from the bottom-right diagonal grip.
3. Unpin and re-pin; verify both position and size are restored.
4. Open another application; verify the note remains behind it.
5. Press Super+D; record whether the note remains visible on Unity. Window-manager policy can differ; do not assume this is solved until tested.
6. Toggle “Float above windows” and verify it behaves as before.

This patch has not been compiled or runtime-tested in this environment. If build fails, share the first error. If geometry controls work but Show Desktop behavior changes, report that separately: Unity may force a trade-off between strict desktop-layer semantics and interactive movement/resizing.
