# How to apply this restructure (do it on a new branch)

```bash
cd ~/primalmind/PROJECTS/CODEX/desknote
git status                      # should be clean
git switch -c restructure       # work on a new branch, codex stays safe

# copy the new files over the project (zip is in your Downloads or wherever you saved it)
unzip -o ~/Downloads/desknote-restructure.zip -d .

# remove the old single-file versions that were split up
rm src/style.css

# check both halves
npm run build
cd src-tauri && cargo check && cd ..

# run it
npm run tauri dev
```

If both checks pass and the app behaves as before, commit:

```bash
git add -A && git commit -m "Restructure: modular components, hooks, api layer, split Rust modules"
```

If anything fails, paste the error here. To abandon: `git switch codex && git branch -D restructure`.

## What changed besides moving code
- Fixed: "Mark complete" in a pinned note's editor used an undefined variable.
- Added permission `core:window:allow-start-dragging` so pinned notes can be dragged.
- Removed unused CSS left over from the old non-React version (`.pin-mode`, `.small-dialog`, `#zoom-home`).
- Rust: duplicated region/backup code merged into `database.rs` helpers; the time helper is now `util::now_iso`.
- Behavior is otherwise identical on purpose.
