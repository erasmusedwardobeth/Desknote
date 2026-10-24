# Apply Phase 3 (workspaces, layers tree, properties panel, backgrounds, context menus)

## 1. Checkpoint and unpack
    cd ~/primalmind/PROJECTS/desknote
    git add -A && git commit -m "checkpoint before phase 3"
    unzip -o ~/Downloads/desknote-phase3.zip -d .
    git rm -f src/components/workspace/SidebarTree.jsx src/styles/sidebar-tree.css

## 2. Three small manual edits (files this package does not overwrite)

### a) src-tauri/src/lib.rs — add these 6 lines inside `tauri::generate_handler![ ... ]`
(for example right after `commands::regions::delete_region,`; keep the commas)
            commands::workspaces::list_workspaces,
            commands::workspaces::save_workspace,
            commands::workspaces::set_workspace_view,
            commands::workspaces::delete_workspace,
            commands::workspaces::duplicate_workspace,
            commands::workspaces::import_image,

### b) src-tauri/Cargo.toml — turn on the asset protocol (lets the window show images from disk)
change    tauri = { version = "2", features = [] }
to        tauri = { version = "2", features = ["protocol-asset"] }

### c) src-tauri/tauri.conf.json — allow Desknote's own images folder
change    "security": { "csp": null }
to        "security": { "csp": null, "assetProtocol": { "enable": true, "scope": ["$APPDATA/images/**"] } }

## 3. Check
    node --test tests/*.test.mjs                     # logic tests (should say: pass 51, fail 0)
    cd src-tauri && cargo check && cd ..             # first run after the Cargo.toml change takes a while
    npm run build
    npm run tauri dev

If anything fails, paste the FIRST error. Undo everything with:  git reset --hard HEAD
Your data is safe: the first start copies your database to `desknote.before-workspaces.sqlite3`
(folder: ~/.local/share/app.desknote.personal/) before migrating it.

## 4. Test with docs/PHASE-3-TESTS.md  (36 rows) and report pass/fail per row.

## Behavior changes to know about
- Empty-canvas drag now draws a SELECTION RECTANGLE. Pan = Space + drag, or the middle mouse button.
- The mouse wheel (no Ctrl) zooms: the selected note/group/frame if exactly one is selected, else the workspace.
- Right-click opens a MENU (it used to edit a note / delete a group).
- A frame or group carries its notes when moved; dropping a note into one makes it a member.
- Creating a group/frame no longer asks for a name in a pop-up: it is created and its name opens for typing in the tree.
- Accent color is now blue (variables in styles/theme.css); the rest of the theme comes in a later phase.

## Not in this phase (still to do)
Undo/redo, 8-handle resize with snap guides, bring-to-front/back, lock/hide, drag-to-reorder in the tree,
list-first note design, full blue/aqua/gold/dark theme, pinned-note work (set aside as agreed).
