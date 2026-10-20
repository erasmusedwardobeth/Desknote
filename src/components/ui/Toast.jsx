/**
 * <Toast> — a short message. Render nothing when `message` is empty.
 * Pair with the useToast() hook, which supplies `message`.
 *
 * Props:
 *   message  the text (falsy = hidden)
 *   inline   false (default): floats at the bottom of the window
 *            true: sits inside a pinned note window (smaller)
 */
export default function Toast({ message, inline = false }) {
  if (!message) return null;
  return inline
    ? <div className="note-toast" role="status">{message}</div>
    : <div id="toast" className="show" role="status">{message}</div>;
}
