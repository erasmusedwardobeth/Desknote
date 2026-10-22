# Pinned note: unpin, move, resize

## Files in this package
NEW      src-tauri/src/pinned_geometry.rs            Rust: move/resize a pinned window by a delta
NEW      src/api/pinnedGeometry.js                   JS wrappers for those two commands
NEW      src/hooks/usePinnedWindowDrag.js            mouse handlers (header = move, edges = resize)
NEW      src/components/ui/InlineConfirm.jsx         "Unpin?" question drawn inside the window
NEW      src/styles/pinned-interaction.css           handles + confirm styling
REPLACED src/components/pinned/PinnedNoteWindow.jsx  (back up yours first: cp it to PinnedNoteWindow.jsx.bak)

NOT TOUCHED: desktop_layer.rs, window_manager.rs, capabilities/default.json, Cargo.toml.
The Desktop hint that makes pinning work is left exactly as it is.

## Two lines to add by hand in src-tauri/src/lib.rs
1. Next to the other `mod ...;` lines:        mod pinned_geometry;
2. Inside `tauri::generate_handler![ ... ]`:  pinned_geometry::move_pinned_window_by,
                                              pinned_geometry::resize_pinned_window_by,
(Mind the commas: every entry except the last needs one.)

## Apply
    cd ~/primalmind/PROJECTS/desknote
    git add -A && git commit -m "checkpoint before pinned interaction fix"
    cp src/components/pinned/PinnedNoteWindow.jsx /tmp/PinnedNoteWindow.jsx.bak
    unzip -o ~/Downloads/desknote-pinned-manual-move-resize.zip -d .
    # edit src-tauri/src/lib.rs (two lines above)
    cd src-tauri && cargo check && cd .. && npm run build
    npm run tauri dev

## Test (report pass/fail per row)
| # | Do this | Expected |
|---|---------|----------|
| 1 | Pin a note | Appears on the desktop layer, as it does now |
| 2 | Click the pin icon in its header | An "Unpin ...?" box appears INSIDE the note |
| 3 | Press Cancel | Box closes, note stays |
| 4 | Click the pin icon, press Unpin | Window closes; the note is still in the workspace, unpinned |
| 5 | Pin again. Drag the note by its header | The note follows the mouse |
| 6 | Drag the right edge, bottom edge, bottom-right corner | Width / height / both change; never smaller than 250x180 |
| 7 | Unpin and pin again, or restart the app | Note reappears at its last position and size |
| 8 | Press Super+D, open another app | Note still visible; not drawn over the other app |

## If row 5 or 6 fails
The window manager is refusing programmatic moves/resizes of desktop-type windows. Run, and report what
the terminal prints while you drag:
    DESKNOTE_HINT=utility npm run tauri dev
Then I will switch to an "edit mode" (temporarily unlock the window type while you adjust it).
