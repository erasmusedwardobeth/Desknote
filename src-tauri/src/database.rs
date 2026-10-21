//! database.rs — everything about the SQLite schema and reading rows.
//!
//! Column ORDER matters: `NOTE_SELECT` lists columns in a fixed order and
//! `note_from_row` reads them by position (row.get(0), row.get(1) …).
//! If you add a column, add it to the END of both and to `migrate_schema`.

use crate::models::{default_workspace_view, Note, Region, WorkspaceView};
use rusqlite::Connection;

/// The columns read for a note, in the order note_from_row expects them.
pub const NOTE_SELECT: &str = "SELECT id,title,body,x,y,w,h,color,pinned,due,recurrence,checklist,formatting,group_id,created,updated,completed,completed_at,reminder_at,reminder_sent,always_on_top,desktop_x,desktop_y,desktop_w,desktop_h FROM notes";

/// The columns read for a region, in the order region_from_row expects them.
pub const REGION_SELECT: &str = "SELECT id,title,x,y,w,h,kind,color FROM regions";

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

/// Notes that should have a desktop window (used at startup to restore pinned notes).
pub fn pinned_notes(conn: &Connection) -> rusqlite::Result<Vec<Note>> {
    let mut statement = conn.prepare(&format!("{NOTE_SELECT} WHERE pinned=1 ORDER BY id"))?;
    let rows = statement
        .query_map([], note_from_row)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// The saved workspace camera, or the default if none is saved / it is unreadable.
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

/// Creates the tables if missing and adds any columns that older databases lack.
/// Safe to run on every start.
pub fn migrate_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,w REAL NOT NULL,h REAL NOT NULL,color TEXT NOT NULL,pinned INTEGER NOT NULL DEFAULT 0,due TEXT,recurrence TEXT,checklist TEXT NOT NULL DEFAULT '[]',formatting TEXT NOT NULL DEFAULT '{}',group_id INTEGER,created TEXT NOT NULL,updated TEXT NOT NULL,completed INTEGER NOT NULL DEFAULT 0,completed_at TEXT,reminder_at TEXT,reminder_sent INTEGER NOT NULL DEFAULT 0,always_on_top INTEGER NOT NULL DEFAULT 0,desktop_x REAL,desktop_y REAL,desktop_w REAL,desktop_h REAL); CREATE TABLE IF NOT EXISTS regions(id INTEGER PRIMARY KEY,title TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,w REAL NOT NULL,h REAL NOT NULL,kind TEXT NOT NULL,color TEXT NOT NULL); CREATE TABLE IF NOT EXISTS app_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);")?;

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

    // One-time change (Step 2): pinned notes now sit on the desktop layer by default,
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
    Ok(())
}
