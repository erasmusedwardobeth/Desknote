# Desknote Implementation Plan

**Status:** Proposed  
**Revision:** 0.1  
**Date:** 2026-10-05

## Delivery stages

### Stage 0 — Product baseline and requirements

Maintain the PRD/SRS baseline, record the selected release scope (Linux, Windows, macOS; Android later), and keep proposed lifecycle and packaging defaults traceable to acceptance criteria.

**Complete when:** Requirements are reviewed, prioritized, testable, and no release-blocking ambiguity remains.

### Stage 1 — UX flows and technical spike

Create note, workspace, daily/weekly, and lifecycle flows. Prototype the proposed Tauri + Vite + React/JSX stack, pinned-note windows, startup, taskbar behavior, and package generation on Linux, Windows, and macOS. Keep Android and portable package formats out of the initial desktop milestone; use platform installers/packages.

**Complete when:** UX flows are reviewed and the technology choice is supported by evidence from target platforms.

### Stage 2 — Architecture and foundations

Finalize SAD, data model, persistence/migration approach, window model, project structure, and continuous build/package process.

**Complete when:** Architecture decisions and deployment path are documented; a minimal packaged app launches on target platforms.

### Stage 3 — Core notes and lifecycle

Implement persistence, note editor, pin/unpin menu, pinned desktop windows, startup restoration, workspace close/resident behavior, and launcher activation.

**Complete when:** FR-001–006 and FR-017–020, FR-023, FR-025–026 pass verification.

### Stage 4 — Workspace and planning

Implement freeform canvas, groups/frames, daily/weekly views, due dates, opt-in reminders, checklists, completed-task view, and stored recurrence fields.

**Complete when:** Applicable FR-007–016 and FR-027–028 pass verification.

### Stage 5 — Hardening and release

Accessibility, platform checks, backup/export, packaging, install docs, known issues, and release notes.

**Complete when:** Release gates in the verification and release plans are met.

## Work tracking

Break each stage into small issues linked to requirement IDs. Each change should include acceptance criteria and relevant verification evidence. Keep technical decisions in the SAD or an Architecture Decision Record (ADR) when a decision is significant and costly to reverse.
