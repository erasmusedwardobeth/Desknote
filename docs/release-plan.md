# Desknote Release and Distribution Plan

**Status:** Proposed initial release plan  
**Revision:** 0.1  
**Date:** 2026-10-05

## Distribution goals

Ship Desknote as compiled desktop software. For the first release, use an installer or OS package for each target platform. Consider portable builds after the first release. Keep Desknote resident in notes-only mode so pinned notes remain available, including after the final note is unpinned; use the OS launcher to reopen the workspace. Do not claim support for an OS until its build, installation, startup integration, note-window behavior, and upgrade path have been verified.

## Initial packaging direction

- Linux: deb package for Ubuntu 22.04 LTS and compatible Debian-family systems, subject to build checks. Add AppImage only if a later portable build is approved.
- Windows: NSIS setup executable.
- macOS: signed and notarized DMG containing the app bundle.
- Portable packages: deferred until after the initial release.

## Platform matrix

| OS | Target versions | Package format | Build/verification owner | Status |
|---|---|---|---|---|
| Linux | Ubuntu 22.04 LTS baseline; compatible Debian-family distributions subject to validation | deb package | Local build produced 2026-10-05 | Package built; install/runtime verification pending |
| Windows | Minimum version selected after CI/device validation | NSIS setup executable | TBD | Initial desktop target; not yet verified |
| macOS | Minimum version selected after CI/device validation | Signed/notarized DMG with app bundle | TBD | Initial desktop target; not yet verified |
| Android | TBD | TBD | TBD | Deferred; later phase, outside initial desktop release |

## Release checklist

- Confirm exact OS versions/distributions from CI and representative-device results.
- Code-sign Windows and macOS distributions; notarize macOS release packages.
- Confirm version and supported OS matrix.
- Build and verify each package on its target OS.
- Verify startup-at-login settings, taskbar/dock presence, pinned-note persistence, workspace minimize/close, and OS-launcher reactivation.
- Document install, launch, update, uninstall, data location, backup, and known limitations.
- Preserve release notes and checksums for distributed artifacts.
