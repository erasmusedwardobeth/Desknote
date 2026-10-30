# Phase 3 — manual test table (workspaces, panels, selection, menus, backgrounds)
Report pass / fail per row (and any message shown on screen or printed in the terminal).

## First launch
| # | Do this | Expected |
|---|---------|----------|
| 1 | Start the app | Blue splash screen, then the workspace "My workspace" with ALL your old notes and groups |
| 2 | Look in `~/.local/share/app.desknote.personal/` | A file `desknote.before-workspaces.sqlite3` (a copy of your data from before the upgrade) |

## Workspaces and the layers tree (left panel)
| 3 | Click "＋ New workspace" | A new row "Workspace 2" appears with its name ready to type; Enter keeps it |
| 4 | Click the new workspace row | The canvas becomes empty; the old notes are not shown |
| 5 | Click your first workspace row | Its notes are back, camera (zoom/position) as you left it |
| 6 | Expand a workspace row (▸) | Frames/groups with their notes, then loose notes |
| 7 | Click a note row | It is selected (blue outline) and scrolled into view if needed |
| 8 | Select a note on the canvas | Its row highlights in the tree |
| 9 | Double-click a row, or select and press F2 | Name becomes editable; Enter saves, Esc cancels |
| 10 | Type in the search box (or Ctrl+F) | Only matching rows and their parents remain |
| 11 | Right-click a workspace row → Duplicate | "<name> copy" with the same notes (not pinned) |
| 12 | Right-click a workspace row → Delete workspace… | Asks, naming how many notes; then it is gone; the last workspace cannot be deleted |

## Selection and the canvas
| 13 | Click a note, then click empty canvas | Selection clears |
| 14 | Drag a rectangle on empty canvas | Notes touched by it are selected |
| 15 | Shift-click two notes | Both selected; right panel shows "2 objects selected" |
| 16 | Drag one of two selected notes | Both move |
| 17 | Hold Space and drag, or drag with the middle button | The canvas pans |
| 18 | Drag a frame | Its notes move with it |
| 19 | Drag a note INTO a frame, then out of it | The tree shows it under the frame, then loose again |

## Right panel and background
| 20 | Nothing selected: click a background color swatch | Canvas color changes at once; survives restart |
| 21 | "Choose image…" and pick a LARGE photo (more than 5 MB) | Image appears; no size error. A copy exists in `~/.local/share/app.desknote.personal/images/` |
| 22 | Change Layout (Fill/Fit/Tile/Center) and Opacity | Canvas updates |
| 23 | Delete or move the ORIGINAL photo, restart the app | Background still shows (the app uses its own copy) |
| 24 | Remove image; toggle "Show dot grid" | Image disappears; dots on/off |
| 25 | Select one note: edit title, color, X/Y/W/H, tick a task | All update on the canvas and persist |

## Context menus (right-click)
| 26 | Right-click a note | Edit, Pin, Complete, Duplicate, Color, Move to group or frame, Delete |
| 27 | Right-click a frame/group | Rename, Color, Select contents, Pin/Unpin all inside, Delete |
| 28 | Right-click empty canvas | New note/group/frame here, Select all, Zoom, Change background…, Pin/Unpin all |
| 29 | With several selected, right-click one | Align, Distribute, Color, Delete N objects |
| 30 | Menu near the screen edge; press Esc; click elsewhere | Stays on screen; both close it |

## Zoom (your rule)
| 31 | Nothing selected, scroll the wheel over the canvas (no Ctrl) | The WORKSPACE zooms toward the cursor |
| 32 | Select ONE note, scroll the wheel | That NOTE scales (about its centre); the workspace does not move |
| 33 | Ctrl + = , Ctrl + − , Ctrl+0, Ctrl+1 | Zoom in / out / 100% / fit (note if one is selected, else workspace) |
| 34 | Switch workspaces back and forth | Each keeps its own zoom and position |

## Other
| 35 | Settings → Export backup, then Restore backup | Everything (workspaces, backgrounds, notes) returns; a recovery copy path is shown |
| 36 | Hide/show the left and right panels with the ◧ ◨ buttons | They hide and come back; the choice is remembered |
