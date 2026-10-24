//! commands/backup.rs — export everything to a JSON file, or restore from one.
//! Frontend wrappers: src/api/settings.js (exportBackup / importBackup)
//!
//! A backup holds workspaces, notes and groups/frames. Older backups (made before workspaces
//! existed) have no workspaces: they are restored into ONE default workspace.

use crate::commands::workspaces::validate_workspace;
use crate::database::{
    all_notes, all_regions, all_workspaces, insert_note, insert_region, insert_workspace,
    workspace_view_from_connection,
};
use crate::models::{BackupFile, Workspace};
use crate::state::{db, AppState};
use crate::util::now_iso;
use crate::window_manager::create_pinned_window;
use rusqlite::Connection;
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
        workspaces: all_workspaces(conn)?,
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

    // Workspaces: unique ids, valid fields.
    let mut workspace_ids = std::collections::HashSet::new();
    for workspace in &backup.workspaces {
        validate_workspace(workspace)?;
        match workspace.id {
            Some(id) if workspace_ids.insert(id) => {}
            _ => return Err("The backup contains missing or duplicate workspace identifiers.".into()),
        }
    }
    let known_workspace = |id: Option<i64>| match id {
        None => true,
        Some(id) => backup.workspaces.is_empty() || workspace_ids.contains(&id),
    };

    let mut note_ids = std::collections::HashSet::new();
    if backup
        .notes
        .iter()
        .any(|note| note.id.is_none_or(|id| !note_ids.insert(id)))
    {
        return Err("The backup contains missing or duplicate note identifiers.".into());
    }
    let mut region_ids = std::collections::HashSet::new();
    if backup.regions.iter().any(|region| {
        region.id.is_none_or(|id| !region_ids.insert(id))
            || !matches!(region.kind.as_str(), "group" | "frame")
            || !known_workspace(region.workspace_id)
            || !region.x.is_finite()
            || !region.y.is_finite()
            || !region.w.is_finite()
            || !region.h.is_finite()
            || region.w < 1.0
            || region.h < 1.0
    }) {
        return Err("The backup contains an invalid group or frame.".into());
    }
    // A note may belong to a group OR a frame.
    if backup.notes.iter().any(|note| {
        note.group_id.is_some_and(|id| !region_ids.contains(&id))
            || !known_workspace(note.workspace_id)
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

/// Replaces ALL workspaces, notes and regions with the contents of a backup file.
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

    // Workspaces to restore. An old backup has none: make one default workspace from it.
    let mut workspaces: Vec<Workspace> = backup.workspaces.clone();
    if workspaces.is_empty() {
        workspaces.push(Workspace {
            id: Some(1),
            name: "My workspace".into(),
            bg_color: "#f8f7f3".into(),
            bg_image: None,
            bg_fit: "cover".into(),
            bg_opacity: 1.0,
            grid: true,
            zoom: backup.workspace_view.zoom,
            shift_x: backup.workspace_view.shift_x,
            shift_y: backup.workspace_view.shift_y,
            sort_order: 0,
        });
    }
    let default_workspace = workspaces[0].id;

    // Replace the data in one transaction.
    let transaction = conn.transaction().map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM notes", [])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM regions", [])
        .map_err(|error| error.to_string())?;
    transaction
        .execute("DELETE FROM workspaces", [])
        .map_err(|error| error.to_string())?;
    for workspace in &workspaces {
        insert_workspace(&transaction, workspace, true).map_err(|error| error.to_string())?;
    }
    for region in &backup.regions {
        let mut item = region.clone();
        if item.workspace_id.is_none() {
            item.workspace_id = default_workspace;
        }
        insert_region(&transaction, &item, true).map_err(|error| error.to_string())?;
    }
    for note in &backup.notes {
        let mut item = note.clone();
        if item.workspace_id.is_none() {
            item.workspace_id = default_workspace;
        }
        insert_note(&transaction, &item, true).map_err(|error| error.to_string())?;
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
