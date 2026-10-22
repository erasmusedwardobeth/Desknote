//! pinned_edit_mode.rs — temporarily "unlock" a pinned note so it can be moved/resized.
//!
//! WHY: pinned notes are X11 DESKTOP-type windows (desktop_layer.rs). Many window managers
//! refuse to move or resize such windows, even when the app asks. So moving is done in a
//! separate "arrange mode":
//!   1. The user clicks ✥ on the note   → set_pinned_edit_mode(id, true)
//!        the window becomes an ordinary (utility) window that floats above others,
//!        so the move/resize commands in pinned_geometry.rs are obeyed.
//!   2. The user drags / resizes.
//!   3. The user clicks Done            → set_pinned_edit_mode(id, false)
//!        the note goes back to the desktop layer via desktop_layer::apply, using the
//!        note's own "float above windows" setting.
//!
//! EXPERIMENT without recompiling — which window type is used while arranging:
//!     DESKNOTE_EDIT_HINT=utility (default) | normal | dialog     npm run tauri dev
//!
//! Frontend wrapper: src/api/pinnedGeometry.js → setPinnedEditMode

use crate::database::note_by_id;
use crate::desktop_layer;
use crate::state::{db, AppState};
use tauri::{AppHandle, Manager, State, WebviewWindow};

/// Linux: which X11 window type the window uses while it is being arranged.
#[cfg(target_os = "linux")]
fn edit_hint() -> gtk::gdk::WindowTypeHint {
    use gtk::gdk::WindowTypeHint;
    match std::env::var("DESKNOTE_EDIT_HINT").as_deref() {
        Ok("normal") => WindowTypeHint::Normal,
        Ok("dialog") => WindowTypeHint::Dialog,
        _ => WindowTypeHint::Utility,
    }
}

/// Turns the pinned window into a normal, movable window floating above others.
/// The window is hidden and shown again (the window type is only read when it is shown),
/// and its position is restored so it does not jump.
#[cfg(target_os = "linux")]
fn unlock_for_editing(window: &WebviewWindow) -> Result<(), String> {
    let target = window.clone();
    window
        .run_on_main_thread(move || {
            use gtk::prelude::{GtkWindowExt, WidgetExt};
            let Ok(gtk_window) = target.gtk_window() else {
                return;
            };
            let (x, y) = gtk_window.position();
            gtk_window.hide();
            gtk_window.set_type_hint(edit_hint());
            gtk_window.set_keep_below(false);
            gtk_window.set_keep_above(true);
            gtk_window.set_skip_taskbar_hint(true);
            gtk_window.set_skip_pager_hint(true);
            gtk_window.stick();
            gtk_window.show_all();
            gtk_window.move_(x, y);
        })
        .map_err(|e| e.to_string())
}

/// Windows / macOS: no special window type; just float above everything while arranging.
#[cfg(not(target_os = "linux"))]
fn unlock_for_editing(window: &WebviewWindow) -> Result<(), String> {
    window.set_always_on_top(true).map_err(|e| e.to_string())
}

/// Frontend: setPinnedEditMode(id, editing).
///   editing = true  → unlock the note for moving/resizing
///   editing = false → lock it back onto the desktop layer
#[tauri::command]
pub async fn set_pinned_edit_mode(
    id: i64,
    editing: bool,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window(&format!("note-{id}")) else {
        return Ok(());
    };
    if editing {
        unlock_for_editing(&window)
    } else {
        let float_above = {
            let conn = db(&state)?;
            note_by_id(&conn, id)?.always_on_top
        };
        desktop_layer::apply(&window, float_above)
    }
}
