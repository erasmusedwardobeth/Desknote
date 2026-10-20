//! commands/notes.rs — create, read, update, complete and delete notes.
//! Frontend wrappers: src/api/notes.js

use crate::database::all_notes;
use crate::models::Note;
use crate::state::{db, AppState};
use crate::util::now_iso;
use rusqlite::params;
use tauri::{AppHandle, Emitter, Manager, State};

/// All notes.
#[tauri::command]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let conn = db(&state)?;
    all_notes(&conn)
}

/// Inserts (id is None) or updates (id is Some) a note and returns it with its id.
/// Emits "notes-changed" so every open window reloads.
#[tauri::command]
pub fn save_note(mut note: Note, state: State<'_, AppState>, app: AppHandle) -> Result<Note, String> {
    let conn = db(&state)?;
    let now = now_iso();
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

/// Marks a note completed. If it repeats (has `recurrence` and `due`), creates the
/// next occurrence in the SAME database transaction. Returns true if one was created.
#[tauri::command]
pub fn complete_note(
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
    let now = now_iso();
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

/// Deletes a note and closes its desktop window if it has one.
#[tauri::command]
pub fn delete_note(id: i64, state: State<'_, AppState>, app: AppHandle) -> Result<(), String> {
    db(&state)?
        .execute("DELETE FROM notes WHERE id=?1", [id])
        .map_err(|e| e.to_string())?;
    if let Some(window) = app.get_webview_window(&format!("note-{id}")) {
        let _ = window.destroy();
    }
    Ok(())
}
