//! database.rs — everything about the SQLite schema, reading rows, and the shared
//! INSERT / UPDATE statements.
//!
//! Column ORDER matters for reading: `NOTE_SELECT` lists columns in a fixed order and
//! `note_from_row` reads them by position (row.get(0), row.get(1) …). If you add a column,
//! add it to the END of the SELECT and of the row reader, and to `migrate_schema`.
//! Writing uses NAMED parameters (:title, :x …), so order does not matter there.

use crate::models::{default_workspace_view, Note, Region, Workspace, WorkspaceView};
use crate::util::now_iso;
use rusqlite::{named_params, params, Connection};

/// The columns read for a note, in the order note_from_row expects them.
pub const NOTE_SELECT: &str = "SELECT id,title,body,x,y,w,h,color,pinned,due,recurrence,checklist,formatting,group_id,created,updated,completed,completed_at,reminder_at,reminder_sent,always_on_top,desktop_x,desktop_y,desktop_w,desktop_h,workspace_id FROM notes";

/// The columns read for a region, in the order region_from_row expects them.
pub const REGION_SELECT: &str = "SELECT id,title,x,y,w,h,kind,color,workspace_id FROM regions";

/// The columns read for a workspace, in the order workspace_from_row expects them.
pub const WORKSPACE_SELECT: &str = "SELECT id,name,bg_color,bg_image,bg_fit,bg_opacity,grid,zoom,shift_x,shift_y,sort_order FROM workspaces";

/// Converts one database row (selected with NOTE_SELECT) into a Note.
pub fn note_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Note> {
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
        workspace_id: row.get(25)?,
    })
}

/// Converts one database row (selected with REGION_SELECT) into a Region.
pub fn region_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Region> {
    Ok(Region {
        id: Some(row.get(0)?),
        title: row.get(1)?,
        x: row.get(2)?,
        y: row.get(3)?,
        w: row.get(4)?,
        h: row.get(5)?,
        kind: row.get(6)?,
        color: row.get(7)?,
        workspace_id: row.get(8)?,
    })
}

/// Converts one database row (selected with WORKSPACE_SELECT) into a Workspace.
pub fn workspace_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Workspace> {
    Ok(Workspace {
        id: Some(row.get(0)?),
        name: row.get(1)?,
        bg_color: row.get(2)?,
        bg_image: row.get(3)?,
        bg_fit: row.get(4)?,
        bg_opacity: row.get(5)?,
        grid: row.get::<_, i64>(6)? != 0,
        zoom: row.get(7)?,
        shift_x: row.get(8)?,
        shift_y: row.get(9)?,
        sort_order: row.get(10)?,
    })
}

/// Every note, oldest first.
pub fn all_notes(conn: &Connection) -> Result<Vec<Note>, String> {
    let mut statement = conn
        .prepare(&format!("{NOTE_SELECT} ORDER BY id"))
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], note_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

/// One note by id.
pub fn note_by_id(conn: &Connection, id: i64) -> Result<Note, String> {
    conn.query_row(&format!("{NOTE_SELECT} WHERE id=?1"), [id], note_from_row)
        .map_err(|e| e.to_string())
}

/// Every group/frame, oldest first.
pub fn all_regions(conn: &Connection) -> Result<Vec<Region>, String> {
    let mut statement = conn
        .prepare(&format!("{REGION_SELECT} ORDER BY id"))
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], region_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

/// Every workspace in display order.
pub fn all_workspaces(conn: &Connection) -> Result<Vec<Workspace>, String> {
    let mut statement = conn
        .prepare(&format!("{WORKSPACE_SELECT} ORDER BY sort_order,id"))
        .map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], workspace_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

/// One workspace by id.
pub fn workspace_by_id(conn: &Connection, id: i64) -> Result<Workspace, String> {
    conn.query_row(
        &format!("{WORKSPACE_SELECT} WHERE id=?1"),
        [id],
        workspace_from_row,
    )
    .map_err(|e| e.to_string())
}

/// The id of the first workspace (the one items without a workspace belong to).
pub fn first_workspace_id(conn: &Connection) -> Option<i64> {
    conn.query_row(
        "SELECT id FROM workspaces ORDER BY sort_order,id LIMIT 1",
        [],
        |row| row.get(0),
    )
    .ok()
}

