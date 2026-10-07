# Desknote project documents

These documents are the working source of truth for product intent and engineering decisions. They are working drafts with explicit proposed defaults. Platform integrations and packaging recommendations still require proof-of-concept verification before release.

## Documents

1. [Product Requirements Document](product-requirements.md) — product goals, scope, users, and release priorities.
2. [Software Requirements Specification](srs.md) — testable functional and quality requirements.
3. [UX/UI design brief](ux-ui.md) — screens, flows, interaction rules, and links to design artifacts.
4. [Software Architecture Document](sad.md) — proposed architecture and platform lifecycle design.
5. [Architecture Decision Record](adr/ADR-001-desktop-stack.md) — Tauri + Vite + React/JSX stack recommendation.
6. [Data model](data-model.md) — local entities, relationships, and persistence rules.
7. [Verification plan](verification-plan.md) — how requirements will be checked.
8. [Implementation plan](implementation-plan.md) — proposed delivery stages and completion criteria.
9. [Release plan](release-plan.md) — packaging and distribution considerations.
10. [Traceability matrix](traceability.md) — requirement-to-document and verification mapping.
11. [Implementation status](implementation-status.md) — delivered code in the current iteration and remaining platform work.

## Status and traceability

Status labels: **Draft**, **Proposed**, **Accepted**, **Deferred**, **Superseded**. Proposed defaults guide the next engineering phase; technical feasibility findings may change them. Requirement IDs use `FR` for functional requirements, `QR` for quality requirements, and `DR` for deferred decisions. Keep links between requirements, design, implementation, and verification as the project evolves.

The current repository is an implementation snapshot, not proof that every feature is complete or meets the newly stated behavior. See the [README](../README.md) and [imported brief](../desknote.md) as source material; reconcile them against code and user decisions before release claims.
