/** <PinIcon> — a small thumbtack icon. It takes its color from the surrounding text color. */
export default function PinIcon({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M16 3a1 1 0 0 1 .7 1.7L15 6.4V11l2.3 2.3a1 1 0 0 1-.7 1.7H13v5a1 1 0 1 1-2 0v-5H7.4a1 1 0 0 1-.7-1.7L9 11V6.4L7.3 4.7A1 1 0 0 1 8 3h8z" />
    </svg>
  );
}
