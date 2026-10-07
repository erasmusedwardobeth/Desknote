# ADR-001: Desktop application stack

**Status:** Proposed and implemented as the current baseline; Windows/macOS runtime validation pending  
**Date:** 2026-10-05

## Context

Desknote requires independent pinned-note windows, a larger grouping workspace, local persistence, startup integration, and compiled packages for Linux, Windows, and macOS. The user prefers JSX and is familiar with React, Next.js, TypeScript, JavaScript, Python, and PyQt. Existing repository code uses Tauri 2, Rust, Vite, plain JavaScript, and SQLite.

## Decision

Use **Tauri 2 + Vite + React + JSX + Rust + SQLite** as the proposed initial desktop stack.

- React/JSX provides the desired component authoring model.
- Vite emits static frontend assets suitable for a packaged desktop webview.
- Tauri provides the desktop shell and OS integration surface.
- Rust handles persistence and platform-specific window lifecycle behavior.
- SQLite stores notes and workspace data locally.

## Alternatives considered

| Option | Advantages | Costs / limitations | Assessment |
|---|---|---|---|
| Tauri + Vite + React | JSX support, compact static frontend, straightforward fit with local desktop shell; builds on existing Tauri repo | Rust and native webview platform behavior still need learning and testing | Recommended |
| Tauri + Next.js static export | JSX, file-based routes and Next conventions; official Tauri integration path | Static export excludes server-dependent features; more build/configuration than current local UI needs | Viable, no current requirement justifies extra framework |
| Python + PyQt | Familiar Python desktop toolkit and direct native widget model | Would replace current backend/frontend and require separate cross-platform packaging/window behavior design | Keep as alternative if webview limitations block required windows |
| Electron + React | Mature web desktop ecosystem and broad web compatibility | Larger runtime footprint; duplicated Chromium/Node runtime compared with system webview | Not preferred without a concrete need |

## Consequences

- All UI components will use `.jsx` or `.tsx` (TypeScript JSX can be adopted later without changing this decision).
- No Next.js server, API routes, or server actions are part of the packaged runtime.
- Multi-window behavior, hidden taskbar/dock presence, and always-on-top behavior are high-risk platform requirements. A minimal proof-of-concept is required on all three target desktop OSes before committing to full implementation.
- The stack recommendation can be reversed before implementation if the OS proof-of-concept fails or materially raises maintenance cost.

## Verification before acceptance

Build a small spike with a pinned-note window and a workspace window. Demonstrate: note window stays visible and does not create a taskbar entry; workspace creates/removes taskbar presence as it opens/closes; Ctrl+D hides only workspace; invoking the app launcher focuses the existing process; login-start toggle works. Record results on Linux, Windows, and macOS.
