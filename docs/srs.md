# Desknote Software Requirements Specification

**Status:** Working baseline; proposals are explicit defaults pending implementation evidence  
**Revision:** 0.1  
**Date:** 2026-10-05

## 1. Purpose

This document defines observable requirements for Desknote. Requirements are not considered accepted until reviewed with the user. Each requirement should later map to design elements and verification cases.

## 2. Product context

Desknote is a desktop app with (a) individually visible desktop notes and (b) a freeform frame/grouping workspace. It should store data locally by default and ship as compiled desktop packages for Linux, Windows, and macOS. Existing implementation details are summarized in the root README; they do not override the requirements here.

## 3. Functional requirements

### Notes and pinning

- **FR-001 (Proposed):** The user shall be able to create, edit, save, and delete a note.
- **FR-002 (Proposed):** A note shall support a title, body, color, position, and size.
- **FR-003 (Proposed):** The user shall be able to pin and unpin a note to control its desktop visibility.
- **FR-004 (Proposed):** At startup, Desknote shall show only notes marked pinned; unpinned notes shall remain available in the workspace or note collection.
- **FR-005 (Proposed):** A pinned note shall not be dismissed or minimized by Ctrl+D or ordinary window-close action. Its ellipsis menu shall provide **Unpin from desktop**; selecting it removes the desktop window but preserves the note in the workspace.
- **FR-006 (Proposed):** Changes to a note shall persist across app restarts.

### Workspace and organization

- **FR-007 (Proposed):** The user shall be able to open a workspace for viewing and organizing notes.
- **FR-008 (Proposed):** The workspace shall support freeform placement, movement, and resizing of notes.
- **FR-009 (Proposed):** The user shall be able to create, rename, move, resize, and delete groups and frames. Deleting a group/frame shall not delete contained notes; notes become ungrouped and retain their coordinates.
- **FR-010 (Proposed):** The workspace shall support panning and zooming.
- **FR-011 (Proposed):** The user shall be able to associate a note with a group while retaining freeform placement.

### Planning and reminders

- **FR-012 (Proposed):** A note may have a due date and appear in a daily view when due today.
- **FR-013 (Proposed):** A weekly view shall show notes due in the current local calendar week, Monday through Sunday.
- **FR-014 (Proposed):** A note may contain checklist items whose completion state persists.
- **FR-015 (Deferred):** The system may support daily, weekly, monthly, and yearly recurrence. Exact schedule, timezone, missed-occurrence, and completion behavior must be specified before implementation.
- **FR-016 (Proposed):** Completing a task note shall retain it in a Completed view with completion timestamp. Completed notes are excluded from active daily/weekly views by default. Checklist item completion state is retained.
- **FR-027 (Proposed):** The user may configure a local reminder date/time for a note. Reminders are off by default and shall not require network access.
- **FR-028 (Proposed):** The user shall be able to mark a task note complete and reopen it from the Completed view.

### App lifecycle and platform

- **FR-017 (Proposed):** The user shall be able to enable or disable launch at user login.
- **FR-018 (Proposed):** While pinned desktop notes are visible and the frame/grouping workspace is closed or minimized, Desknote shall not appear as a running app in the taskbar. While the workspace is displayed, Desknote shall appear in the taskbar. Behavior must be mapped to each supported OS’s taskbar/dock conventions.
- **FR-019 (Proposed):** The user shall be able to reopen the workspace from a pinned note while desktop notes are visible.
- **FR-025 (Proposed):** The user shall be able to reopen the frame/grouping workspace from the operating system application launcher while Desknote is resident without a taskbar entry. Launching again shall restore the existing app process rather than create a duplicate instance.
- **FR-026 (Proposed):** Unpinning the final desktop note while the workspace is hidden shall leave Desknote resident with no taskbar entry. Launching the app again from the OS application launcher shall display the workspace.
- **FR-023 (Proposed):** Ctrl+D shall minimize the frame/grouping workspace when it is displayed, while leaving all pinned desktop notes visible. Ctrl+D shall not minimize pinned desktop notes.
- **FR-020 (Proposed):** When the user closes the frame/grouping workspace while pinned notes exist, Desknote shall remain running in the background and keep pinned notes visible. This action shall not terminate the process or dismiss pinned notes. The taskbar entry shall be hidden while the workspace is closed and return when it is displayed again.

### Data

