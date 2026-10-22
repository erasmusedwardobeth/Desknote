//! models.rs — the data shapes shared by Rust, SQLite and the JS frontend.
//!
//! `#[serde(rename_all = "camelCase")]` means a Rust field `group_id` is sent to
//! JavaScript as `groupId`. When you add a field here, also add it to:
//!   1. database.rs  (the table, NOTE_SELECT, note_from_row, migrate_schema)
//!   2. commands/notes.rs and commands/backup.rs  (the INSERT/UPDATE statements)
//!   3. src/lib/noteUtils.js  (defaultNote in the frontend)

use serde::{Deserialize, Serialize};

/// One sticky note.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: Option<i64>,
    pub title: String,
    pub body: String,
    /// Position and size on the workspace canvas.
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub color: String,
    /// Is the note shown as its own window on the desktop?
    pub pinned: bool,
    /// Due date "YYYY-MM-DD".
    pub due: Option<String>,
    /// "daily" | "weekly" | "monthly" | "yearly"
    pub recurrence: Option<String>,
    /// JSON text: [{ "text": "...", "done": false }, ...]
    pub checklist: String,
    pub formatting: String,
    /// The group (Region) this note belongs to.
    pub group_id: Option<i64>,
    pub created: Option<String>,
    pub updated: Option<String>,
    #[serde(default)]
    pub completed: bool,
    #[serde(default)]
    pub completed_at: Option<String>,
    #[serde(default)]
    pub reminder_at: Option<String>,
    #[serde(default)]
    pub reminder_sent: bool,
    /// true = this pinned note FLOATS above other windows; false (default) = it sits
    /// on the desktop layer, below your apps (see desktop_layer.rs).
    #[serde(default)]
    pub always_on_top: bool,
    /// Position and size of the pinned desktop window.
    #[serde(default)]
    pub desktop_x: Option<f64>,
    #[serde(default)]
    pub desktop_y: Option<f64>,
    #[serde(default)]
    pub desktop_w: Option<f64>,
    #[serde(default)]
    pub desktop_h: Option<f64>,
}

/// A group (filled box) or frame (dashed outline) drawn on the canvas.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Region {
    pub id: Option<i64>,
    pub title: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    /// "group" or "frame"
    pub kind: String,
    pub color: String,
}

/// The workspace camera: zoom and pan offset.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceView {
    pub zoom: f64,
    pub shift_x: f64,
    pub shift_y: f64,
}

/// Camera used when nothing has been saved yet.
pub fn default_workspace_view() -> WorkspaceView {
    WorkspaceView {
        zoom: 1.0,
        shift_x: 40.0,
        shift_y: 45.0,
    }
}

/// The JSON file written by "Export backup".
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    pub format_version: u32,
    pub app: String,
    pub exported_at: String,
    pub notes: Vec<Note>,
    pub regions: Vec<Region>,
    #[serde(default = "default_workspace_view")]
    pub workspace_view: WorkspaceView,
}