/// Notes that should have a desktop window (used at startup to restore pinned notes).
pub fn pinned_notes(conn: &Connection) -> rusqlite::Result<Vec<Note>> {
    let mut statement = conn.prepare(&format!("{NOTE_SELECT} WHERE pinned=1 ORDER BY id"))?;
    let rows = statement
        .query_map([], note_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// The saved GLOBAL workspace camera (older versions of the app). Only used to seed the
/// first workspace's camera during migration, and by the old get/save_workspace_view commands.
pub fn workspace_view_from_connection(conn: &Connection) -> WorkspaceView {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key='workspace_view'",
        [],
        |row| row.get::<_, String>(0),
    )
    .ok()
    .and_then(|value| serde_json::from_str(&value).ok())
    .unwrap_or_else(default_workspace_view)
}

// ---------------------------------------------------------------------------------------
// Shared INSERT / UPDATE statements (one place each, so they cannot drift apart)
// ---------------------------------------------------------------------------------------

/// Inserts a note and returns its id. keep_id = true writes note.id too (backup restore).
/// `created` / `updated` default to now when the note has none.
pub fn insert_note(conn: &Connection, note: &Note, keep_id: bool) -> rusqlite::Result<i64> {
    let id_value: Option<i64> = if keep_id { note.id } else { None };
    let created = note.created.clone().unwrap_or_else(now_iso);
    let updated = note.updated.clone().unwrap_or_else(|| created.clone());
    conn.execute(
        "INSERT INTO notes(id,title,body,x,y,w,h,color,pinned,due,recurrence,checklist,formatting,group_id,created,updated,completed,completed_at,reminder_at,reminder_sent,always_on_top,desktop_x,desktop_y,desktop_w,desktop_h,workspace_id) VALUES(:id,:title,:body,:x,:y,:w,:h,:color,:pinned,:due,:recurrence,:checklist,:formatting,:group_id,:created,:updated,:completed,:completed_at,:reminder_at,:reminder_sent,:always_on_top,:desktop_x,:desktop_y,:desktop_w,:desktop_h,:workspace_id)",
        named_params! {
            ":id": id_value,
            ":title": note.title,
            ":body": note.body,
            ":x": note.x,
            ":y": note.y,
            ":w": note.w,
            ":h": note.h,
            ":color": note.color,
            ":pinned": note.pinned as i64,
            ":due": note.due,
            ":recurrence": note.recurrence,
            ":checklist": note.checklist,
            ":formatting": note.formatting,
            ":group_id": note.group_id,
            ":created": created,
            ":updated": updated,
            ":completed": note.completed as i64,
            ":completed_at": note.completed_at,
            ":reminder_at": note.reminder_at,
            ":reminder_sent": note.reminder_sent as i64,
            ":always_on_top": note.always_on_top as i64,
            ":desktop_x": note.desktop_x,
            ":desktop_y": note.desktop_y,
            ":desktop_w": note.desktop_w,
            ":desktop_h": note.desktop_h,
            ":workspace_id": note.workspace_id,
        },
    )?;
    Ok(conn.last_insert_rowid())
}

/// Updates every field of note `id`. Returns how many rows changed (0 = no such note).
/// `reminder_sent` is reset when the reminder time changes; a missing workspace_id keeps the
/// current one.
pub fn update_note(conn: &Connection, id: i64, note: &Note, now: &str) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE notes SET title=:title,body=:body,x=:x,y=:y,w=:w,h=:h,color=:color,pinned=:pinned,due=:due,recurrence=:recurrence,checklist=:checklist,formatting=:formatting,group_id=:group_id,updated=:updated,completed=:completed,completed_at=:completed_at,reminder_sent=CASE WHEN reminder_at IS NOT :reminder_at THEN 0 ELSE reminder_sent END,reminder_at=:reminder_at,always_on_top=:always_on_top,desktop_x=:desktop_x,desktop_y=:desktop_y,desktop_w=:desktop_w,desktop_h=:desktop_h,workspace_id=COALESCE(:workspace_id,workspace_id) WHERE id=:id",
        named_params! {
            ":title": note.title,
            ":body": note.body,
            ":x": note.x,
            ":y": note.y,
            ":w": note.w,
            ":h": note.h,
            ":color": note.color,
            ":pinned": note.pinned as i64,
            ":due": note.due,
            ":recurrence": note.recurrence,
            ":checklist": note.checklist,
            ":formatting": note.formatting,
            ":group_id": note.group_id,
            ":updated": now,
            ":completed": note.completed as i64,
            ":completed_at": note.completed_at,
            ":reminder_at": note.reminder_at,
            ":always_on_top": note.always_on_top as i64,
            ":desktop_x": note.desktop_x,
            ":desktop_y": note.desktop_y,
            ":desktop_w": note.desktop_w,
            ":desktop_h": note.desktop_h,
            ":workspace_id": note.workspace_id,
            ":id": id,
        },
    )
}

