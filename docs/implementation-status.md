# Desknote Implementation Status

**Updated:** 2026-10-07  
**Status:** Initial implementation underway

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

- `npm run build` — passed.
- `cargo check` — passed on the current Linux environment.
- Linux `.deb` package — an earlier package exists at `src-tauri/target/release/bundle/deb/Desknote_0.1.0_amd64.deb`, but it predates the reminder implementation. The current reminder-enabled release build was interrupted before completion.
- Automated tests were not added or run.

## Still to implement or verify

- Run the packaged app and validate window close, restore, taskbar/Dock, startup, monitor changes, and multi-window behavior on Linux, Windows, and macOS.
- macOS runtime behavior is unverified; the implementation switches Dock visibility and activation policy, but requires a signed app build check.
- Exercise reminder permission, scheduled delivery, overdue delivery after restart, and one-shot behavior in the packaged app.
- Manually exercise backup/restore, recurrence boundaries, checklist persistence, and keyboard controls in the packaged app.
- Add broader screen-reader support and verify keyboard focus/interaction with assistive technology.
- Verify Completed history retention and reopen/delete behavior in the packaged app.
- Windows/macOS installers, signing/notarization, and platform-specific installation guidance. Linux package runtime/install behavior still needs an end-to-end check.
