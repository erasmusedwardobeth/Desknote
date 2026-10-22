/**
 * <InlineConfirm> — a yes/no question drawn INSIDE the current window.
 *
 * Used instead of a native dialog in pinned notes: a native dialog opened from a
 * desktop-layer window can appear behind everything (or not at all), leaving the
 * button looking dead. This one is part of the page, so it can never be hidden.
 *
 * Props: message, confirmLabel ("Yes"), cancelLabel ("Cancel"), onConfirm(), onCancel()
 */
export default function InlineConfirm({ message, confirmLabel = 'Yes', cancelLabel = 'Cancel', onConfirm, onCancel }) {
  return (
    <div className="inline-confirm" role="alertdialog" aria-label={message}>
      <p>{message}</p>
      <div className="inline-confirm-actions">
        <button type="button" className="quiet-btn" onClick={onCancel} autoFocus>{cancelLabel}</button>
        <button type="button" className="primary" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  );
}
