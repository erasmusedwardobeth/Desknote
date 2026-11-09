# Changelog

## Unreleased

- Added a persisted note presentation type (`sticky`, `paper`, `parchment`, `task-list`) with an additive migration that keeps existing notes as sticky notes.
- Added editor style selection and distinct paper, parchment, and task-list surfaces in canvas and pinned views.
- Registered the existing pinned arrange, move, and resize commands so frontend requests reach Rust.
- Added Rust coverage for note presentation migration defaults and round-tripping, plus an `npm test` entry point.
- Added implementation-facing architecture, widget API, platform, desktop integration, and development documentation.
