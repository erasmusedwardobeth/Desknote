//! desktop_layer.rs — where pinned notes sit relative to your other windows.
//!
//! GOAL (SRS: "reminder scroll"): a pinned note lives on the DESKTOP LAYER.
//!   * It is NOT drawn over your other apps (unless you switch on "Float above windows").
//!   * It is NOT minimized by the OS "show desktop" shortcut (Win/Super + D).
//!   * It is not in the taskbar and appears on every virtual desktop.
//!
//! This is OS-specific, so every platform has its own `apply`:
//!   Linux    → implemented below (X11 window-type hints, see notes).
//!   Windows  → TODO: attach the window to the desktop (WorkerW) layer.
//!   macOS    → TODO: desktop window level + "join all spaces".
//!
//! LINUX NOTES
//!   On Wayland an app may not choose its window position or layer, so on Linux we
//!   start the app through XWayland (GDK_BACKEND=x11, see `prepare_backend`). There we
//!   mark pinned windows as X11 "desktop" windows, the same trick Conky uses.
//!   Different window managers react differently, so you can experiment WITHOUT
//!   recompiling by setting DESKNOTE_HINT before launching:
//!       DESKNOTE_HINT=desktop npm run tauri dev   (default)
//!       DESKNOTE_HINT=dock    npm run tauri dev
//!       DESKNOTE_HINT=utility npm run tauri dev
//!       DESKNOTE_HINT=normal  npm run tauri dev

use tauri::WebviewWindow;

/// Call once, first thing in run(), BEFORE any window exists.
/// On Linux it forces the X11 (XWayland) backend unless the user already chose one.
pub fn prepare_backend() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("GDK_BACKEND").is_none() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
    }
}

/// Which X11 window type pinned notes use (Linux only). Overridable with DESKNOTE_HINT.
#[cfg(target_os = "linux")]
fn hint_from_env() -> gtk::gdk::WindowTypeHint {
    use gtk::gdk::WindowTypeHint;
    match std::env::var("DESKNOTE_HINT").as_deref() {
        Ok("dock") => WindowTypeHint::Dock,
        Ok("utility") => WindowTypeHint::Utility,
        Ok("normal") => WindowTypeHint::Normal,
        _ => WindowTypeHint::Desktop,
    }
}

/// Puts a pinned-note window on the right layer.
///   float_above = false → desktop layer (default)
///   float_above = true  → floats above other windows
/// X11 only reads the window type when a window is shown, so the window is hidden and
/// shown again if it was visible (a brief blink).
#[cfg(target_os = "linux")]
pub fn apply(window: &WebviewWindow, float_above: bool) -> Result<(), String> {
    let target = window.clone();
    window
        .run_on_main_thread(move || {
            use gtk::prelude::{GtkWindowExt, WidgetExt};
            let Ok(gtk_window) = target.gtk_window() else {
                return;
            };
            let was_visible = gtk_window.is_visible();
            gtk_window.hide();
            if float_above {
                gtk_window.set_type_hint(gtk::gdk::WindowTypeHint::Utility);
                gtk_window.set_keep_below(false);
                gtk_window.set_keep_above(true);
            } else {
                gtk_window.set_keep_above(false);
                gtk_window.set_type_hint(hint_from_env());
                gtk_window.set_keep_below(true);
            }
            gtk_window.set_skip_taskbar_hint(true);
            gtk_window.set_skip_pager_hint(true);
            gtk_window.stick(); // show on every virtual desktop
            if was_visible {
                gtk_window.show_all();
            }
        })
        .map_err(|e| e.to_string())
}

/// Windows / macOS: not implemented yet. Falls back to ordinary always-on-top handling.
#[cfg(not(target_os = "linux"))]
pub fn apply(window: &WebviewWindow, float_above: bool) -> Result<(), String> {
    window.set_always_on_top(float_above).map_err(|e| e.to_string())
}
