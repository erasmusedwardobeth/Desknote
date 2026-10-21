//! Linux desktop-layer policy for pinned Desknote windows.
//!
//! Keep the strict Desktop hint as the default to preserve the behavior the user
//! had before the interaction patch. Programmatic move/resize controls are handled
//! separately by the pinned-note frontend; do not change the window type to Utility
//! globally, because that changes the window manager's Show Desktop behavior.

use tauri::WebviewWindow;

/// Call before any window exists. Force XWayland unless explicitly configured.
pub fn prepare_backend() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("GDK_BACKEND").is_none() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
    }
}

#[cfg(target_os = "linux")]
fn hint_from_env() -> gtk::gdk::WindowTypeHint {
    use gtk::gdk::WindowTypeHint;
    match std::env::var("DESKNOTE_HINT").as_deref() {
        Ok("dock") => WindowTypeHint::Dock,
        Ok("utility") => WindowTypeHint::Utility,
        Ok("normal") => WindowTypeHint::Normal,
        // Preserve the known desktop-layer behavior by default.
        _ => WindowTypeHint::Desktop,
    }
}

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
            gtk_window.stick();
            if was_visible {
                gtk_window.show_all();
            }
        })
        .map_err(|e| e.to_string())
}

#[cfg(not(target_os = "linux"))]
pub fn apply(window: &WebviewWindow, float_above: bool) -> Result<(), String> {
    window.set_always_on_top(float_above).map_err(|e| e.to_string())
}
