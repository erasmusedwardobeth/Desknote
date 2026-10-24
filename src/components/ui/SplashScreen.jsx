/**
 * <SplashScreen> — full-window loading screen shown while the app starts.
 * Props: message (text under the spinner). Render it only while loading.
 */
export default function SplashScreen({ message = 'Loading your workspace…' }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-mark">d</div>
      <div className="splash-name">Desknote</div>
      <div className="splash-spinner" aria-hidden="true" />
      <div className="splash-message">{message}</div>
    </div>
  );
}
