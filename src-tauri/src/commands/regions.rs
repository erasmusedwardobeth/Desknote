//! commands/regions.rs — groups and frames ("regions") drawn on the canvas.
//! Frontend wrappers: src/api/regions.js

use crate::database::all_regions;
use crate::models::Region;
use crate::state::{db, AppState};
use crate::util::now_iso;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn list_regions(state: State<'_, AppState>) -> Result<Vec<Region>, String> {
    let conn = db(&state)?;
    all_regions(&conn)
}

/// Inserts (id None) or updates (id Some) a region and returns it.
#[tauri::command]
pub fn save_region(region: Region, state: State<'_, AppState>) -> Result<Region, String> {
    let conn = db(&state)?;
    if let Some(id) = region.id {
        conn.execute(
            "UPDATE regions SET title=?1,x=?2,y=?3,w=?4,h=?5,kind=?6,color=?7 WHERE id=?8",
            params![
                region.title,
                region.x,
                region.y,
                region.w,
                region.h,
                region.kind,
                region.color,
                id
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(region)
    } else {
        conn.execute(
            "INSERT INTO regions(title,x,y,w,h,kind,color) VALUES(?1,?2,?3,?4,?5,?6,?7)",
            params![
                region.title,
                region.x,
                region.y,
                region.w,
                region.h,
                region.kind,
                region.color
            ],
        )
        .map_err(|e| e.to_string())?;
        let mut saved = region;
        saved.id = Some(conn.last_insert_rowid());
        Ok(saved)
    }
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
