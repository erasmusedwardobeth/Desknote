# Desknote

A small personal focus board for Linux, built with Tauri 2, Rust, and a plain JavaScript/Vite interface. Notes and board groups live in a local SQLite database; the app makes no network requests for data.

## Requirements

- Rust stable (`rustup default stable`)
- Node.js and npm
- Ubuntu 22.04 or a compatible Linux desktop with GTK 3, WebKitGTK 4.1, JavaScriptCoreGTK 4.1, libsoup 3, OpenSSL, and build tools

On Ubuntu, install the Tauri Linux packages with:

```sh
sudo apt update
sudo apt install build-essential curl wget file libssl-dev libxdo-dev libayatana-appindicator3-dev librsvg2-dev libwebkit2gtk-4.1-dev
```

Install the frontend packages once, then start the desktop app:

```sh
npm install
npm run tauri dev
```

Create a Linux package with:

```sh
npm run tauri build
```

## Included

- Freeform board with pan, zoom, draggable/resizable sticky notes, groups, and frames
- Daily and weekly views based on note due dates
- Basic rich text, checklists, colors, recurrence fields, and always-on-top note windows
- Local SQLite storage under the app’s platform data directory
- Login-start toggle through Tauri’s autostart plugin
- Closing the main window minimizes it, leaving the app accessible from its taskbar icon
- Press `V` while focused on the board to stop the app (with a confirmation); text fields keep `v` for typing

The recurrence value is currently stored with the due date; recurring tasks do not advance automatically when completed. The Windows target is kept in mind but has not been compiled or checked on Windows yet.

## Ubuntu build note

This environment has Rust stable configured. Building the native app still needs `libwebkit2gtk-4.1-dev` (which provides JavaScriptCoreGTK 4.1) and `libsoup-3.0-dev`. Run the apt command above from a terminal with sudo access, then use `npm run tauri dev`.
