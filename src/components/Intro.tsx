/** The landing screen — sets the tone and explains, briefly, what this is. */
interface Props {
  onEnter: () => void;
  returning?: boolean;
}

export default function Intro({ onEnter, returning }: Props) {
  return (
    <div className="intro">
      <div className="panel intro-card">
        <div className="tag">digital ecology // est. 1995</div>
        <h1 className="brand">
          <span className="re">re</span>
          <span className="rest">TechnoSphere</span>
        </h1>
        <p>
          Design a creature from mechanical body parts, then release it into one living
          fractal savanna <strong>shared by your whole family</strong>. It will roam, graze
          or hunt, mate, breed and — eventually — die, entirely on its own. The world keeps
          living whether you're watching or not, and we'll email you how your bloodline fares.
        </p>
        <p className="hint">
          A homage to <strong>TechnoSphere</strong> by Jane Prophet &amp; Gordon Selley,
          one of the web's first artificial-life worlds.
        </p>
        <div style={{ marginTop: 22 }}>
          <button className="btn primary" style={{ fontSize: 14, padding: "10px 22px" }} onClick={onEnter}>
            {returning ? "▶ Return to the Sphere" : "▶ Enter the Sphere"}
          </button>
        </div>
        <div className="est">
          {returning ? "welcome back — your bloodlines await" : "press to enter the shared world and build your first creature"}
          <span className="blink">_</span>
        </div>
      </div>
    </div>
  );
}
