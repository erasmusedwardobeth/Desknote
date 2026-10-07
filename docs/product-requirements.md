# Desknote Product Requirements Document

**Status:** Draft  
**Revision:** 0.1  
**Date:** 2026-10-05

## Product summary

Desknote is a personal desktop focus and planning app. It helps a person capture thoughts and tasks, keep selected notes visible on the desktop, and organize a larger collection on a freeform workspace. The product should be suitable for distribution as a compiled desktop executable and should avoid unnecessary dependence on cloud services.

## Problem and intended users

People can lose track of tasks and ideas when those items are hidden in separate apps or lists. Desknote is intended for an individual who wants important notes visible during normal computer use, with a broader workspace for arranging and reviewing them.

## Product goals

- Make user-pinned notes visible after app startup.
- Let users capture, edit, arrange, and revisit notes and tasks.
- Support daily and weekly review as well as freeform grouping.
- Keep user data local by default.
- Provide compiled desktop installers/packages for Linux, Windows, and macOS in the first release; consider portable builds later.

## Product principles

- Desktop notes and the organizing workspace have distinct roles.
- Pinning is an explicit user choice and controls whether a note appears on the desktop.
- The workspace remains freeform; hierarchy is optional.
- Technology choice follows product requirements and platform constraints.

## Core workflows

1. Create or edit a note, optionally schedule it, and pin or unpin it.
2. Start Desknote and see the notes that are pinned to the desktop.
3. Open the frame/grouping workspace to arrange notes and groups.
4. Review tasks in daily and weekly views.
5. Complete checklist items and retain a useful record of completed work.

Detailed interaction rules and unresolved questions are in [UX/UI design brief](ux-ui.md) and [SRS](srs.md).

## Scope proposal

### First release

- Local notes with title, body, color/style, and position/size.
- Multiple desktop note windows, with explicit pin/unpin behavior.
- Freeform workspace with groups/frames, drag, resize, and zoom.
- Due dates, opt-in local reminders, and daily/weekly views.
- Completed task view with a completion timestamp; automatic recurring-task advancement remains deferred.
- Local persistence and user-controlled launch at login.
- Installable packages for Linux, Windows, and macOS; portable builds are deferred.

### Later or decision pending

- Automatic advancement of recurring tasks using the local calendar when an occurrence is completed; the completed occurrence remains in the history.
- Rich hierarchy (aim → goal → objective → project → task → subtask).
- Sync, collaboration, mobile clients, and cloud storage.
- Advanced themes and note templates.

## Success measures (proposed)

- A user can create, pin, edit, unpin, and find a note without losing saved content.
- On relaunch, the desktop shows precisely the notes intended to be pinned.
- The app can be packaged and installed on each supported target OS.
- Users can understand the distinction between desktop notes and the organizing workspace.

## Constraints and assumptions

- The user knows JavaScript, React, Next.js, TypeScript, Python, and PyQt; JSX/React is a preferred frontend authoring style. This is a preference, not a mandate for Next.js specifically.
- Initial desktop targets are Linux, Windows, and macOS. Android is a possible later phase, not part of the first desktop release. The first release should use an installer or OS package on each desktop platform. Portable builds can be considered after the first release. A compiled desktop application is required.
- Offline/local-first behavior is desired. Manual local export/import is proposed before stable 1.0; cloud backup is out of scope.
- The existing repository uses Tauri 2, Rust, Vite, and SQLite. This is the current implementation, not an approved future architecture. The current proposed frontend direction is Tauri + Vite + React + JSX, pending a platform and multi-window integration spike.

## Open product decisions

See the [SRS decision register](srs.md#6-decision-register). Remaining release-gate work is to verify minimum OS versions and the proposed window/taskbar behavior on real target platforms.
