/** Heads-up readout of the whole ecosystem, with a live population graph. */
import { World } from "../sim/world";
import { formatSimTime } from "../sim/events";

interface Props {
  world: World;
}

function graphPath(values: number[], max: number, w: number, h: number): string {
  if (values.length < 2) return "";
  const n = values.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const y = h - (values[i] / max) * h;
    d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
  }
  return d.trim();
}

export default function Hud({ world }: Props) {
  const s = world.stats();
  const hist = world.popHistory;
  const w = 186;
  const h = 46;
  const herb = hist.map((p) => p.herb);
  const carn = hist.map((p) => p.carn);
  const max = Math.max(20, ...herb, ...carn);

  return (
    <div className="hud panel">
      <h3>◈ TechnoSphere Monitor</h3>
      <div className="row">
        <span className="k">Sim time</span>
        <span className="v">{formatSimTime(world.time)}</span>
      </div>
      <div className="row">
        <span className="k">Grazers</span>
        <span className="v herb">{s.herbivores}</span>
      </div>
      <div className="row">
        <span className="k">Prowlers</span>
        <span className="v carn">{s.carnivores}</span>
      </div>
      <div className="row">
        <span className="k">Plants</span>
        <span className="v">{s.plants}</span>
      </div>
      <div className="row">
        <span className="k">Generation</span>
        <span className="v">{s.generation}</span>
      </div>
      <div className="row">
        <span className="k">Births / Deaths</span>
        <span className="v">
          {s.births} / {s.deaths}
        </span>
      </div>

      <svg className="pop-graph" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={graphPath(herb, max, w, h)} fill="none" stroke="#7ee06a" strokeWidth={1.5} />
        <path d={graphPath(carn, max, w, h)} fill="none" stroke="#ff7a59" strokeWidth={1.5} />
      </svg>
      <div className="hint" style={{ textAlign: "center", marginTop: 2 }}>
        population over time
      </div>
    </div>
  );
}
