//! commands/settings.rs — the saved workspace camera and "launch at login".
//! Frontend wrappers: src/api/settings.js

use crate::database::workspace_view_from_connection;
use crate::models::WorkspaceView;
use crate::state::{db, AppState};
use tauri::{AppHandle, State};

/// The saved zoom/pan (or defaults).
#[tauri::command]
pub fn get_workspace_view(state: State<'_, AppState>) -> Result<WorkspaceView, String> {
    let conn = db(&state)?;
    Ok(workspace_view_from_connection(&conn))
}

/// Saves zoom/pan. Rejects values outside the supported range (keep in sync with
/// ZOOM_MIN/ZOOM_MAX in src/lib/constants.js).
#[tauri::command]
pub fn save_workspace_view(view: WorkspaceView, state: State<'_, AppState>) -> Result<(), String> {
    if !view.zoom.is_finite()
        || !(0.4..=2.2).contains(&view.zoom)
        || !view.shift_x.is_finite()
        || !view.shift_y.is_finite()
        || view.shift_x.abs() > 100_000.0
        || view.shift_y.abs() > 100_000.0
    {
        return Err("Workspace view is outside supported bounds".into());
    }
    let value = serde_json::to_string(&view).map_err(|error| error.to_string())?;
    db(&state)?.execute(
        "INSERT INTO app_settings(key,value) VALUES('workspace_view',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [value],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

/// Turns "launch at login" on or off.
#[tauri::command]
pub fn set_autostart(enabled: bool, app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    if enabled {
        manager.enable()
    } else {
        manager.disable()
    }
    .map_err(|e| e.to_string())
}

/// Is "launch at login" currently on?
#[tauri::command]
pub fn get_autostart(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}
