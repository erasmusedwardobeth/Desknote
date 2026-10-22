# Foundation logic (no UI yet) — modules and the phase that uses each

All of these are PURE functions (no React, no Tauri, no database). They are tested in `tests/`.
Run the tests any time:   node --test tests/*.test.mjs
(If Node says "Cannot use import statement", add  "type": "module"  to package.json.)

| Module                  | What it does                                                        | Used by phase |
|-------------------------|---------------------------------------------------------------------|---------------|
| `src/lib/tree.js`       | Builds the left-panel outline: workspace > frame/group > note; search filter; ancestors; visible rows | 3.1 left panel |
| `src/lib/selection.js`  | Click / shift-click / click-empty / marquee / range selection        | 3.1 and 3.3   |
| `src/lib/history.js`    | Undo / redo stacks with drag-merge                                   | 3.3           |
| `src/lib/transform.js`  | 8-handle resize (min size, keep aspect), snap guides, align, distribute | 3.3        |
| `src/lib/zoom.js`       | Zoom toward the cursor, fit-to-content, wheel factor, object zoom    | 3.4           |

## Design decisions these modules assume (they will be implemented in phase 3.1)
1. Every note and region gets a `workspaceId`. Items WITHOUT one (old data) belong to the FIRST workspace.
2. A note's `groupId` may point at a group OR a frame. That is how the tree knows a frame's children.
   (Backup validation in commands/backup.rs currently requires a group; phase 3.1 relaxes that.)
3. Selection ids are the same strings as tree ids: "note:12", "frame:3", "group:5", "workspace:1".
4. Undo entries are lists of patches ({op, kind, id, props}); the app applies them and saves through api/*.js.

## What is NOT verified by these tests
They prove the logic. They do not prove how it looks or that Rust/SQLite/window behavior works;
each phase ends with a manual test table for that.
