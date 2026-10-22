//! state.rs — data shared by every command.

use rusqlite::Connection;
use std::sync::{Mutex, MutexGuard};
use tauri::State;

/// The single SQLite connection, behind a Mutex so only one command uses it at a time.
/// Registered in lib.rs with `app.manage(AppState(...))`.
pub struct AppState(pub Mutex<Connection>);

/// Locks the database and returns the connection (or a readable error string).
/// Usage inside a command:  `let conn = db(&state)?;`
pub fn db<'a>(state: &'a State<'_, AppState>) -> Result<MutexGuard<'a, Connection>, String> {
    state.0.lock().map_err(|error| error.to_string())
}