- **FR-021 (Proposed):** Notes, pin state, desktop/workspace layout, groups/frames, due dates, reminders, completion state, and checklist state shall be stored locally.
- **FR-022 (Proposed):** The product shall provide a manual local export and restore path before a stable 1.0 release. Automatic cloud backup is out of scope.

## 4. Quality requirements

- **QR-001 Portability (Proposed):** The app shall be buildable and distributable for Linux, Windows, and macOS in the first desktop release. Android is deferred to a later phase. Exact minimum OS versions and Linux distributions remain for release validation. Proposed initial formats are Linux deb, Windows NSIS, and macOS DMG; portable builds are deferred.
- **QR-002 Local-first (Proposed):** Core note and workspace functions shall work without an internet connection. Network use, if any, shall be documented and opt-in or otherwise explicitly approved.
- **QR-003 Data integrity (Proposed):** A successful save shall survive normal app restart; interrupted writes shall not corrupt the whole collection.
- **QR-004 Usability (Proposed):** Pin/unpin, open workspace, save, minimize/close workspace, and app activation actions shall be discoverable and operable by mouse and keyboard.
- **QR-005 Accessibility (Proposed):** Controls shall have accessible names, visible focus, and keyboard operation; contrast and screen-reader behavior should be checked on supported platforms.
- **QR-006 Performance (Proposed):** On a supported reference device with 500 notes, the workspace shall become interactive within 3 seconds after launch; note edits and pin/unpin actions shall visibly respond within 150 ms, excluding OS scheduling delays.
- **QR-007 Privacy (Proposed):** User content shall remain local unless a future explicitly approved feature requires external transfer.
- **QR-008 Reliability (Proposed):** The app shall restore persisted pinned notes after a crash/restart and avoid opening duplicate background processes when launched again. An abnormal shutdown shall not corrupt the full note database.

## 5. Acceptance criteria examples

- When the app starts with a mix of pinned and unpinned notes, pinned notes appear as desktop notes and unpinned notes do not.
- Closing or pressing Ctrl+D on a pinned note does not dismiss it; choosing Unpin from its ellipsis menu removes it from desktop display while preserving it in the collection.
- After saving a note, logging out/restarting the OS and starting Desknote restores its content and pin state.
- A user can switch between desktop notes and workspace without losing either window state or saved layout; closing/minimizing the workspace leaves the app resident and pinned notes visible.

## 6. Decision register

- **DR-001 (Resolved):** Initial desktop targets are Linux, Windows, and macOS; Android is deferred. Exact minimum OS versions and Linux distributions remain for the release gate.
- **DR-002 (Resolved by proposed default):** Closing the workspace keeps the app resident and pinned notes visible. A pinned note can only be dismissed by unpinning it from its ellipsis menu.
- **DR-003 (Resolved by proposed default):** Pinned notes are always-on-top, movable, and resizable. Users can disable always-on-top per note in its menu if needed.
- **DR-004 (Resolved by proposed default):** Initial packages: Linux deb for Ubuntu/Debian-family target; Windows NSIS setup executable; macOS signed/notarized DMG containing an app bundle. Portable packages are deferred. Minimum OS versions will be published after CI/device validation.
- **DR-005 (Deferred):** Recurrence is stored but does not auto-advance in the first release.
- **DR-006 (Resolved by proposed default):** First release preserves completed task notes in a Completed view with timestamps; checklist completion state also persists.
- **DR-007 (Resolved by proposed default):** Local export/import is planned before stable 1.0; no cloud backup.
- **DR-008 (Resolved by proposed default):** Daily and weekly are filtered board views, with the current local day and Monday–Sunday week boundaries.
- **DR-009 (Resolved by proposed default):** Follow native platform conventions while preserving the intent: no running-app indicator in notes-only mode; show app presence when workspace is displayed.
- **DR-010 (Resolved by proposed default):** Unpinning the last note while workspace is hidden leaves the app resident invisibly; opening Desknote again from the OS launcher displays the workspace.
- **DR-011 (Proposed):** Use local desktop notifications only when the user explicitly enables a reminder on a note. Default reminder time is user-selected; recurring reminders do not auto-advance in release one.
- **DR-012 (Resolved by proposed default):** Completed tasks remain available in a Completed view with completion timestamp; active daily/weekly views omit completed tasks by default.

## 7. Traceability

Use requirement IDs in design notes and verification cases. The [verification plan](verification-plan.md) maps requirements to planned checks. Proposed defaults guide implementation; update the decision register when platform spikes or user feedback change a decision.
