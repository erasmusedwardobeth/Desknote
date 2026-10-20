That's the same `main.jsx` I've already split, so I'm continuing. The frontend is done and the CSS is split. Next I'll write the Rust side, the docs, and the permission fix, then package everything.Now the permission fix, the docs, and a check for any JSX parser in the sandbox so I can validate the component files.TypeScript is installed globally, so I can use its parser to validate every JSX file's syntax. I'll also check that every relative import points at a real file and a real export.All 33 frontend files parse, and every import resolves. One more cross-check: every `invoke('…')` name in the JS must match a Rust command that's registered in `generate_handler!`.I split your `main.jsx` into small components, hooks, helpers and CSS files, and split `lib.rs` into Rust modules. I haven't built or run any of it. This sandbox has no `cargo`, so the Rust is unchecked beyond reading it through.

What I did check:
- **Frontend:** all 33 JS/JSX files parse, and every import points at a real file and a real export.
- **Rust:** all 20 `invoke('…')` names match a Rust command that is registered in `generate_handler!`, and all braces balance. The compiler has not seen it yet.

**To apply it** (also in `APPLY.md`, inside the zip):

```bash
git switch -c restructure
unzip -o ~/Downloads/desknote-restructure.zip -d .
rm src/style.css
npm run build
cd src-tauri && cargo check && cd ..
npm run tauri dev
```

If either check fails, paste the error here. To abandon the change, run `git switch codex && git branch -D restructure`.

**What changed in the frontend (`src/`):**

| Folder | What's in it |
|---|---|
| `components/workspace/` | `Workspace.jsx` holds the state and actions. `TopBar`, `Footer`, `NoteCard` and `RegionBox` are display-only. |
| `components/editor/` | `NoteEditor`, plus `ChecklistEditor` and `ScheduleFields` as their own files. |
| `components/ui/` | Reusable pieces: `Modal`, `ModalHeader`, `CloseButton`, `PopupMenu`, `Toast`. The note menu, group menu and pinned menu now share `PopupMenu`. |
| `hooks/` | Dragging, camera and zoom, shortcuts, data loading, toasts. |
| `api/` | The only place that calls Rust, one function per command. |
| `lib/` | Pure helpers (dates, boards, note shape) and a `constants.js` for every magic number. |
| `styles/` | One CSS file per area. `theme.css` holds the color variables. |

Every file starts with a comment saying what it owns. `docs/FILE-MAP.md` is a lookup table of "I want to change X, open file Y", plus the path a button click takes through the app.

**What changed in the Rust side (`src-tauri/src/`):**
- The new files are `models.rs`, `database.rs`, `state.rs`, `util.rs`, `reminders.rs`, `window_manager.rs`, and `commands/` with notes, regions, settings and backup.
- Duplicated region and backup code was merged into helpers in `database.rs`.
- The SQL statements are copied unchanged.

**Beyond moving code:**
- I fixed a bug in the pinned-note window. "Mark complete" from its editor used an undefined `checklist` variable and would have thrown an error.
- I added `core:window:allow-start-dragging` to `capabilities/default.json`, so pinned notes can be dragged.
- I removed unused CSS left over from the old vanilla version (`.pin-mode`, `.small-dialog`, `#zoom-home`).
- Nothing else about behavior changed on purpose. Pinning is not fixed yet, because that's step 2.

Once it builds and runs as before, commit it. For step 2 I still need the output of `echo $XDG_SESSION_TYPE`, `tauri.conf.json` and `Cargo.toml`, plus what you see when you click "Pin to desktop" (any error text from the terminal counts).