/**
 * <ModalHeader> — small caps label (and optional big title) on the left, × button on the right.
 *
 * Props:
 *   eyebrow     the small caps label, e.g. "YOUR NOTE"
 *   title       optional large heading under the label
 *   titleId     id for the heading (for aria-labelledby on the dialog)
 *   closeLabel  accessible name of the × button
 *   onClose     called when × is clicked
 */
import CloseButton from './CloseButton.jsx';

export default function ModalHeader({ eyebrow, title, titleId, closeLabel, onClose }) {
  const label = <span className="eyebrow">{eyebrow}</span>;
  return (
    <div className="editor-head">
      {title ? <div>{label}<h2 id={titleId}>{title}</h2></div> : label}
      <CloseButton label={closeLabel} onClick={onClose} />
    </div>
  );
}
