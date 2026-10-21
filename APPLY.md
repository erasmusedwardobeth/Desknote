# Desknote Step 3A overlay

This overlay is intended for the full Desknote repository. It includes the pinned-note drag fix plus the first navigation-tree increment.

## Apply

From the Desknote project root, create a Git checkpoint first, then extract the ZIP over the repository:

```bash
git add -A && git commit -m "checkpoint before step 3A navigation"
unzip -o ~/Downloads/desknote-step3a-navigation.zip -d .
npm run build
cd src-tauri && cargo check && cd ..
npm run tauri dev
```

## Changes

- `src/components/pinned/PinnedNoteWindow.jsx`: explicit pointer-driven movement for pinned X11 desktop windows.
- `src/components/workspace/Workspace.jsx`: adds the sidebar and item-centering navigation.
- `src/components/workspace/SidebarTree.jsx`: searchable notes/groups tree.
- `src/styles/sidebar-tree.css` and `src/styles/index.css`: sidebar layout and styling.
- `docs/STEP3-STATUS.md`: scope, test plan, and the boundary to true multi-workspace support.

The source archives do not include the repository's root package manifest, lockfile, or complete Tauri configuration, so this overlay cannot be compiled in isolation. Build and runtime checks must be run in the full project.
