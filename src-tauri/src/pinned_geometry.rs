//! pinned_geometry.rs — move and resize a pinned note window FROM THE APP.
//!
//! These commands only work while the note is in ARRANGE MODE (pinned_edit_mode.rs):
//! window managers usually refuse to move/resize a desktop-layer window.
//!
//! Each call is RELATIVE ("by") so it is applied to the window's current position/size:
//! a slow call can never make the window jump back to an old place.
//! The new geometry is saved by the Moved/Resized handlers that
//! window_manager.rs::create_pinned_window already installs.
//!
//! DEBUGGING: start the app with  DESKNOTE_DEBUG=1 npm run tauri dev  and every call is
//! printed to the terminal. If you drag and NOTHING is printed, the mouse events never
//! reach these commands (a frontend problem). If lines ARE printed but the window does
//! not move, the window manager is refusing the request.
//!
//! Frontend wrappers: src/api/pinnedGeometry.js

use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager};

/// Smallest size a pinned note may be resized to (same limits as create_pinned_window).
const MIN_W: f64 = 250.0;
const MIN_H: f64 = 180.0;

fn debug_enabled() -> bool {
    std::env::var_os("DESKNOTE_DEBUG").is_some()
}

/// Moves the pinned window of note `id` by (dx, dy) logical pixels.
#[tauri::command]
pub async fn move_pinned_window_by(id: i64, dx: f64, dy: f64, app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(&format!("note-{id}")) else {
        return Ok(()); // window already gone: nothing to do
    };
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let x = position.x as f64 / scale + dx;
    let y = position.y as f64 / scale + dy;
    if debug_enabled() {
        eprintln!("[desknote] move note-{id}: by ({dx}, {dy}) from ({}, {}) to ({x}, {y})", position.x, position.y);
    }
    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|e| e.to_string())
}

/// Grows (or shrinks) the pinned window of note `id` by (dw, dh) logical pixels.
#[tauri::command]
pub async fn resize_pinned_window_by(id: i64, dw: f64, dh: f64, app: AppHandle) -> Result<(), String> {
    let Some(window) = app.get_webview_window(&format!("note-{id}")) else {
        return Ok(());
    };
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let width = (size.width as f64 / scale + dw).max(MIN_W);
    let height = (size.height as f64 / scale + dh).max(MIN_H);
    if debug_enabled() {
        eprintln!("[desknote] resize note-{id}: by ({dw}, {dh}) to ({width}, {height})");
    }
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}
