use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{sync::Mutex, thread, time::Duration};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

struct AppState(Mutex<Connection>);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Note {
    id: Option<i64>,
    title: String,
    body: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    color: String,
    pinned: bool,
    due: Option<String>,
    recurrence: Option<String>,
    checklist: String,
    formatting: String,
    group_id: Option<i64>,
    created: Option<String>,
    updated: Option<String>,
    #[serde(default)]
    completed: bool,
    #[serde(default)]
    completed_at: Option<String>,
    #[serde(default)]
    reminder_at: Option<String>,
    #[serde(default)]
    reminder_sent: bool,
    #[serde(default = "default_true")]
    always_on_top: bool,
    #[serde(default)]
    desktop_x: Option<f64>,
    #[serde(default)]
    desktop_y: Option<f64>,
    #[serde(default)]
    desktop_w: Option<f64>,
    #[serde(default)]
    desktop_h: Option<f64>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Region {
    id: Option<i64>,
    title: String,
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    kind: String,
    color: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct BackupFile {
    format_version: u32,
    app: String,
    exported_at: String,
    notes: Vec<Note>,
    regions: Vec<Region>,
    #[serde(default = "default_workspace_view")]
    workspace_view: WorkspaceView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceView {
    zoom: f64,
    shift_x: f64,
    shift_y: f64,
}

fn default_workspace_view() -> WorkspaceView {
    WorkspaceView {
        zoom: 1.0,
        shift_x: 40.0,
        shift_y: 45.0,
    }
}

fn db<'a>(state: &'a State<'_, AppState>) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    state.0.lock().map_err(|error| error.to_string())
}

fn note_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: Some(row.get(0)?),
        title: row.get(1)?,
        body: row.get(2)?,
        x: row.get(3)?,
        y: row.get(4)?,
        w: row.get(5)?,
        h: row.get(6)?,
        color: row.get(7)?,
        pinned: row.get::<_, i64>(8)? != 0,
        due: row.get(9)?,
        recurrence: row.get(10)?,
        checklist: row.get(11)?,
        formatting: row.get(12)?,
        group_id: row.get(13)?,
        created: row.get(14)?,
        updated: row.get(15)?,
        completed: row.get::<_, i64>(16)? != 0,
        completed_at: row.get(17)?,
        reminder_at: row.get(18)?,
        reminder_sent: row.get::<_, i64>(19)? != 0,
        always_on_top: row.get::<_, i64>(20)? != 0,
        desktop_x: row.get(21)?,
        desktop_y: row.get(22)?,
        desktop_w: row.get(23)?,
        desktop_h: row.get(24)?,
    })
}

const NOTE_SELECT: &str = "SELECT id,title,body,x,y,w,h,color,pinned,due,recurrence,checklist,formatting,group_id,created,updated,completed,completed_at,reminder_at,reminder_sent,always_on_top,desktop_x,desktop_y,desktop_w,desktop_h FROM notes";

#[tauri::command]
fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let conn = db(&state)?;
    let mut stmt = conn
        .prepare(&format!("{NOTE_SELECT} ORDER BY id"))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], note_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

fn workspace_view_from_connection(conn: &Connection) -> WorkspaceView {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key='workspace_view'",
        [],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|value| serde_json::from_str(&value).ok())
    .unwrap_or_else(default_workspace_view)
}

#[tauri::command]
fn get_workspace_view(state: State<'_, AppState>) -> Result<WorkspaceView, String> {
    let conn = db(&state)?;
    Ok(workspace_view_from_connection(&conn))
}

