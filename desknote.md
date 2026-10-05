# Desknote — imported project context

Source ChatGPT project: Desknote
Source project ID: g-p-6ab60d6004e88191abb26ac6a87419f8
Imported: 2026-10-01

This file is a context snapshot from the ChatGPT history surfaced to this session. It is not a full transcript.

Surfaced conversations: 1

## Refine Desktop Productivity App

Source conversation ID: 6ab60d62-cf20-83ea-882c-e98848d513d1

Recent user prompts:

- short overview of the refinded i idea i dont have time to read now maybe later
- the figjam like ability of can as is for simply creating different sticky notes and be anle to drag and grouo them together so i can have an overview of all the sticky notes at once with different groups like clusters
- i think having a daily task and weekly s roll being shown is impor and i forgot to mention the auto start capability once installed as long as the computer is powered on

Latest available response snapshot:

## Personal Desktop Focus App — Refined Idea

A **lightweight personal desktop app** whose main purpose is to make sure you **don't forget what you want or need to accomplish**.

### Core

- **Daily and Weekly scroll/board** permanently visible on the desktop.
- Automatically starts when the computer starts.
- Sticky notes that can be created, edited, moved, resized, styled and scheduled.
- Notes can be **pinned to the desktop**, shown temporarily, or kept hidden.
- Reminders and recurring schedules: daily → weekly → monthly → yearly.
- Completed tasks remain traceable historically.

### Canvas

A **FigJam-like freeform canvas** where you can:

- Create unlimited sticky notes.
- Drag them anywhere.
- Zoom in/out.
- Group related notes into visual **clusters**.
- Create larger areas/frames for projects or themes.
- See your entire collection of thoughts/tasks at once.
- Move/edit individual notes without destroying their groups.

### Organization

Things can relate to each other:

**Aim → Goal → Objective → Project → Task → Subtask**

But the canvas remains freeform—you don't have to organize everything hierarchically.

### Appearance

- Sticky notes, paper, cards, parchment, etc.
-


## Current clarifications from the user (2026-10-05)

- On app startup, show only notes that are pinned to the desktop.
- Pinned desktop notes must not be minimized, including when the user presses Ctrl+D or closes a note window. A pinned note can be dismissed only through its top-right ellipsis menu by unpinning it.
- Do not lock the project to the current Tauri/Rust stack. The user knows JavaScript, React, Next.js, TypeScript, Python, and PyQt; choose technology based on the desktop app requirements.
- The app is desktop software and should be portable across platforms, compiled/distributed as an executable.
- Taskbar behavior needs clarification: user says the app should show as running on the taskbar unless they access the frame/grouping workspace.


## Further user decisions (2026-10-05)

- Initial desktop targets: Linux, Windows, and macOS; Android may follow later.
- Preferred UI authoring style: React with JSX. Proposed first-release stack: Tauri + Vite + React + JSX + Rust + SQLite, pending platform proof of concept.
- Proposed initial distribution: Linux deb package, Windows NSIS installer, and signed/notarized macOS DMG; portable packages are deferred.
- At startup, only pinned desktop notes should appear. Pinned notes stay visible; dismiss by unpinning through their top-right ellipsis menu.
- The frame/grouping workspace alone should create a taskbar/running-app indication. Ctrl+D minimizes only that workspace. Closing it leaves Desknote resident and pinned notes visible.
- Reopen the workspace from a pinned note's ellipsis menu or by launching Desknote again from the OS launcher; reactivate the existing process, not a duplicate. If the final note is unpinned while the workspace is hidden, keep Desknote resident invisibly.
