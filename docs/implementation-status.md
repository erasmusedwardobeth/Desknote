# Desknote Implementation Status

**Updated:** 2026-11-05
**Status:** Existing implementation extended; desktop integration remains partially verified

## Current repository-onboarding update (2026-11-05)

- Preserved the already modified workspace and style files present before this change.
- Added the persisted note presentation discriminator and additive legacy migration; available values are sticky, paper, parchment, and task-list.
- Registered the pre-existing pinned arrange, move, and resize Rust commands that were missing from Tauri's command handler.
- Added implementation-level architecture, widget API, platform adapter, desktop integration, development, and root README documentation.
- The current session is Ubuntu Wayland (`DESKTOP_SESSION=ubuntu`, `XDG_SESSION_TYPE=wayland`). The Linux adapter requests GTK X11/XWayland and uses X11 window hints; compositor behavior has not been verified here.

## Implemented in this iteration

- Vite now compiles a React/JSX frontend.
- The workspace includes Everything, Daily, Weekly, and Completed views; notes can be edited, grouped, moved, resized, and pinned.
- Pinned notes open in independent, undecorated windows with an ellipsis menu for workspace access, editing, unpinning, and always-on-top control.
- Pinned note windows are restored from SQLite at app startup and keep separate desktop geometry from canvas geometry.
- Workspace close and Ctrl+D hide the workspace while keeping the process and pinned notes alive. The OS launcher activates the existing process.
- Login startup passes a background argument so startup shows pinned notes without displaying the workspace.
- Added a single-instance plugin and SQLite migrations for completion, reminders, always-on-top, and desktop geometry fields.
- Added an opt-in local reminder datetime control, notification permission request, and native scheduler that sends each reminder once while the app is running (including overdue reminders found after restart).
- Added local JSON backup export and replacement restore with format validation, a pre-restore recovery copy, and restoration of pinned note windows.
- Added recurring task advancement on completion, local calendar handling for daily/weekly/monthly/yearly intervals, and next-occurrence date clamping.
- Completed occurrences retain their completion timestamps in the Completed view until the user deletes them; recurring advancement preserves each completed occurrence.
- Added interactive checklist controls on pinned notes, keyboard movement/resizing/edit access on the canvas, and a Settings panel with startup, backup, and shortcut guidance.
- Persisted workspace zoom and pan state and included it in the local backup/restore data.
- Added platform-specific bundle target configuration for Linux deb, Windows NSIS, and macOS DMG.

## Build checks

- `npm test` — passed (51 tests).
- `npm run build` — passed.
- `CARGO_TARGET_DIR=/tmp/desknote-target cargo test --manifest-path src-tauri/Cargo.toml` — passed (2 Rust tests, including legacy migration and style round-trip).
- `CARGO_TARGET_DIR=/tmp/desknote-target npm run tauri build` — passed; produced a 5.66 MiB Debian bundle under `/tmp/desknote-target/release/bundle/deb/`.
- A 12-second `--background` launch attempt with temporary XDG data/config paths was stopped by the timeout before a test database appeared. Existing app-data database timestamps remained unchanged; application startup is therefore not confirmed by this attempt, and no interactive window behavior was exercised.

## Still to implement or verify

- Run the packaged app and validate window close, restore, taskbar/Dock, startup, monitor changes, and multi-window behavior on Linux, Windows, and macOS.
- The current Linux session is Ubuntu Wayland; the adapter requests X11/XWayland and window hints. Layering and Show Desktop behavior remain unverified for the active compositor.
- Implement genuinely independent widget-host lifecycle and true desktop-layer adapters for Windows/macOS; current pinned windows share the Tauri process and non-Linux fallback is always-on-top.
- Add structured rich-content blocks and complete style editing; current body editing is plain text, with serialized checklist/formatting fields retained.
- macOS runtime behavior is unverified; the implementation switches Dock visibility and activation policy, but requires a signed app build check.
- Exercise reminder permission, scheduled delivery, overdue delivery after restart, and one-shot behavior in the packaged app.
- Manually exercise backup/restore, recurrence boundaries, checklist persistence, and keyboard controls in the packaged app.
- Add broader screen-reader support and verify keyboard focus/interaction with assistive technology.
- Verify Completed history retention and reopen/delete behavior in the packaged app.
- Windows/macOS installers, signing/notarization, and platform-specific installation guidance. Linux package runtime/install behavior still needs an end-to-end check.