#[tauri::command]
fn save_workspace_view(view: WorkspaceView, state: State<'_, AppState>) -> Result<(), String> {
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

#[tauri::command]
fn save_note(mut note: Note, state: State<'_, AppState>, app: AppHandle) -> Result<Note, String> {
    let conn = db(&state)?;
    let now = chrono_free_now();
    if note.completed && note.completed_at.is_none() {
        note.completed_at = Some(now.clone());
    }
    if !note.completed {
        note.completed_at = None;
    }
    if let Some(id) = note.id {
        conn.execute("UPDATE notes SET title=?1,body=?2,x=?3,y=?4,w=?5,h=?6,color=?7,pinned=?8,due=?9,recurrence=?10,checklist=?11,formatting=?12,group_id=?13,updated=?14,completed=?15,completed_at=?16,reminder_sent=CASE WHEN reminder_at IS NOT ?17 THEN 0 ELSE reminder_sent END,reminder_at=?17,always_on_top=?18,desktop_x=?19,desktop_y=?20,desktop_w=?21,desktop_h=?22 WHERE id=?23",
            params![note.title,note.body,note.x,note.y,note.w,note.h,note.color,note.pinned as i64,note.due,note.recurrence,note.checklist,note.formatting,note.group_id,now,note.completed as i64,note.completed_at,note.reminder_at,note.always_on_top as i64,note.desktop_x,note.desktop_y,note.desktop_w,note.desktop_h,id]).map_err(|e|e.to_string())?;
        note.updated = Some(now);
    } else {
        conn.execute("INSERT INTO notes(title,body,x,y,w,h,color,pinned,due,recurrence,checklist,formatting,group_id,created,updated,completed,completed_at,reminder_at,always_on_top,desktop_x,desktop_y,desktop_w,desktop_h) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14,?15,?16,?17,?18,?19,?20,?21,?22)",
            params![note.title,note.body,note.x,note.y,note.w,note.h,note.color,note.pinned as i64,note.due,note.recurrence,note.checklist,note.formatting,note.group_id,now,note.completed as i64,note.completed_at,note.reminder_at,note.always_on_top as i64,note.desktop_x,note.desktop_y,note.desktop_w,note.desktop_h]).map_err(|e|e.to_string())?;
        note.id = Some(conn.last_insert_rowid());
        note.created = Some(now.clone());
        note.updated = Some(now);
    }
    drop(conn);
    let _ = app.emit("notes-changed", note.id);
    Ok(note)
}

#[tauri::command]
fn complete_note(
    mut note: Note,
    next_due: Option<String>,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<bool, String> {
    let id = note
        .id
        .ok_or_else(|| "Save the note before completing it".to_string())?;
    if note.completed {
        return Err("This task is already completed".into());
    }
    let should_repeat = note.recurrence.is_some() && note.due.is_some();
    if should_repeat && next_due.is_none() {
        return Err("A due date is required to create the next occurrence".into());
    }
    let now = chrono_free_now();
    note.completed = true;
    note.completed_at = Some(now.clone());
    let mut conn = db(&state)?;
    let transaction = conn.transaction().map_err(|error| error.to_string())?;
    let changed = transaction.execute(
        "UPDATE notes SET title=?1,body=?2,x=?3,y=?4,w=?5,h=?6,color=?7,pinned=?8,due=?9,recurrence=?10,checklist=?11,formatting=?12,group_id=?13,updated=?14,completed=1,completed_at=?15,reminder_sent=CASE WHEN reminder_at IS NOT ?16 THEN 0 ELSE reminder_sent END,reminder_at=?16,always_on_top=?17,desktop_x=?18,desktop_y=?19,desktop_w=?20,desktop_h=?21 WHERE id=?22",
        params![note.title,note.body,note.x,note.y,note.w,note.h,note.color,note.pinned as i64,note.due,note.recurrence,note.checklist,note.formatting,note.group_id,now,note.completed_at,note.reminder_at,note.always_on_top as i64,note.desktop_x,note.desktop_y,note.desktop_w,note.desktop_h,id],
    ).map_err(|error| error.to_string())?;
    if changed != 1 {
        return Err("This note no longer exists".into());
    }

    if let Some(due) = next_due.filter(|_| should_repeat) {
        let mut next = note.clone();
        next.id = None;
        next.due = Some(due);
        next.completed = false;
        next.completed_at = None;
        next.reminder_at = None;
        next.reminder_sent = false;
        next.pinned = false;
        next.desktop_x = None;
        next.desktop_y = None;
        next.desktop_w = None;
        next.desktop_h = None;
        next.created = Some(now.clone());
        next.updated = Some(now.clone());
        transaction.execute(
            "INSERT INTO notes(title,body,x,y,w,h,color,pinned,due,recurrence,checklist,formatting,group_id,created,updated,completed,completed_at,reminder_at,reminder_sent,always_on_top,desktop_x,desktop_y,desktop_w,desktop_h) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24)",
            params![next.title,next.body,next.x,next.y,next.w,next.h,next.color,next.pinned as i64,next.due,next.recurrence,next.checklist,next.formatting,next.group_id,next.created,next.updated,next.completed as i64,next.completed_at,next.reminder_at,next.reminder_sent as i64,next.always_on_top as i64,next.desktop_x,next.desktop_y,next.desktop_w,next.desktop_h],
        ).map_err(|error| error.to_string())?;
    }
    transaction.commit().map_err(|error| error.to_string())?;
    drop(conn);
    let _ = app.emit("notes-changed", id);
    Ok(should_repeat)
}

fn chrono_free_now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn start_reminder_scheduler(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(15));
        let due = {
            let state = app.state::<AppState>();
            let Ok(conn) = state.0.lock() else { continue };
            let Ok(mut statement) = conn.prepare("SELECT id,title FROM notes WHERE reminder_at IS NOT NULL AND reminder_at <= ?1 AND reminder_sent=0 AND completed=0") else { continue };
            let now = chrono_free_now();
            let Ok(rows) = statement.query_map([now], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            }) else {
                continue;
            };
            rows.filter_map(Result::ok).collect::<Vec<_>>()
        };
        if due.is_empty() {
            continue;
        }
        let state = app.state::<AppState>();
        let Ok(conn) = state.0.lock() else { continue };
        for (id, title) in due {
            let Ok(changed) = conn.execute(
                "UPDATE notes SET reminder_sent=1 WHERE id=?1 AND reminder_sent=0 AND completed=0",
                [id],
            ) else {
                continue;
            };
            if changed == 1 {
                use tauri_plugin_notification::NotificationExt;
                let body = if title.trim().is_empty() {
                    "A note is due"
                } else {
                    title.as_str()
                };
                let _ = app
                    .notification()
                    .builder()
                    .title("Desknote reminder")
                    .body(body)
                    .show();
            }
        }
    });
}

