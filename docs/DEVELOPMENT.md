# Development

## Requirements

- Node.js and npm for the React/Vite frontend.
- Rust toolchain for Tauri commands and desktop builds.
- Tauri 2 operating-system dependencies. On Ubuntu, install the current Tauri Linux prerequisites, including GTK and WebKitGTK development packages.

## Commands

```sh
npm install
npm run dev
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri dev
npm run tauri build
```

`npm run dev` starts the frontend only. `npm run tauri dev` starts the desktop app and its Rust backend. `npm run build` builds the frontend bundle; the Tauri build also compiles Rust and packages the app.

## Persistence and debugging

The SQLite database is stored in Tauri's application data directory as `desknote.sqlite3`. Schema changes belong in `src-tauri/src/database.rs` and must include an additive migration. Use in-memory/disposable databases for migration tests. JSON backup import creates a recovery backup before applying changes.

Set `DESKNOTE_DEBUG=1` when launching the Tauri app to print pinned geometry calls. Linux desktop-layer experiments can use `DESKNOTE_HINT=desktop|dock|utility|normal`; arrange-mode hints use `DESKNOTE_EDIT_HINT=utility|normal|dialog`. These are diagnostic controls and behavior varies by window manager.

## Test coverage

The JavaScript tests cover pure utility modules. Rust tests cover SQLite migration and note style round-tripping. Neither suite proves native window stacking, desktop visibility, drag behavior under a compositor, login autostart, or reboot restoration. Validate those in a real desktop session.
