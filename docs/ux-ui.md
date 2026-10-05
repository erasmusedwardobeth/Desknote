# Desknote UX/UI Design Brief

**Status:** Interaction baseline; visual styling and prototype still pending  
**Revision:** 0.1  
**Date:** 2026-10-05

## Design artifact location

Store design source files and exports in `docs/design/`. For external design tools, add stable links below with access instructions. No external design link has been provided yet.

- Design file: TBD
- Prototype: TBD
- Screenshots/reference: TBD

## Product surfaces

1. **Desktop notes:** Independent note windows for pinned items, visible after startup. Each note has a top-right ellipsis menu; unpinning there is the required dismissal path for pinned notes.
2. **Frame/grouping workspace:** A larger freeform space to see and organize notes, groups, and frames.
3. **Daily/weekly planning:** A focused way to review due notes and tasks.

## Core flows to design

- First launch and empty state.
- Create, edit, save, pin, and unpin a note.
- Startup with several pinned notes and unpinned notes.
- Open/minimize/restore/close the workspace while notes are visible; verify taskbar presence changes with workspace visibility and pinned notes remain visible after Ctrl+D or workspace close.
- Arrange notes into groups/frames; move and resize them.
- Review daily and weekly work; mark task notes/checklist items complete; find and reopen completed tasks.
- Set or clear an opt-in local reminder.
- Configure launch at login, close/minimize the workspace, and understand how to reopen it.

## Interaction rules from the user

- Startup should show only pinned notes.
- A pinned note should not be minimized by Ctrl+D or ordinary close; the top-right ellipsis menu and unpin action is how it is dismissed.
- The app should not appear as running on the taskbar while only pinned desktop notes are visible. It should appear on the taskbar while the frame/grouping workspace is displayed.
- Ctrl+D minimizes the frame/grouping workspace; pinned notes remain visible and are not minimized.
- Closing/leaving the workspace while pinned notes exist keeps Desknote running in the background with those notes visible. This is workspace close, not process quit.
- First release uses installers/OS packages for Linux, Windows, and macOS; portable builds and Android are later work.

## UI inventory to produce

- Desktop note window anatomy, including title, content, resize affordance, ellipsis menu, pin state, due indicator, and checklist affordance.
- Workspace anatomy, including navigation, canvas, group/frame appearance, zoom/pan, and selected-note editor.
- Daily/weekly view anatomy and empty/completed states; Completed view and reopen action.
- Settings and lifecycle states, including login start, taskbar/dock presence, and quit behavior. Specify native equivalents for dock-based platforms.

## UX acceptance checks

- Users can distinguish pinning (desktop presence) from grouping (workspace organization).
- The unpin action is discoverable in the note ellipsis menu.
- Users can always get back to the organizing workspace without losing pinned notes.
- Keyboard and pointer interactions have clear feedback and do not accidentally dismiss pinned notes.

## Current implementation reference

The current UI is in `src/main.js` and `src/style.css`. It uses a single main board and an editor dialog, with a pin action in the editor. This differs from the newly stated independent pinned-note windows and ellipsis dismissal behavior, so mockups and flow decisions should precede implementation changes.

## Proposed navigation and lifecycle flows

These flows address the fact that the taskbar entry is intentionally absent while only pinned notes are visible. They are proposed for review.

### Open the workspace

- From any pinned note, open its ellipsis menu and choose **Open workspace**.
- If no pinned note is available, launch Desknote again from the OS application launcher; the existing background process should display the workspace instead of starting a duplicate process.
- When the workspace is displayed, show the app in the taskbar (or native equivalent).

### Minimize or close the workspace

- **Ctrl+D** minimizes the workspace only.
- The workspace window's close button has the same effect when pinned notes exist: hide the workspace and keep Desknote resident.
- Keep pinned notes visible and remove the app's taskbar entry while the workspace is hidden.
- Reopening from a pinned note or the OS launcher restores the workspace and taskbar entry.

### Unpin a note

- Open the pinned note's ellipsis menu and select **Unpin from desktop**.
- Remove that note's desktop window and retain the note in the workspace collection.
- If the workspace is open, leave it open and show the now-unpinned note there.
- When the final pinned note is unpinned while the workspace is closed, keep Desknote resident invisibly. Launching Desknote from the OS launcher restores the workspace in the existing process.

## Low-fidelity screen outlines

### Pinned desktop note

```text
┌────────────────────────────────────┐
│ Note title                     [⋯] │
│                                    │
│ Note content / checklist           │
│                                    │
│ Due date · group (optional)        │
└────────────────────────────────────┘
      Ellipsis menu:
      ├─ Open workspace
      ├─ Edit note
      └─ Unpin from desktop
```

Pinned notes stay above other windows by default and can be moved/resized. They do not expose a minimize/dismiss control that violates pin state; their close affordance is omitted or intercepted. The ellipsis menu is the route to unpin. Always-on-top can be disabled per note.

### Workspace

```text
┌────────────────────────────────────────────────────────────────┐
│ Desknote   Everything | Daily | Weekly         Settings   +Note │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Freeform canvas: notes, groups and frames                    │
│   Pan · zoom · drag · resize                                    │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│ Ctrl+D minimizes workspace; pinned notes remain on desktop     │
└────────────────────────────────────────────────────────────────┘
```

Detailed visual design (colors, typography, responsive behavior, exact menu placement) remains to be created in `docs/design/` or linked from a design tool. The low-fidelity flows and menus in this brief are the interaction baseline.
