# Desknote

A local-first desktop focus board built with Tauri 2, Rust, React/JSX, Vite, and SQLite. The initial desktop targets are Linux, Windows, and macOS. The app makes no network requests for note data.

## Requirements

- Rust stable
- Node.js and npm
- On Ubuntu 22.04: GTK 3, WebKitGTK 4.1, JavaScriptCoreGTK 4.1, libsoup 3, OpenSSL, and build tools

Install the Linux build dependencies on Ubuntu:

```sh
sudo apt update
sudo apt install build-essential curl wget file libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev libwebkit2gtk-4.1-dev
```

Install frontend packages and start the app:

```sh
npm install
npm run tauri dev
```

Build frontend assets:

```sh
npm run build
```

Build a package for the current OS:

```sh
npm run tauri build
```

Platform bundle targets are defined in `src-tauri/tauri.*.conf.json`: Linux deb, Windows NSIS setup, and macOS DMG. The current Linux deb is at `src-tauri/target/release/bundle/deb/Desknote_0.1.0_amd64.deb`. Windows and macOS builds need to be produced and verified on their respective build environments; macOS releases need signing and notarization.

## Current implementation

- React/JSX workspace with Everything, Daily, Weekly, and Completed views
- Freeform canvas with panning, zoom, movable notes, groups, and frames
- Note editor with colors, due dates, recurring tasks, opt-in reminders, and checklists; completing a recurring task creates its next occurrence
- Individual pinned-note windows, restored from local SQLite on startup
- Pinned notes stay above windows by default and can be moved/resized independently from canvas positions
- Note ellipsis menu with Open workspace, Edit, Unpin, and always-on-top controls
- Workspace close or Ctrl+D hides the workspace while leaving the app and pinned notes running
- Workspace taskbar entry is hidden in notes-only mode on Windows/Linux; macOS switches Dock visibility/activation policy when hiding or showing workspace
- OS launcher activation focuses the existing app instance instead of opening a second copy
- Optional launch-at-login setting; login launch opens pinned notes in the background mode
- Settings panel with JSON backup export, validated replacement restore, an automatic recovery copy, and keyboard shortcut guidance
- Canvas pan/zoom preferences persist across sessions and are included in backups
- Explicit Quit action in Settings; closing the workspace itself continues to keep Desknote running in the background
- Local SQLite data under the OS app data directory; migrations add newer note fields without deleting existing notes

## Known implementation gaps

This is an active implementation. Local reminders are opt-in, request notification permission when configured, and fire once when due while Desknote is running. Local JSON backup/restore creates a recovery copy before replacing data. Recurring tasks create their next occurrence when completed. Broader screen-reader accessibility and platform-specific lifecycle verification remain to be completed. macOS Dock and multi-window behavior still needs an actual macOS build and user-session check. Notifications depend on the operating system's notification service and permission settings.
