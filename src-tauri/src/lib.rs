use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl, WebviewWindowBuilder,
    WindowEvent,
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
        always_on_top: row.get::<_, i64>(19)? != 0,
        desktop_x: row.get(20)?,
        desktop_y: row.get(21)?,
        desktop_w: row.get(22)?,
        desktop_h: row.get(23)?,
    })
}

const NOTE_SELECT: &str = "SELECT id,title,body,x,y,w,h,color,pinned,due,recurrence,checklist,formatting,group_id,created,updated,completed,completed_at,reminder_at,always_on_top,desktop_x,desktop_y,desktop_w,desktop_h FROM notes";

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

#[tauri::command]
fn save_note(mut note: Note, state: State<'_, AppState>) -> Result<Note, String> {
    let conn = db(&state)?;
    let now = chrono_free_now();
    if note.completed && note.completed_at.is_none() {
        note.completed_at = Some(now.clone());
    }
    if !note.completed {
        note.completed_at = None;
    }
    if let Some(id) = note.id {
        conn.execute("UPDATE notes SET title=?1,body=?2,x=?3,y=?4,w=?5,h=?6,color=?7,pinned=?8,due=?9,recurrence=?10,checklist=?11,formatting=?12,group_id=?13,updated=?14,completed=?15,completed_at=?16,reminder_at=?17,always_on_top=?18,desktop_x=?19,desktop_y=?20,desktop_w=?21,desktop_h=?22 WHERE id=?23",
            params![note.title,note.body,note.x,note.y,note.w,note.h,note.color,note.pinned as i64,note.due,note.recurrence,note.checklist,note.formatting,note.group_id,now,note.completed as i64,note.completed_at,note.reminder_at,note.always_on_top as i64,note.desktop_x,note.desktop_y,note.desktop_w,note.desktop_h,id]).map_err(|e|e.to_string())?;
        note.updated = Some(now);
    } else {
        conn.execute("INSERT INTO notes(title,body,x,y,w,h,color,pinned,due,recurrence,checklist,formatting,group_id,created,updated,completed,completed_at,reminder_at,always_on_top,desktop_x,desktop_y,desktop_w,desktop_h) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?14,?15,?16,?17,?18,?19,?20,?21,?22)",
            params![note.title,note.body,note.x,note.y,note.w,note.h,note.color,note.pinned as i64,note.due,note.recurrence,note.checklist,note.formatting,note.group_id,now,note.completed as i64,note.completed_at,note.reminder_at,note.always_on_top as i64,note.desktop_x,note.desktop_y,note.desktop_w,note.desktop_h]).map_err(|e|e.to_string())?;
        note.id = Some(conn.last_insert_rowid());
        note.created = Some(now.clone());
        note.updated = Some(now);
    }
    Ok(note)
}

fn chrono_free_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string()
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
    conn.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,w REAL NOT NULL,h REAL NOT NULL,color TEXT NOT NULL,pinned INTEGER NOT NULL DEFAULT 0,due TEXT,recurrence TEXT,checklist TEXT NOT NULL DEFAULT '[]',formatting TEXT NOT NULL DEFAULT '{}',group_id INTEGER,created TEXT NOT NULL,updated TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,completed_at TEXT,reminder_at TEXT,always_on_top INTEGER NOT NULL DEFAULT 1,desktop_x REAL,desktop_y REAL,desktop_w REAL,desktop_h REAL); CREATE TABLE IF NOT EXISTS regions(id INTEGER PRIMARY KEY,title TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,w REAL NOT NULL,h REAL NOT NULL,kind TEXT NOT NULL,color TEXT NOT NULL);")?;
    for (name, definition) in [
        ("completed", "INTEGER NOT NULL DEFAULT 0"),
        ("completed_at", "TEXT"),
        ("reminder_at", "TEXT"),
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

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = show_workspace(app.clone());
        }));
    }

    builder.setup(|app| {
        let path = app.path().app_data_dir()?;
        std::fs::create_dir_all(&path)?;
        let conn = Connection::open(path.join("desknote.sqlite3"))?;
        migrate_schema(&conn)?;
        if conn.query_row("SELECT COUNT(*) FROM notes", [], |row| row.get::<_, i64>(0))? == 0 {
            let now = chrono_free_now();
            conn.execute("INSERT INTO notes(title,body,x,y,w,h,color,created,updated) VALUES('Start here','Create notes for your tasks and ideas. Pin one to keep it on your desktop.',70,80,250,210,'#fff1a8',?1,?1)", [&now])?;
            conn.execute("INSERT INTO notes(title,body,x,y,w,h,color,created,updated) VALUES('This week','Use groups and frames in your workspace to gather related notes.',360,120,250,210,'#d9f2df',?1,?1)", [&now])?;
        }
        let pinned = {
            let mut statement = conn.prepare(&format!("{NOTE_SELECT} WHERE pinned=1 ORDER BY id"))?;
            let rows = statement.query_map([], note_from_row)?.collect::<Result<Vec<_>, _>>()?;
            rows
        };
        app.manage(AppState(Mutex::new(conn)));
        for note in &pinned { let _ = create_pinned_window(app.handle(), note); }
        configure_main_window(app.handle(), should_start_hidden());
        Ok(())
    })
    .invoke_handler(tauri::generate_handler![list_notes,save_note,delete_note,list_regions,save_region,set_autostart,get_autostart,pin_note,unpin_note,set_note_title,toggle_always_on_top,hide_workspace,show_workspace])
    .run(tauri::generate_context!())
    .expect("error while running Desknote");
}
