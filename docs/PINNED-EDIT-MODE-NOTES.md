# Pinned note: arrange mode (move / resize)

## Files (all replace or add to the previous pinned-fix package; nothing else is touched)
NEW      src-tauri/src/pinned_edit_mode.rs         Rust: unlock / re-lock a pinned window
REPLACED src-tauri/src/pinned_geometry.rs          same commands + DESKNOTE_DEBUG logging
REPLACED src/api/pinnedGeometry.js                 adds setPinnedEditMode
REPLACED src/components/pinned/PinnedNoteWindow.jsx  ✥ arrange button, Done, Esc
REPLACED src/styles/pinned-interaction.css

## Edit src-tauri/src/lib.rs by hand (two lines; the earlier pinned_geometry lines stay)
1. next to the other `mod ...;` lines:        mod pinned_edit_mode;
2. inside `tauri::generate_handler![ ... ]`:  pinned_edit_mode::set_pinned_edit_mode,

## Check that desktop_layer.rs still has this exact function (arrange mode calls it to re-lock):
    grep -n "pub fn apply" src-tauri/src/desktop_layer.rs
   expected:  pub fn apply(window: &WebviewWindow, float_above: bool) -> Result<(), String>
   (two lines will match, one per OS - that is normal). If yours differs, tell me.

## Apply
    cd ~/primalmind/PROJECTS/desknote
    git add -A && git commit -m "checkpoint before arrange mode"
    unzip -o ~/Downloads/desknote-pinned-arrange-mode.zip -d .
    # edit lib.rs (above)
    cd src-tauri && cargo check && cd .. && npm run build
    DESKNOTE_DEBUG=1 npm run tauri dev

## Test (pass/fail per row)
| # | Do this | Expected |
|---|---------|----------|
| 1 | Pin a note | On the desktop layer, as before |
| 2 | Click ✥ in its header | Dashed outline; header says "Drag to move..."; a Done button appears |
| 3 | Drag the header | The note follows the mouse |
| 4 | Drag right edge / bottom edge / corner | It resizes (never below 250x180) |
| 5 | Click Done (or press Esc) | Outline disappears; note is back on the desktop layer |
| 6 | Press Super+D, open another app | Note still visible, not over the other app |
| 7 | Restart the app | Note is at its new place and size |

## Reading the terminal while you do rows 3-4
- Lines like `[desknote] move note-5: by (3, 1) ...` appear AND the note moves  -> works.
- Lines appear but the note does NOT move  -> the window manager refuses even in arrange mode.
  Try:   DESKNOTE_EDIT_HINT=normal DESKNOTE_DEBUG=1 npm run tauri dev
- NO lines appear when you drag  -> the mouse events never reach the commands (frontend problem).
Report which of the three you see.
