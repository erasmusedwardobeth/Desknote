# Step 2 — manual test checklist (pinning on the desktop layer)

Run with:  `npm run tauri dev`   (the app now starts through XWayland on Linux automatically)

| # | Do this | Expected |
|---|---------|----------|
| 1 | Create a note, click **Pin to desktop** | A borderless note window appears; a toast says it is on your desktop. If it fails you get a readable error and the note stays UNPINNED. |
| 2 | Open another app (browser, terminal) and click it | The pinned note is NOT drawn over that app. |
| 3 | Press **Win/Super + D** | The pinned note stays visible. |
| 4 | Move the note, unpin it, pin it again | It reopens at the place you left it. |
| 5 | Press **Ctrl+D** in the workspace, then click the workspace's **X** | Workspace hides; pinned notes stay. |
| 6 | Quit and relaunch (`npm run tauri dev`) | Pinned notes come back at their places. |
| 7 | Click the **pin icon** on a note card (top right) | Asks "Unpin … from the desktop?"; **Yes** removes the desktop window and keeps the note; **No** changes nothing. |
| 8 | Click the pin icon in the pinned note's own header | Same question, same behavior. |
| 9 | In a pinned note's ⋯ menu choose **Float above windows** | It now floats over other apps; choosing **Sit on the desktop layer** puts it back. |
| 10 | Open a note in the editor, click **Pin to desktop**, then **Save** | Pins correctly (this button used to do nothing). |

## If step 3 (Super+D) still hides the note
Window managers differ. Try the other window types WITHOUT recompiling and report which row passes:

    DESKNOTE_HINT=dock    npm run tauri dev
    DESKNOTE_HINT=utility npm run tauri dev
    DESKNOTE_HINT=normal  npm run tauri dev

Note: `dock` may float over other apps on some systems (fails row 2) — that tells us which trade-off your window manager forces.

## SRS wording to update
- DR-003: "Pinned notes sit on the desktop layer: not drawn over other applications and not minimized by the operating system's show-desktop action. Each note has a per-note option **Float above windows** (off by default)."
- Add FR-029: "A pinned note shall remain visible when the operating system's show-desktop action (for example Win/Super+D) is used."
- Add FR-030: "A pinned note shall show a pin icon; activating it asks for confirmation and then unpins the note."
