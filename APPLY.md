# Apply Step 2 (pinning on the desktop layer)

```bash
cd ~/primalmind/PROJECTS/desknote
git add -A && git commit -m "checkpoint before step 2"      # safe restore point
unzip -o ~/Downloads/desknote-step2.zip -d .
cd src-tauri && cargo check && cd ..                        # first build downloads/links gtk, may take a while
npm run build
npm run tauri dev
```

Then follow `docs/STEP2-TEST-CHECKLIST.md`. To undo everything: `git reset --hard HEAD`.
Changed Cargo.toml (adds `gtk` for Linux only) — that is why `cargo check` runs first.
