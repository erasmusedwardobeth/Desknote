//! commands/ — every function the frontend can call with `invoke('name', {...})`.
//! One file per area. Each command must also be listed in lib.rs → generate_handler!.
//! The matching JavaScript wrappers live in src/api/.

pub mod backup;    // export_backup, import_backup
pub mod notes;     // list_notes, save_note, complete_note, delete_note
pub mod regions;   // list_regions, save_region, delete_region
pub mod settings;  // workspace view (zoom/pan), launch at login