/// Inserts a group/frame and returns its id. keep_id = true writes region.id too.
pub fn insert_region(conn: &Connection, region: &Region, keep_id: bool) -> rusqlite::Result<i64> {
    let id_value: Option<i64> = if keep_id { region.id } else { None };
    conn.execute(
        "INSERT INTO regions(id,title,x,y,w,h,kind,color,workspace_id) VALUES(:id,:title,:x,:y,:w,:h,:kind,:color,:workspace_id)",
        named_params! {
            ":id": id_value,
            ":title": region.title,
            ":x": region.x,
            ":y": region.y,
            ":w": region.w,
            ":h": region.h,
            ":kind": region.kind,
            ":color": region.color,
            ":workspace_id": region.workspace_id,
        },
    )?;
    Ok(conn.last_insert_rowid())
}

/// Updates every field of region `id`. Returns how many rows changed.
pub fn update_region(conn: &Connection, id: i64, region: &Region) -> rusqlite::Result<usize> {
    conn.execute(
        "UPDATE regions SET title=:title,x=:x,y=:y,w=:w,h=:h,kind=:kind,color=:color,workspace_id=COALESCE(:workspace_id,workspace_id) WHERE id=:id",
        named_params! {
            ":title": region.title,
            ":x": region.x,
            ":y": region.y,
            ":w": region.w,
            ":h": region.h,
            ":kind": region.kind,
            ":color": region.color,
            ":workspace_id": region.workspace_id,
            ":id": id,
        },
    )
}

/// Inserts a workspace and returns its id. keep_id = true writes workspace.id too (restore).
pub fn insert_workspace(conn: &Connection, workspace: &Workspace, keep_id: bool) -> rusqlite::Result<i64> {
    let id_value: Option<i64> = if keep_id { workspace.id } else { None };
    conn.execute(
        "INSERT INTO workspaces(id,name,bg_color,bg_image,bg_fit,bg_opacity,grid,zoom,shift_x,shift_y,sort_order,created) VALUES(:id,:name,:bg_color,:bg_image,:bg_fit,:bg_opacity,:grid,:zoom,:shift_x,:shift_y,:sort_order,:created)",
        named_params! {
            ":id": id_value,
            ":name": workspace.name,
            ":bg_color": workspace.bg_color,
            ":bg_image": workspace.bg_image,
            ":bg_fit": workspace.bg_fit,
            ":bg_opacity": workspace.bg_opacity,
            ":grid": workspace.grid as i64,
            ":zoom": workspace.zoom,
            ":shift_x": workspace.shift_x,
            ":shift_y": workspace.shift_y,
            ":sort_order": workspace.sort_order,
            ":created": now_iso(),
        },
    )?;
    Ok(conn.last_insert_rowid())
}

// ---------------------------------------------------------------------------------------
// Schema and migrations
// ---------------------------------------------------------------------------------------