#[tauri::command]
fn delete_note(id: i64, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    db(&state)?
        .execute("DELETE FROM notes WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window(&format!("note-{id}")) {
        let _ = window.destroy();
    }
    Ok(())
}

#[tauri::command]
fn list_regions(state: State<'_, AppState>) -> Result<Vec<Region>, String> {
    let conn = db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id,title,x,y,w,h,kind,color FROM regions ORDER BY id")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Region {
                id: Some(row.get(0)?),
                title: row.get(1)?,
                x: row.get(2)?,
                y: row.get(3)?,
                w: row.get(4)?,
                h: row.get(5)?,
                kind: row.get(6)?,
                color: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

fn backup_from_connection(conn: &Connection) -> Result<BackupFile, String> {
    let notes = {
        let mut statement = conn
            .prepare(&format!("{NOTE_SELECT} ORDER BY id"))
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], note_from_row)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        rows
    };
    let regions = {
        let mut statement = conn
            .prepare("SELECT id,title,x,y,w,h,kind,color FROM regions ORDER BY id")
            .map_err(|error| error.to_string())?;
        let rows = statement
            .query_map([], |row| {
                Ok(Region {
                    id: Some(row.get(0)?),
                    title: row.get(1)?,
                    x: row.get(2)?,
                    y: row.get(3)?,
                    w: row.get(4)?,
                    h: row.get(5)?,
                    kind: row.get(6)?,
                    color: row.get(7)?,
                })
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        rows
    };
    Ok(BackupFile {
        format_version: 1,
        app: "Desknote".into(),
        exported_at: chrono_free_now(),
        notes,
        regions,
        workspace_view: workspace_view_from_connection(conn),
    })
}

#[tauri::command]
fn export_backup(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let conn = db(&state)?;
    let backup = backup_from_connection(&conn)?;
    drop(conn);
    let bytes = serde_json::to_vec_pretty(&backup).map_err(|error| error.to_string())?;
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_backup(
    path: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|error| error.to_string())?;
    let backup: BackupFile = serde_json::from_slice(&bytes)
        .map_err(|error| format!("This file is not a valid Desknote backup: {error}"))?;
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

    let mut conn = db(&state)?;
    let recovery = backup_from_connection(&conn)?;
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let recovery_dir = app_data_dir.join("recovery");
    std::fs::create_dir_all(&recovery_dir).map_err(|error| error.to_string())?;
    let recovery_path = recovery_dir.join(format!(
        "before-restore-{}.json",
        chrono_free_now().replace(':', "-")
    ));
    std::fs::write(
        &recovery_path,
        serde_json::to_vec_pretty(&recovery).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Could not create a recovery backup; restore cancelled: {error}"))?;

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

#[tauri::command]
fn save_region(region: Region, state: State<'_, AppState>) -> Result<Region, String> {
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

#[tauri::command]
fn delete_region(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    let conn = db(&state)?;
    conn.execute(
        "UPDATE notes SET group_id=NULL,updated=?1 WHERE group_id=?2",
        params![chrono_free_now(), id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM regions WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_autostart(enabled: bool, app: AppHandle) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let manager = app.autolaunch();
    if enabled {
        manager.enable()
    } else {
        manager.disable()
    }
    .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

fn create_pinned_window(app: &AppHandle, note: &Note) -> Result<(), String> {
    let id = note
        .id
        .ok_or_else(|| "Save the note before pinning it".to_string())?;
    let label = format!("note-{id}");
    if let Some(window) = app.get_webview_window(&label) {
        window.set_title(&note.title).map_err(|e| e.to_string())?;
        window
            .set_always_on_top(note.always_on_top)
            .map_err(|e| e.to_string())?;
        window
            .set_size(tauri::LogicalSize::new(
                note.desktop_w.unwrap_or(note.w).max(250.0),
                note.desktop_h.unwrap_or(note.h).max(180.0),
            ))
            .map_err(|e| e.to_string())?;
        window
            .set_position(tauri::LogicalPosition::new(
                note.desktop_x.unwrap_or(note.x).max(0.0),
                note.desktop_y.unwrap_or(note.y).max(0.0),
            ))
            .map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let url = WebviewUrl::App(format!("index.html?note={id}").into());
    let window = WebviewWindowBuilder::new(app, &label, url)
        .title(&note.title)
        .inner_size(
            note.desktop_w.unwrap_or(note.w).max(250.0),
            note.desktop_h.unwrap_or(note.h).max(180.0),
        )
        .position(
            note.desktop_x.unwrap_or(note.x).max(0.0),
            note.desktop_y.unwrap_or(note.y).max(0.0),
        )
        .decorations(false)
        .resizable(true)
        .always_on_top(note.always_on_top)
        .skip_taskbar(true)
        .build()
        .map_err(|e| e.to_string())?;
    let app_handle = app.clone();
    window.on_window_event(move |event| match event {
        WindowEvent::CloseRequested { api, .. } => api.prevent_close(),
        WindowEvent::Moved(position) => persist_desktop_geometry(&app_handle, id, *position, None),
        WindowEvent::Resized(size) => {
            persist_desktop_geometry(&app_handle, id, PhysicalPosition::new(0, 0), Some(*size))
        }
        _ => {}
    });
    Ok(())
}

#[tauri::command]
fn pin_note(note: Note, app: AppHandle) -> Result<(), String> {
    create_pinned_window(&app, &note)
}

#[tauri::command]
fn unpin_note(id: i64, app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&format!("note-{id}")) {
        window.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn set_note_title(id: i64, title: String, app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&format!("note-{id}")) {
        window.set_title(&title).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn toggle_always_on_top(
    id: i64,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<bool, String> {
    let conn = db(&state)?;
    let current: i64 = conn
        .query_row("SELECT always_on_top FROM notes WHERE id=?1", [id], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;
    let next = current == 0;
    conn.execute(
        "UPDATE notes SET always_on_top=?1,updated=?2 WHERE id=?3",
        params![next as i64, chrono_free_now(), id],
    )
    .map_err(|e| e.to_string())?;
    drop(conn);
    if let Some(window) = app.get_webview_window(&format!("note-{id}")) {
        window.set_always_on_top(next).map_err(|e| e.to_string())?;
    }
    Ok(next)
}

fn persist_desktop_geometry(
    app: &AppHandle,
    id: i64,
    position: PhysicalPosition<i32>,
    size: Option<PhysicalSize<u32>>,
) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    let Ok(conn) = state.0.lock() else {
        return;
    };
    let scale = app
        .get_webview_window(&format!("note-{id}"))
        .and_then(|window| window.scale_factor().ok())
        .unwrap_or(1.0);
    let x = position.x as f64 / scale;
    let y = position.y as f64 / scale;
    if let Some(size) = size {
        let w = size.width as f64 / scale;
        let h = size.height as f64 / scale;
        let _ = conn.execute(
            "UPDATE notes SET desktop_w=?1,desktop_h=?2,updated=?3 WHERE id=?4",
            params![w, h, chrono_free_now(), id],
        );
    } else {
        let _ = conn.execute(
            "UPDATE notes SET desktop_x=?1,desktop_y=?2,updated=?3 WHERE id=?4",
            params![x, y, chrono_free_now(), id],
        );
    }
}

#[tauri::command]
fn hide_workspace(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        let _ = app.set_dock_visibility(false);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_skip_taskbar(true);
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn show_workspace(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = app.set_dock_visibility(true);
        let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_skip_taskbar(false);
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn configure_main_window(app: &AppHandle, background: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let app_handle = app.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = hide_workspace(app_handle.clone());
            }
        });
        if background {
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
                let _ = app.set_dock_visibility(false);
            }
            let _ = window.set_skip_taskbar(true);
            let _ = window.hide();
        } else {
            #[cfg(target_os = "macos")]
            {
                let _ = app.set_dock_visibility(true);
                let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
            }
            let _ = window.set_skip_taskbar(false);
            let _ = window.show();
        }
    }
}

fn migrate_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,w REAL NOT NULL,h REAL NOT NULL,color TEXT NOT NULL,pinned INTEGER NOT NULL DEFAULT 0,due TEXT,recurrence TEXT,checklist TEXT NOT NULL DEFAULT '[]',formatting TEXT NOT NULL DEFAULT '{}',group_id INTEGER,created TEXT NOT NULL,updated TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,completed_at TEXT,reminder_at TEXT,reminder_sent INTEGER NOT NULL DEFAULT 0,always_on_top INTEGER NOT NULL DEFAULT 1,desktop_x REAL,desktop_y REAL,desktop_w REAL,desktop_h REAL); CREATE TABLE IF NOT EXISTS regions(id INTEGER PRIMARY KEY,title TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,w REAL NOT NULL,h REAL NOT NULL,kind TEXT NOT NULL,color TEXT NOT NULL); CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);")?;
    for (name, definition) in [
        ("completed", "INTEGER NOT NULL DEFAULT 0"),
        ("completed_at", "TEXT"),
        ("reminder_at", "TEXT"),
        ("reminder_sent", "INTEGER NOT NULL DEFAULT 0"),
        ("always_on_top", "INTEGER NOT NULL DEFAULT 1"),
        ("desktop_x", "REAL"),
        ("desktop_y", "REAL"),
        ("desktop_w", "REAL"),
        ("desktop_h", "REAL"),
    ] {
        let exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('notes') WHERE name=?1)",
            [name],
            |row| row.get(0),
        )?;
        if !exists {
            conn.execute(
                &format!("ALTER TABLE notes ADD COLUMN {name} {definition}"),
                [],
            )?;
        }
    }
    Ok(())
}

fn should_start_hidden() -> bool {
    std::env::args().any(|arg| arg == "--background")
}

pub fn run() {
    let mut builder = tauri::Builder::default().plugin(
        tauri_plugin_autostart::Builder::new()
            .args(["--background"])
            .build(),
    );
    builder = builder.plugin(tauri_plugin_notification::init());
    builder = builder.plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = show_workspace(app.clone());
        }));
    }

    builder
        .setup(|app| {
            let path = app.path().app_data_dir()?;
            std::fs::create_dir_all(&path)?;
            let conn = Connection::open(path.join("desknote.sqlite3"))?;
            migrate_schema(&conn)?;
            let pinned = {
                let mut statement =
                    conn.prepare(&format!("{NOTE_SELECT} WHERE pinned=1 ORDER BY id"))?;
                let rows = statement
                    .query_map([], note_from_row)?
                    .collect::<Result<Vec<_>, _>>()?;
                rows
            };
            app.manage(AppState(Mutex::new(conn)));
            start_reminder_scheduler(app.handle().clone());
            for note in &pinned {
                let _ = create_pinned_window(app.handle(), note);
            }
            configure_main_window(app.handle(), should_start_hidden());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_notes,
            get_workspace_view,
            save_workspace_view,
            save_note,
            complete_note,
            delete_note,
            list_regions,
            save_region,
            delete_region,
            export_backup,
            import_backup,
            set_autostart,
            get_autostart,
            pin_note,
            unpin_note,
            set_note_title,
            toggle_always_on_top,
            hide_workspace,
            show_workspace,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running Desknote");
}
