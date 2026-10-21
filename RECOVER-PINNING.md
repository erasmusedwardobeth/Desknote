# Restore the previous pinned-note desktop behavior

The interaction patch changed the default Linux X11 window hint from `Desktop` to `Utility`. That was a behavior change, not a safe drag-only fix, and can break the required desktop-layer/Show Desktop behavior. This patch restores the original default while leaving the move/resize UI files untouched.

From the Desknote repository root:

```bash
git status --short
git add -A
git commit -m "checkpoint before restoring pinned desktop layer"
unzip -o ~/Downloads/desknote-pinning-recovery.zip -d .
cd src-tauri && cargo check && cd ..
npm run tauri dev
```

If you already have a known-good checkpoint from before the interaction patch, use `git restore src-tauri/src/desktop_layer.rs` only if that file is tracked and the checkpoint contains the working implementation. Do not use `git reset --hard` unless you are certain you do not need any uncommitted work.

This recovery restores the prior default window hint. It does not claim the move/resize interaction is fixed; that must be tested separately. If the strict Desktop hint blocks programmatic movement on Unity, the correct next step is a Unity-specific implementation or a user-selectable behavior, not silently changing the default pinning semantics.
