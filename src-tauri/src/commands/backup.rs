//! commands/backup.rs — export everything to a JSON file, or restore from one.
//! Frontend wrappers: src/api/settings.js (exportBackup / importBackup)

use crate::database::{all_notes, all_regions, workspace_view_from_connection};
use crate::models::BackupFile;
use crate::state::{db, AppState};
use crate::util::now_iso;
use crate::window_manager::create_pinned_window;
use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager, State};

/// Reads the whole database into a BackupFile.
fn backup_from_connection(conn: &Connection) -> Result<BackupFile, String> {
    Ok(BackupFile {
        format_version: 1,
        app: "Desknote".into(),
        exported_at: now_iso(),
        notes: all_notes(conn)?,
        regions: all_regions(conn)?,
        workspace_view: workspace_view_from_connection(conn),
    })
}

/// Writes a backup JSON file to `path`.
#[tauri::command]
pub fn export_backup(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = db(&state)?;
    let backup = backup_from_connection(&conn)?;
    drop(conn);
    let bytes = serde_json::to_vec_pretty(&backup).map_err(|error| error.to_string())?;
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

/// Checks a backup before it is allowed to replace the database.
/// Nothing is written if any check fails.
fn validate_backup(backup: &BackupFile) -> Result<(), String> {
    if backup.app != "Desknote" || backup.format_version != 1 {
        return Err("This Desknote backup version is not supported.".into());
    }
    if !backup.workspace_view.zoom.is_finite()
        || !(0.4..=2.2).contains(&backup.workspace_view.zoom)
        || !backup.workspace_view.shift_x.is_finite()
        || !backup.workspace_view.shift_y.is_finite()
    {
        return Err("The backup contains an invalid workspace view.".into());
    }
    let mut note_ids = std::collections::HashSet::new();
    if backup
        .notes
        .iter()
        .any(|note| note.id.is_none_or(|id| !note_ids.insert(id)))
    {
        return Err("The backup contains missing or duplicate note identifiers.".into());
    }
    let mut region_kinds = std::collections::HashMap::new();
    if backup.regions.iter().any(|region| {
        region
            .id
            .is_none_or(|id| region_kinds.insert(id, region.kind.as_str()).is_some())
            || !matches!(region.kind.as_str(), "group" | "frame")
            || !region.x.is_finite()
            || !region.y.is_finite()
            || !region.w.is_finite()
            || !region.h.is_finite()
            || region.w < 1.0
            || region.h < 1.0
    }) || backup.notes.iter().any(|note| {
        note.group_id
            .is_some_and(|id| region_kinds.get(&id) != Some(&"group"))
            || !note.x.is_finite()
            || !note.y.is_finite()
            || !note.w.is_finite()
            || !note.h.is_finite()
            || note.w < 1.0
            || note.h < 1.0
            || !matches!(
                note.recurrence.as_deref(),
                None | Some("daily" | "weekly" | "monthly" | "yearly")
            )
            || note
                .color
                .strip_prefix('#')
                .is_none_or(|hex| hex.len() != 6 || u32::from_str_radix(hex, 16).is_err())
    }) {
        return Err("The backup contains invalid note, group, or color data.".into());
    }
    Ok(())
}

/// Replaces ALL notes and regions with the contents of a backup file.
/// Safety: validates first, saves an automatic recovery copy, and uses one
/// transaction, so a failure leaves the current data untouched.
/// Returns the path of the recovery copy.
#[tauri::command]
pub fn import_backup(
    path: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    let backup: BackupFile = serde_json::from_slice(&bytes)
        .map_err(|error| format!("This file is not a valid Desknote backup: {error}"))?;
    validate_backup(&backup)?;

    let mut conn = db(&state)?;

    // Save a recovery copy of the CURRENT data before touching anything.
    let recovery = backup_from_connection(&conn)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let recovery_dir = app_data_dir.join("recovery");
    std::fs::create_dir_all(&recovery_dir).map_err(|error| error.to_string())?;
    let recovery_path = recovery_dir.join(format!(
        "before-restore-{}.json",
        now_iso().replace(':', "-")
    ));
    std::fs::write(
        &recovery_path,
        serde_json::to_vec_pretty(&recovery).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Could not create a recovery backup; restore cancelled: {error}"))?;

    // Replace the data in one transaction.
    let transaction = conn.transaction().map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM notes", [])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM regions", [])
        .map_err(|error| error.to_string())?;
    let workspace_view =
        serde_json::to_string(&backup.workspace_view).map_err(|error| error.to_string())?;
    transaction.execute(
        "INSERT INTO app_settings(key,value) VALUES('workspace_view',?1) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [workspace_view],
    ).map_err(|error| error.to_string())?;
    for note in &backup.notes {
        transaction.execute(
            "INSERT INTO notes(id,title,body,x,y,w,h,color,pinned,due,recurrence,checklist,formatting,group_id,created,updated,completed,completed_at,reminder_at,reminder_sent,always_on_top,desktop_x,desktop_y,desktop_w,desktop_h) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25)",
            params![note.id,note.title,note.body,note.x,note.y,note.w,note.h,note.color,note.pinned as i64,note.due,note.recurrence,note.checklist,note.formatting,note.group_id,note.created,note.updated,note.completed as i64,note.completed_at,note.reminder_at,note.reminder_sent as i64,note.always_on_top as i64,note.desktop_x,note.desktop_y,note.desktop_w,note.desktop_h],
        ).map_err(|error| error.to_string())?;
    }
    for region in &backup.regions {
        transaction
            .execute(
                "INSERT INTO regions(id,title,x,y,w,h,kind,color) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",
                params![
                    region.id,
                    region.title,
                    region.x,
                    region.y,
                    region.w,
                    region.h,
                    region.kind,
                    region.color
                ],
            )
            .map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())?;
    drop(conn);

    // Rebuild desktop windows to match the restored pinned notes.
    for (label, window) in app.webview_windows() {
        if label.starts_with("note-") {
            let _ = window.destroy();
        }
    }
    for note in backup.notes.iter().filter(|note| note.pinned) {
        create_pinned_window(&app, note)?;
    }
    Ok(recovery_path.to_string_lossy().into_owned())
}
