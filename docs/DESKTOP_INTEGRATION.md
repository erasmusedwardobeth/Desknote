# Desktop integration

## Lifecycle

The Tauri process opens the local SQLite database, starts the reminder scheduler, restores each row marked `pinned`, and configures the workspace window. Each pinned note is a separate webview window in the same process. Closing the workspace hides it; the explicit quit action ends the app and all pinned windows. Autostart uses the Tauri autostart plugin with `--background`.

The repository does not provide an independent widget-host executable or an OS service. A crash or explicit quit of the main process also ends the pinned windows; startup reconstructs them on the next launch.

## Linux layer behavior

`desktop_layer.rs` selects a GTK window type hint. Unless `GDK_BACKEND` is already set, the app requests GTK's X11 backend (typically XWayland in a Wayland login). The default hint is `Desktop`; the code also requests keep-below, skip-taskbar, skip-pager, and all-workspace behavior. This is window-manager-specific. It does not use a portable Wayland protocol, and some environments may ignore the desktop hint or show the widget differently.

Arrange mode temporarily changes the window to an interactive utility hint. Native move/resize commands are registered in `lib.rs` and persist desktop geometry through window events. Desktop and canvas coordinates are separate.

## Other platforms

The current non-Linux fallback uses always-on-top. That does not implement a behind-normal-windows desktop layer, all-space placement, or equivalent show-desktop behavior. Windows and macOS desktop adapters remain incomplete.

## Verification record

Record native validation only after running the app in a real logged-in desktop session. Check pin, close/hide workspace, show desktop, normal application stacking, arrange/move/resize, restart restoration, unpin persistence, and multiple widgets. A frontend or Rust build is not evidence that compositor behavior passed. In this execution no desktop-session verification was performed; see the implementation report for exact environment limits.
