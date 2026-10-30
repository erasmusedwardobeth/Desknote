//! commands/workspaces.rs — workspaces (separate canvases), their backgrounds and images.
//! Frontend wrappers: src/api/workspaces.js
//!
//! A workspace owns notes and regions (their workspace_id), a background (color and/or
//! image), a grid switch, and its own camera (zoom + pan). There is always at least one.

use crate::database::{
    all_workspaces, insert_note, insert_region, insert_workspace, note_from_row, region_from_row,
    workspace_by_id, NOTE_SELECT, REGION_SELECT,
};
use crate::models::Workspace;
use crate::state::{db, AppState};
use crate::util::now_iso;
use rusqlite::named_params;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, Manager, State};

/// How a background image is laid out.
const ALLOWED_FITS: [&str; 4] = ["cover", "contain", "tile", "center"];
/// File types accepted by import_image.
const IMAGE_EXTENSIONS: [&str; 8] = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];

/// "#RRGGBB" check.
fn valid_color(value: &str) -> bool {
    value
        .strip_prefix('#')
        .is_some_and(|hex| hex.len() == 6 && u32::from_str_radix(hex, 16).is_ok())
}

/// Checks the user-editable fields of a workspace. Used by save_workspace and by backup import.
pub fn validate_workspace(workspace: &Workspace) -> Result<(), String> {
    if workspace.name.trim().is_empty() {
        return Err("A workspace needs a name".into());
    }
    if !valid_color(&workspace.bg_color) {
        return Err("The background color must look like #RRGGBB".into());
    }
    if !ALLOWED_FITS.contains(&workspace.bg_fit.as_str()) {
        return Err("Unknown background image layout".into());
    }
    if !workspace.bg_opacity.is_finite() || !(0.0..=1.0).contains(&workspace.bg_opacity) {
        return Err("Background image opacity must be between 0 and 1".into());
    }
    Ok(())
}

/// A camera value the app accepts (same limits as the frontend's ZOOM_MIN/ZOOM_MAX).
fn valid_view(zoom: f64, shift_x: f64, shift_y: f64) -> bool {
    zoom.is_finite()
        && (0.4..=2.2).contains(&zoom)
        && shift_x.is_finite()
        && shift_y.is_finite()
        && shift_x.abs() <= 100_000.0
        && shift_y.abs() <= 100_000.0
}

/// All workspaces in display order.
#[tauri::command]
pub fn list_workspaces(state: State<'_, AppState>) -> Result<Vec<Workspace>, String> {
    let conn = db(&state)?;
    all_workspaces(&conn)
}

