//! commands/notes.rs — create, read, update, complete and delete notes.
//! Frontend wrappers: src/api/notes.js
//! The SQL itself lives in database.rs (insert_note / update_note).

use crate::database::{all_notes, first_workspace_id, insert_note, note_by_id, update_note};
use crate::models::Note;
use crate::state::{db, AppState};
use crate::util::now_iso;
use tauri::{AppHandle, Emitter, Manager, State};

/// All notes of all workspaces.
#[tauri::command]
pub fn list_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let conn = db(&state)?;
    all_notes(&conn)
}

/// Inserts (id is None) or updates (id is Some) a note and returns it as stored.
/// A new note without a workspace goes into the first workspace.
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
    let saved = if let Some(id) = note.id {
        let changed = update_note(&conn, id, &note, &now).map_err(|e| e.to_string())?;
        if changed == 0 {
            return Err("This note no longer exists".into());
        }
        note_by_id(&conn, id)?
    } else {
        if note.workspace_id.is_none() {
            note.workspace_id = first_workspace_id(&conn);
        }
        note.created = Some(now.clone());
        note.updated = Some(now);
        let id = insert_note(&conn, &note, false).map_err(|e| e.to_string())?;
        note_by_id(&conn, id)?
    };
    drop(conn);
    let _ = app.emit("notes-changed", saved.id);
    Ok(saved)
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
    let changed = update_note(&transaction, id, &note, &now).map_err(|error| error.to_string())?;
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
        insert_note(&transaction, &next, false).map_err(|error| error.to_string())?;
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
