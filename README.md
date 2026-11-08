# Desknote

Desknote is a local-first desktop app for organizing notes, tasks, groups, and workspaces. It uses a React workspace inside Tauri, stores data in SQLite, and can publish notes as separate desktop windows.

## Current features

- Multiple workspaces with independent canvas positions, zoom, pan, backgrounds, groups, and frames.
- Notes with sticky, paper, parchment, and task-list presentations.
- Checklists, due dates, recurrence, reminders, completion history, and JSON backup/restore.
- Pinned note windows restored when Desknote starts, with independent desktop position and size.
- Optional login autostart and workspace hiding while pinned windows remain open.

Presentation types share one note identity and body. The current editor supports plain text plus checklist data; rich text and media editing are not implemented.

## Run and build

Requirements: Node.js/npm, Rust, and the system libraries required by Tauri 2 and GTK/WebKitGTK on Linux.

```sh
npm install
npm run dev
```

Run the desktop app from another terminal with `npm run tauri dev`. Build the frontend with `npm run build`; build the desktop bundle with `npm run tauri build`.

Run JavaScript unit tests with `npm test` and Rust tests with `cargo test --manifest-path src-tauri/Cargo.toml`.

See [development guide](docs/DEVELOPMENT.md), [architecture](docs/ARCHITECTURE.md), and [desktop integration](docs/DESKTOP_INTEGRATION.md).