/// Creates the tables if missing and upgrades older databases. Safe to run on every start.
pub fn migrate_schema(conn: &Connection) -> rusqlite::Result<()> {
    // Safety net: before the FIRST workspaces migration, keep a copy of the whole database
    // next to it ("desknote.before-workspaces.sqlite3"). It is written once and never replaced.
    let has_notes: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='notes')",
        [],
        |row| row.get(0),
    )?;
    let has_workspaces: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='workspaces')",
        [],
        |row| row.get(0),
    )?;
    if has_notes && !has_workspaces {

                if let Some(path) = conn.path().filter(|p| !p.is_empty()) {
            let backup = std::path::Path::new(path).with_file_name("desknote.before-workspaces.sqlite3");
        // if let Some(path) = conn.path().filter(|p| !p.as_os_str().is_empty()) {
        //     let backup = path.with_file_name("desknote.before-workspaces.sqlite3");


            if !backup.exists() {
                conn.execute("VACUUM INTO ?1", [backup.to_string_lossy().to_string()])?;
            }
        }
    }

    conn.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,w REAL NOT NULL,h REAL NOT NULL,color TEXT NOT NULL,pinned INTEGER NOT NULL DEFAULT 0,due TEXT,recurrence TEXT,checklist TEXT NOT NULL DEFAULT '[]',formatting TEXT NOT NULL DEFAULT '{}',group_id INTEGER,created TEXT NOT NULL,updated TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,completed_at TEXT,reminder_at TEXT,reminder_sent INTEGER NOT NULL DEFAULT 0,always_on_top INTEGER NOT NULL DEFAULT 0,desktop_x REAL,desktop_y REAL,desktop_w REAL,desktop_h REAL); CREATE TABLE IF NOT EXISTS regions(id INTEGER PRIMARY KEY,title TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,w REAL NOT NULL,h REAL NOT NULL,kind TEXT NOT NULL,color TEXT NOT NULL); CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS workspaces(id INTEGER PRIMARY KEY,name TEXT NOT NULL,bg_color TEXT NOT NULL,bg_image TEXT,bg_fit TEXT NOT NULL DEFAULT 'cover',bg_opacity REAL NOT NULL DEFAULT 1,grid INTEGER NOT NULL DEFAULT 1,zoom REAL NOT NULL DEFAULT 1,shift_x REAL NOT NULL DEFAULT 40,shift_y REAL NOT NULL DEFAULT 45,sort_order INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL);")?;

    // Columns added after the first release: add them to old databases.
    // To add a new column later, append a (name, definition) pair here.
    for (name, definition) in [
        ("completed", "INTEGER NOT NULL DEFAULT 0"),
        ("completed_at", "TEXT"),
        ("reminder_at", "TEXT"),
        ("reminder_sent", "INTEGER NOT NULL DEFAULT 0"),
        ("always_on_top", "INTEGER NOT NULL DEFAULT 0"),
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

    // One-time change: pinned notes sit on the desktop layer by default,
    // so older notes that had "always on top" switched on are reset once.
    let layer_migrated: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM app_settings WHERE key='pin_layer_v2')",
        [],
        |row| row.get(0),
    )?;
    if !layer_migrated {
        conn.execute("UPDATE notes SET always_on_top=0", [])?;
        conn.execute("INSERT INTO app_settings(key,value) VALUES('pin_layer_v2','1')", [])?;
    }

    // ---- Workspaces ----
    // 1. notes and regions get a workspace_id column.
    for table in ["notes", "regions"] {
        let exists: bool = conn.query_row(
            &format!("SELECT EXISTS(SELECT 1 FROM pragma_table_info('{table}') WHERE name='workspace_id')"),
            [],
            |row| row.get(0),
        )?;
        if !exists {
            conn.execute(&format!("ALTER TABLE {table} ADD COLUMN workspace_id INTEGER"), [])?;
        }
    }
    // 2. There is always at least one workspace. The old global camera becomes its camera.
    let workspace_count: i64 = conn.query_row("SELECT COUNT(*) FROM workspaces", [], |row| row.get(0))?;
    if workspace_count == 0 {
        let view = workspace_view_from_connection(conn);
        conn.execute(
            "INSERT INTO workspaces(name,bg_color,bg_image,bg_fit,bg_opacity,grid,zoom,shift_x,shift_y,sort_order,created) VALUES('My workspace','#f8f7f3',NULL,'cover',1.0,1,?1,?2,?3,0,?4)",
            params![view.zoom, view.shift_x, view.shift_y, now_iso()],
        )?;
    }
    // 3. Anything without a workspace belongs to the first one.
    if let Some(first) = first_workspace_id(conn) {
        conn.execute("UPDATE notes SET workspace_id=?1 WHERE workspace_id IS NULL", [first])?;
        conn.execute("UPDATE regions SET workspace_id=?1 WHERE workspace_id IS NULL", [first])?;
    }
    Ok(())
}