/// Creates (id None) or updates (id Some) a workspace and returns it as stored.
/// Updating changes name, background, grid and order only; the camera has its own command
/// (set_workspace_view) so a stale panel can never overwrite it.
#[tauri::command]
pub fn save_workspace(workspace: Workspace, state: State<'_, AppState>) -> Result<Workspace, String> {
    validate_workspace(&workspace)?;
    let mut workspace = workspace;
    workspace.name = workspace.name.trim().to_string();
    let conn = db(&state)?;
    match workspace.id {
        Some(id) => {
            let changed = conn
                .execute(
                    "UPDATE workspaces SET name=:name,bg_color=:bg_color,bg_image=:bg_image,bg_fit=:bg_fit,bg_opacity=:bg_opacity,grid=:grid,sort_order=:sort_order WHERE id=:id",
                    named_params! {
                        ":name": workspace.name,
                        ":bg_color": workspace.bg_color,
                        ":bg_image": workspace.bg_image,
                        ":bg_fit": workspace.bg_fit,
                        ":bg_opacity": workspace.bg_opacity,
                        ":grid": workspace.grid as i64,
                        ":sort_order": workspace.sort_order,
                        ":id": id,
                    },
                )
                .map_err(|e| e.to_string())?;
            if changed != 1 {
                return Err("This workspace no longer exists".into());
            }
            workspace_by_id(&conn, id)
        }
        None => {
            let next_order: i64 = conn
                .query_row(
                    "SELECT COALESCE(MAX(sort_order),-1)+1 FROM workspaces",
                    [],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            workspace.sort_order = next_order;
            if !valid_view(workspace.zoom, workspace.shift_x, workspace.shift_y) {
                workspace.zoom = 1.0;
                workspace.shift_x = 40.0;
                workspace.shift_y = 45.0;
            }
            let id = insert_workspace(&conn, &workspace, false).map_err(|e| e.to_string())?;
            workspace_by_id(&conn, id)
        }
    }
}

/// Saves a workspace's own camera (zoom and pan).
#[tauri::command]
pub fn set_workspace_view(
    id: i64,
    zoom: f64,
    shift_x: f64,
    shift_y: f64,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if !valid_view(zoom, shift_x, shift_y) {
        return Err("Workspace view is outside supported bounds".into());
    }
    db(&state)?
        .execute(
            "UPDATE workspaces SET zoom=?1,shift_x=?2,shift_y=?3 WHERE id=?4",
            rusqlite::params![zoom, shift_x, shift_y, id],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Deletes a workspace AND everything in it (its notes and groups/frames), closing the
/// desktop windows of its pinned notes. The last remaining workspace cannot be deleted.
/// All-or-nothing: one transaction.
#[tauri::command]
pub fn delete_workspace(id: i64, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    let mut conn = db(&state)?;
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM workspaces", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    if count <= 1 {
        return Err("You cannot delete your only workspace".into());
    }
    let note_ids: Vec<i64> = {
        let mut statement = conn
            .prepare("SELECT id FROM notes WHERE workspace_id=?1")
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([id], |row| row.get::<_, i64>(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    let transaction = conn.transaction().map_err(|e| e.to_string())?;
    transaction
        .execute("DELETE FROM notes WHERE workspace_id=?1", [id])
        .map_err(|e| e.to_string())?;
    transaction
        .execute("DELETE FROM regions WHERE workspace_id=?1", [id])
        .map_err(|e| e.to_string())?;
    let changed = transaction
        .execute("DELETE FROM workspaces WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    if changed != 1 {
        return Err("This workspace no longer exists".into());
    }
    transaction.commit().map_err(|e| e.to_string())?;
    drop(conn);
    for note_id in note_ids {
        if let Some(window) = app.get_webview_window(&format!("note-{note_id}")) {
            let _ = window.destroy();
        }
    }
    let _ = app.emit("notes-changed", id);
    Ok(())
}

/// Copies a workspace with all its groups/frames and notes ("<name> copy").
/// Copied notes are NOT pinned and have no reminder (so nothing fires twice);
/// note-to-group links are re-pointed at the copied groups. One transaction.
#[tauri::command]
pub fn duplicate_workspace(id: i64, state: State<'_, AppState>, app: AppHandle) -> Result<Workspace, String> {
    let mut conn = db(&state)?;
    let source = workspace_by_id(&conn, id)?;
    let transaction = conn.transaction().map_err(|e| e.to_string())?;

    let next_order: i64 = transaction
        .query_row(
            "SELECT COALESCE(MAX(sort_order),-1)+1 FROM workspaces",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let mut copy = source.clone();
    copy.name = format!("{} copy", source.name);
    copy.sort_order = next_order;
    let new_id = insert_workspace(&transaction, &copy, false).map_err(|e| e.to_string())?;

    // Groups / frames first, remembering old id -> new id.
    let regions = {
        let mut statement = transaction
            .prepare(&format!("{REGION_SELECT} WHERE workspace_id=?1 ORDER BY id"))
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([id], region_from_row)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    let mut region_map: HashMap<i64, i64> = HashMap::new();
    for region in regions {
        let old_id = region.id;
        let mut copy_region = region;
        copy_region.workspace_id = Some(new_id);
        let new_region_id = insert_region(&transaction, &copy_region, false).map_err(|e| e.to_string())?;
        if let Some(old) = old_id {
            region_map.insert(old, new_region_id);
        }
    }

    let notes = {
        let mut statement = transaction
            .prepare(&format!("{NOTE_SELECT} WHERE workspace_id=?1 ORDER BY id"))
            .map_err(|e| e.to_string())?;
        let rows = statement
            .query_map([id], note_from_row)
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };
    let now = now_iso();
    for note in notes {
        let mut copy_note = note;
        copy_note.id = None;
        copy_note.workspace_id = Some(new_id);
        copy_note.group_id = copy_note.group_id.and_then(|old| region_map.get(&old).copied());
        copy_note.pinned = false;
        copy_note.desktop_x = None;
        copy_note.desktop_y = None;
        copy_note.desktop_w = None;
        copy_note.desktop_h = None;
        copy_note.reminder_at = None;
        copy_note.reminder_sent = false;
        copy_note.created = Some(now.clone());
        copy_note.updated = Some(now.clone());
        insert_note(&transaction, &copy_note, false).map_err(|e| e.to_string())?;
    }

    transaction.commit().map_err(|e| e.to_string())?;
    let created = workspace_by_id(&conn, new_id)?;
    drop(conn);
    let _ = app.emit("notes-changed", new_id);
    Ok(created)
}

/// Copies an image file into the app's own images folder and returns the NEW absolute path.
/// The app then reads the copy, so the original can be moved or deleted. There is no size
/// limit. Only the path is stored in the database (never the image data).
#[tauri::command]
pub fn import_image(source_path: String, app: AppHandle) -> Result<String, String> {
    let source = std::path::PathBuf::from(&source_path);
    let extension = source
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .ok_or_else(|| "This file has no extension, so its type is unknown".to_string())?;
    if !IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("Unsupported image type .{extension}"));
    }
    let stem: String = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("image")
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .take(60)
        .collect();
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("images");
    std::fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let stamp = chrono::Utc::now().timestamp_millis();
    let target = directory.join(format!("{stamp}-{stem}.{extension}"));
    std::fs::copy(&source, &target).map_err(|e| format!("Could not copy the image: {e}"))?;
    Ok(target.to_string_lossy().into_owned())
}
