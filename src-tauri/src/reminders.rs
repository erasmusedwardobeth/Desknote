//! reminders.rs — fires a system notification when a note's reminder time arrives.
//!
//! A background thread wakes every 15 seconds, finds notes whose `reminder_at`
//! has passed and that are not completed, marks them `reminder_sent=1` (so they
//! fire only once) and shows the notification.

use crate::state::AppState;
use crate::util::now_iso;
use std::{thread, time::Duration};
use tauri::{AppHandle, Manager};

pub fn start_reminder_scheduler(app: AppHandle) {
    thread::spawn(move || loop {
        thread::sleep(Duration::from_secs(15));

        // Step 1: collect the notes that are due.
        let due = {
            let state = app.state::<AppState>();
            let Ok(conn) = state.0.lock() else { continue };
            let Ok(mut statement) = conn.prepare("SELECT id,title FROM notes WHERE reminder_at IS NOT NULL AND reminder_at <= ?1 AND reminder_sent=0 AND completed=0") else { continue };
            let now = now_iso();
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

        // Step 2: mark each as sent and show its notification.
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
