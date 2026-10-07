# Desknote Verification Plan

**Status:** Proposed verification baseline  
**Revision:** 0.1  
**Date:** 2026-10-05

## Verification approach

For each accepted SRS requirement, define one or more checks and record results per supported OS and release build. Use a mix of automated unit/integration checks and manual desktop interaction checks. Platform-specific window and startup behavior must be checked on real supported OS environments.

## Initial requirement coverage

| Requirement | Verification idea | Status |
|---|---|---|
| FR-001–006 notes and pinning | Create/edit/save/relaunch; compare pinned/unpinned startup; exercise close, Ctrl+D, ellipsis unpin | Planned |
| FR-007–011 workspace | Create/move/resize notes, groups and frames; reopen and check layout persistence | Planned |
| FR-012–016, FR-027–028 planning | Local-date and Monday/Sunday boundaries; checklist interaction and persistence; opt-in reminder firing/offline behavior; complete/reopen and retain timestamp; daily/weekly/monthly/yearly recurrence including month-end and leap-year clamping | Planned |
| FR-017–020, FR-023, FR-025–026 lifecycle | Toggle login launch; verify taskbar presence only while workspace is displayed; Ctrl+D and workspace close preserve pinned notes and keep app resident; verify launcher/menu activation restores workspace without a second process, including after last note unpinned | Planned |
| FR-021–022 data | Restart persistence; versioned backup export/restore; automatic recovery copy; invalid backup rejection; migration checks | Planned |
| QR-001 packaging | Install/launch/uninstall packaged build on every supported OS | Planned |
| QR-002–008 quality | Offline check, data recovery, accessibility, performance, privacy and reliability checks | Planned |

## Release gate proposal

- Every accepted requirement has a recorded pass, approved exception, or deferred status.
- No known data-loss or pinned-note dismissal defect remains open.
- Each supported platform package installs/launches and has documented limitations.
- User documentation covers startup, pinning/unpinning, workspace access, backup, and quit behavior.
