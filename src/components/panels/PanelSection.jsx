/** <PanelSection> — a titled block inside the right panel. Props: title, children, actions (optional, right side of the title). */
export default function PanelSection({ title, actions, children }) {
  return (
    <section className="panel-section">
      <header className="panel-section-head"><h3>{title}</h3>{actions}</header>
      {children}
    </section>
  );
}
