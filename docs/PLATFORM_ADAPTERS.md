# Platform adapters

## Contract today

`src-tauri/src/desktop_layer.rs` is the narrow boundary for window-layer operations:

- `prepare_backend()` runs before native windows are created.
- `apply(window, float_above)` selects the window layer.
- `set_interactive(window, active)` temporarily adjusts the hint for arrange gestures.

The note schema stores platform-neutral desktop x/y/width/height separately from workspace geometry. Native windows are created and managed by `window_manager.rs`.

## Implemented behavior

- Linux: GTK/X11 window type hints, keep-below behavior, skip taskbar/pager, sticky virtual desktop. `DESKNOTE_HINT` can select `desktop`, `dock`, `utility`, or `normal` for experiments. `GDK_BACKEND=x11` is set only when the caller has not set a backend.
- Windows and macOS: the current fallback calls Tauri `set_always_on_top`. This is not equivalent to a desktop-pinned layer and does not meet the full desktop widget requirements.

There is no runtime capability API yet. The Linux implementation depends on XWayland/X11 and desktop-environment behavior; it does not inspect compositor capabilities. Avoid interpreting a successful build as proof of layer behavior.

## Extension guidance

Keep note content, presentation choice, publication state, and logical commands in the platform-neutral model. Put compositor/window-manager behavior behind this module. Add capability reporting before exposing platform-specific options in the UI, and test each adapter in its actual desktop session.
