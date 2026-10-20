//! lib.rs — the Rust entry point. It only wires modules together and starts the app.
//!
//! Where things live (see also docs/FILE-MAP.md):
//!   models.rs          data shapes: Note, Region, WorkspaceView, BackupFile
//!   database.rs        SQLite schema, migrations and row → struct conversion
//!   state.rs           AppState (the shared database connection)
//!   util.rs            small helpers (current time)
//!   commands/          everything the frontend can call with invoke(...)
//!       notes.rs, regions.rs, settings.rs, backup.rs
//!   window_manager.rs  pinned note windows, hiding/showing the workspace, quitting
//!   reminders.rs       background thread that fires reminder notifications

mod commands;
mod database;
mod models;
mod reminders;
mod state;
mod util;
mod window_manager;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

use state::AppState;

/// True when the app was started by "launch at login" (it then starts hidden).
fn should_start_hidden() -> bool {
    std::env::args().any(|arg| arg == "--background")
}

/// Builds and runs the Tauri app. Called from main.rs.
pub fn run() {
    let mut builder = tauri::Builder::default().plugin(
        tauri_plugin_autostart::Builder::new()
            .args(["--background"])
            .build(),
    );
    builder = builder.plugin(tauri_plugin_notification::init());
    builder = builder.plugin(tauri_plugin_dialog::init());

    // A second launch of the app just brings the existing workspace to the front.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = window_manager::show_workspace(app.clone());
        }));
    }

    builder
        .setup(|app| {
            // 1. Open (or create) the database in the app's data folder.
            let path = app.path().app_data_dir()?;
            std::fs::create_dir_all(&path)?;
            let conn = Connection::open(path.join("desknote.sqlite3"))?;
            database::migrate_schema(&conn)?;
            let pinned = database::pinned_notes(&conn)?;

            // 2. Share the connection with every command.
            app.manage(AppState(Mutex::new(conn)));

            // 3. Start background work and restore windows.
            reminders::start_reminder_scheduler(app.handle().clone());
            for note in &pinned {
                let _ = window_manager::create_pinned_window(app.handle(), note);
            }
            window_manager::configure_main_window(app.handle(), should_start_hidden());
            Ok(())
        })
        // Every command the frontend may call must be listed here.
        .invoke_handler(tauri::generate_handler![
            commands::notes::list_notes,
            commands::notes::save_note,
            commands::notes::complete_note,
            commands::notes::delete_note,
            commands::regions::list_regions,
            commands::regions::save_region,
            commands::regions::delete_region,
            commands::settings::get_workspace_view,
            commands::settings::save_workspace_view,
            commands::settings::set_autostart,
            commands::settings::get_autostart,
            commands::backup::export_backup,
            commands::backup::import_backup,
            window_manager::pin_note,
            window_manager::unpin_note,
            window_manager::set_note_title,
            window_manager::toggle_always_on_top,
            window_manager::hide_workspace,
            window_manager::show_workspace,
            window_manager::quit_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running Desknote");
}
