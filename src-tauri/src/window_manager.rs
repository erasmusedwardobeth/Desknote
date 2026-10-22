//! window_manager.rs — everything about OS windows.
//!
//! Two kinds of windows exist:
//!   * "main"      the workspace. Closing it with X only HIDES it (see configure_main_window).
//!   * "note-<id>" one borderless window per pinned note, created by create_pinned_window.
//!                 They are separate windows, so hiding the workspace does not close them.
//!
//! Frontend wrappers: src/api/windows.js

use crate::database::note_by_id;
use crate::desktop_layer;
use crate::models::Note;
use crate::state::{db, AppState};
use crate::util::now_iso;
use rusqlite::params;
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

/// Opens the desktop window for `note`, or updates it if it is already open.
/// The window loads index.html?note=<id>, which src/App.jsx turns into <PinnedNoteWindow>.
pub fn create_pinned_window(app: &AppHandle, note: &Note) -> Result<(), String> {
    let id = note
        .id
        .ok_or_else(|| "Save the note before pinning it".to_string())?;
    let label = format!("note-{id}");

    // Already open → just refresh title, size, position and always-on-top.
    if let Some(window) = app.get_webview_window(&label) {
        window.set_title(&note.title).map_err(|e| e.to_string())?;
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
        desktop_layer::apply(&window, note.always_on_top)?;
        window.show().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Not open yet → create it.
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
        .skip_taskbar(true)
        .visible(false) // shown only after it is placed on the right layer
        .build()
        .map_err(|e| e.to_string())?;
    desktop_layer::apply(&window, note.always_on_top)?;
    window.show().map_err(|e| e.to_string())?;

    // A pinned note cannot be closed with the OS; moving/resizing it is remembered.
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

/// Frontend: pinNote(note) — show the note on the desktop.
#[tauri::command]
pub fn pin_note(note: Note, app: AppHandle) -> Result<(), String> {
    create_pinned_window(&app, &note)
}

/// Closes the desktop window of a note, if it has one. The note itself is kept.
pub fn close_pinned_window(app: &AppHandle, id: i64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&format!("note-{id}")) {
        window.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Frontend: unpinNote(id) — close the desktop window (the note itself is kept).
#[tauri::command]
pub fn unpin_note(id: i64, app: AppHandle) -> Result<(), String> {
    close_pinned_window(&app, id)
}

/// Frontend: setNotePinned(id, pinned) — THE way to pin or unpin.
/// Updates the database AND opens/closes the desktop window as ONE operation, so a note
/// can never be marked pinned without a window. If the window cannot be created, the
/// database change is undone and the error text is returned to the screen.
/// It is `async` so window creation never blocks the app's main thread.
#[tauri::command]
pub async fn set_note_pinned(
    id: i64,
    pinned: bool,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Note, String> {
    let note = {
        let conn = db(&state)?;
        let changed = conn
            .execute(
                "UPDATE notes SET pinned=?1,updated=?2 WHERE id=?3",
                params![pinned as i64, now_iso(), id],
            )
            .map_err(|e| e.to_string())?;
        if changed != 1 {
            return Err("This note no longer exists".into());
        }
        note_by_id(&conn, id)?
    };
    if pinned {
        if let Err(error) = create_pinned_window(&app, &note) {
            if let Ok(conn) = db(&state) {
                let _ = conn.execute("UPDATE notes SET pinned=0 WHERE id=?1", [id]);
            }
            return Err(format!("Could not open the desktop window: {error}"));
        }
    } else {
        close_pinned_window(&app, id)?;
    }
    let _ = app.emit("notes-changed", id);
    Ok(note)
}

/// Temporarily switches a pinned note to an interactive window hint during mouse gestures.
#[tauri::command]
pub fn set_pinned_window_interactive(
    id: i64,
    active: bool,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let conn = db(&state)?;
    let always_on_top: i64 = conn
        .query_row("SELECT always_on_top FROM notes WHERE id=?1", [id], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    drop(conn);
    if always_on_top != 0 {
        return Ok(());
    }
    if let Some(window) = app.get_webview_window(&format!("note-{id}")) {
        desktop_layer::set_interactive(&window, active)?;
    }
    Ok(())
}

/// Frontend: setNoteTitle(id, title) — keeps the OS window title in sync with the note.
#[tauri::command]
pub fn set_note_title(id: i64, title: String, app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&format!("note-{id}")) {
        window.set_title(&title).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Frontend: toggleAlwaysOnTop(id) — flips "float above windows" (true) / "sit on the desktop layer" (false).
/// Returns the new value.
#[tauri::command]
pub fn toggle_always_on_top(
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
        params![next as i64, now_iso(), id],
    )
    .map_err(|e| e.to_string())?;
    drop(conn);
    if let Some(window) = app.get_webview_window(&format!("note-{id}")) {
        desktop_layer::apply(&window, next)?;
    }
    Ok(next)
}

/// Saves a pinned window's new position (size = None) or size (size = Some) to the database.
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
            params![w, h, now_iso(), id],
        );
    } else {
        let _ = conn.execute(
            "UPDATE notes SET desktop_x=?1,desktop_y=?2,updated=?3 WHERE id=?4",
            params![x, y, now_iso(), id],
        );
    }
}

/// Frontend: hideWorkspace() — hides the main window. Pinned notes stay visible.
#[tauri::command]
pub fn hide_workspace(app: AppHandle) -> Result<(), String> {
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

/// Frontend: showWorkspace() — brings the main window back to the front.
#[tauri::command]
pub fn show_workspace(app: AppHandle) -> Result<(), String> {
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

/// Frontend: quitApp() — exits the whole app (closes pinned notes too).
#[tauri::command]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Called once at startup. Makes the X button of the workspace HIDE it instead of
/// closing (so pinned notes keep running), and starts it hidden when launched at login.
pub fn configure_main_window(app: &AppHandle, background: bool) {
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
