//! commands/regions.rs — groups and frames ("regions") drawn on the canvas.
//! Frontend wrappers: src/api/regions.js
//! The SQL itself lives in database.rs (insert_region / update_region).

use crate::database::{
    all_regions, first_workspace_id, insert_region, region_from_row, update_region, REGION_SELECT,
};
use crate::models::Region;
use crate::state::{db, AppState};
use crate::util::now_iso;
use rusqlite::params;
use tauri::State;

/// All groups/frames of all workspaces.
#[tauri::command]
pub fn list_regions(state: State<'_, AppState>) -> Result<Vec<Region>, String> {
    let conn = db(&state)?;
    all_regions(&conn)
}

/// Inserts (id None) or updates (id Some) a region and returns it as stored.
/// A new region without a workspace goes into the first workspace.
#[tauri::command]
pub fn save_region(mut region: Region, state: State<'_, AppState>) -> Result<Region, String> {
    let conn = db(&state)?;
    let id = if let Some(id) = region.id {
        let changed = update_region(&conn, id, &region).map_err(|e| e.to_string())?;
        if changed == 0 {
            return Err("This group no longer exists".into());
        }
        id
    } else {
        if region.workspace_id.is_none() {
            region.workspace_id = first_workspace_id(&conn);
        }
        insert_region(&conn, &region, false).map_err(|e| e.to_string())?
    };
    conn.query_row(
        &format!("{REGION_SELECT} WHERE id=?1"),
        [id],
        region_from_row,
    )
    .map_err(|e| e.to_string())
}

/// Deletes a region. Notes that were in it are kept, just un-grouped.
#[tauri::command]
pub fn delete_region(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let conn = db(&state)?;
    conn.execute(
        "UPDATE notes SET group_id=NULL,updated=?1 WHERE group_id=?2",
        params![now_iso(), id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM regions WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
