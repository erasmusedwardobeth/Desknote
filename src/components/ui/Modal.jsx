/**
 * <Modal> — a centered dialog over a dimmed backdrop. Clicking the backdrop calls onClose.
 * Used by the note editor and the settings panel.
 *
 * Props:
 *   onClose            called when the backdrop is clicked
 *   className          extra class(es) for the dialog box itself
 *   backdropClassName  extra class(es) for the dimmed backdrop
 *   ...dialogProps     anything else (aria-*, etc.) goes to the <dialog>
 */
export default function Modal({ onClose, className = '', backdropClassName = '', children, ...dialogProps }) {
  return (
    <div
      className={`modal-backdrop ${backdropClassName}`.trim()}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <dialog className={`editor ${className}`.trim()} open {...dialogProps}>
        {children}
      </dialog>
    </div>
  );
}
