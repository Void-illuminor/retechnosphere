/** The landing screen — sets the tone and explains, briefly, what this is. */
interface Props {
  onEnter: () => void;
}

export default function Intro({ onEnter }: Props) {
  return (
    <div className="intro">
      <div className="panel intro-card">
        <div className="tag">digital ecology // est. 1995</div>
        <h1 className="brand">
          <span className="re">re</span>
          <span className="rest">TechnoSphere</span>
        </h1>
        <p>
          Design a creature from mechanical body parts, then release it into a living
          fractal savanna. It will roam, graze or hunt, mate, breed and — eventually —
          die, entirely on its own. You can watch the world tick over, or just wait for
          word of how your bloodline is faring.
        </p>
        <p className="hint">
          A homage to <strong>TechnoSphere</strong> by Jane Prophet &amp; Gordon Selley,
          one of the web's first artificial-life worlds.
        </p>
        <div style={{ marginTop: 22 }}>
          <button className="btn primary" style={{ fontSize: 14, padding: "10px 22px" }} onClick={onEnter}>
            ▶ Enter the Sphere
          </button>
        </div>
        <div className="est">
          press to seed the world and build your first creature<span className="blink">_</span>
        </div>
      </div>
    </div>
  );
}
