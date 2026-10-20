/**
 * App.jsx — decides WHICH window this webview is.
 *
 * The Rust side opens two kinds of windows, both loading the same index.html:
 *   1. The main workspace window        → URL has no ?note=
 *   2. A pinned note on the desktop     → URL looks like index.html?note=12
 * (see src-tauri/src/window_manager.rs → create_pinned_window)
 */
import Workspace from "./components/workspace/Workspace.jsx";
import PinnedNoteWindow from "./components/pinned/PinnedNoteWindow.jsx";

/** The note id from "?note=12", or null when this is the main workspace window. */
const noteWindowId =
  Number(new URLSearchParams(location.search).get("note")) || null;

export default function App() {
  return noteWindowId ? (
    <PinnedNoteWindow noteId={noteWindowId} />
  ) : (
    <Workspace />
  );
}
