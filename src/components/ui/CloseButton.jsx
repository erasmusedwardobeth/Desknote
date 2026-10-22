/** <CloseButton> — the round "×" button. Props: label (accessible name), onClick. */
export default function CloseButton({ label, onClick }) {
  return <button type="button" className="icon-btn" onClick={onClick} aria-label={label}>×</button>;
}
