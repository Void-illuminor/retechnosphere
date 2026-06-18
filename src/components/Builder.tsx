/**
 * The creature builder. Pick a diet, assemble body parts, tune colour/size, say
 * who you are (name + email, so we can send your field reports), and release into
 * the shared world. The preview and stats update live.
 */
import { useMemo, useState } from "react";
import { MeInfo, ReleaseResult, api, tokenStore } from "../net/api";
import { Diet, Genome, deriveStats, generateName } from "../sim/genome";
import { CATEGORY_LABEL, PART_CATEGORIES, PartCategory, partsIn } from "../sim/parts";
import { Rng } from "../sim/rng";
import Creature3D from "./Creature3D";
import StatBars from "./StatBars";

interface Props {
  me: MeInfo | null;
  onReleased: (result: ReleaseResult) => void;
  onCancel: () => void;
  canCancel: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultParts(): Record<PartCategory, string> {
  const parts = {} as Record<PartCategory, string>;
  for (const cat of PART_CATEGORIES) parts[cat] = partsIn(cat)[0].id;
  return parts;
}

export default function Builder({ me, onReleased, onCancel, canCancel }: Props) {
  const [diet, setDiet] = useState<Diet>("herbivore");
  const [parts, setParts] = useState<Record<PartCategory, string>>(defaultParts);
  const [hue, setHue] = useState(110);
  const [sizeGene, setSizeGene] = useState(1);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [email, setEmail] = useState(me?.email ?? "");
  const [placeholder] = useState(() => generateName(new Rng((Math.random() * 1e9) >>> 0)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const genome: Genome = useMemo(
    () => ({ diet, parts, hue, accent: 0.5, sizeGene, vigor: 1 }),
    [diet, parts, hue, sizeGene],
  );
  const stats = useMemo(() => deriveStats(genome), [genome]);

  const emailOk = EMAIL_RE.test(email.trim());
  const canRelease = emailOk && displayName.trim().length > 0 && !busy;

  function chooseDiet(d: Diet) {
    setDiet(d);
    setHue(d === "carnivore" ? 12 : 110);
  }

  function randomize() {
    const rng = new Rng((Math.random() * 1e9) >>> 0);
    const next = {} as Record<PartCategory, string>;
    for (const cat of PART_CATEGORIES) {
      const list = partsIn(cat);
      next[cat] = list[rng.int(0, list.length - 1)].id;
    }
    setParts(next);
    setHue(rng.int(0, 359));
    setSizeGene(Number(rng.range(0.85, 1.25).toFixed(2)));
  }

  async function release() {
    if (!canRelease) return;
    setBusy(true);
    setError("");
    try {
      const result = await api.release({
        ...genome,
        name: name.trim() || placeholder,
        displayName: displayName.trim(),
        email: email.trim(),
      });
      tokenStore.set(result.token);
      onReleased(result);
    } catch (e) {
      setError((e as Error).message || "Release failed. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="builder">
      <div className="col">
        <div className="panel">
          <div className="titlebar">
            <span className="dot" /> 1 · Choose a niche
          </div>
          <div className="diet-toggle">
            <div className={`diet-opt ${diet === "herbivore" ? "sel-herb" : ""}`} onClick={() => chooseDiet("herbivore")}>
              <div className="big">🌿 Grazer</div>
              <div className="desc">Herbivore — eats plants, flees predators</div>
            </div>
            <div className={`diet-opt ${diet === "carnivore" ? "sel-carn" : ""}`} onClick={() => chooseDiet("carnivore")}>
              <div className="big">🦷 Prowler</div>
              <div className="desc">Carnivore — hunts and eats grazers</div>
            </div>
          </div>
        </div>

        <div className="panel col parts-panel">          <div className="titlebar">
            <span className="dot" /> 2 · Assemble the body
          </div>
          <div className="scroll">
            {PART_CATEGORIES.map((cat) => (
              <div className="part-cat" key={cat}>
                <h4>{CATEGORY_LABEL[cat]}</h4>
                <div className="part-list">
                  {partsIn(cat).map((p) => (
                    <div
                      key={p.id}
                      className={`part-card ${parts[cat] === p.id ? "sel" : ""}`}
                      onClick={() => setParts((prev) => ({ ...prev, [cat]: p.id }))}
                    >
                      <div className="name">{p.name}</div>
                      <div className="blurb">{p.blurb}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="col">
        <div className="panel stage">
          <div className="titlebar spread">
            <span>
              <span className="dot" /> Specimen Preview
            </span>
            <button className="btn small ghost" onClick={randomize}>
              ⟳ Randomize
            </button>
          </div>
          <div className="stage-3d">
            <Creature3D genome={genome} />
          </div>
          <div className="name-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
            <input
              value={name}
              maxLength={24}
              placeholder={`name your ${diet}… e.g. ${placeholder}`}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="gap">
              <input
                style={{ flex: 1 }}
                value={displayName}
                maxLength={24}
                placeholder="your name (shown to family)"
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <input
                style={{ flex: 1.4 }}
                value={email}
                maxLength={120}
                type="email"
                placeholder="your email (for field reports)"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {error && <div style={{ color: "var(--danger)", fontSize: 11 }}>{error}</div>}
            <div className="gap">
              <button className="btn primary" disabled={!canRelease} onClick={release} style={{ flex: 1 }}>
                {busy ? "Releasing…" : "▶ Release into the shared Sphere"}
              </button>
              {canCancel && (
                <button className="btn ghost" onClick={onCancel} disabled={busy}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="col">
        <div className="panel">
          <div className="titlebar">
            <span className="dot" /> Specimen Analysis
          </div>
          <div style={{ padding: 10 }}>
            <StatBars stats={stats} diet={diet} />
          </div>
        </div>

        <div className="panel">
          <div className="titlebar">
            <span className="dot" /> Appearance
          </div>
          <div style={{ padding: 10 }}>
            <label className="hint">Hue</label>
            <input type="range" min={0} max={359} value={hue} style={{ width: "100%" }} onChange={(e) => setHue(Number(e.target.value))} />
            <label className="hint">Size</label>
            <input type="range" min={0.8} max={1.3} step={0.01} value={sizeGene} style={{ width: "100%" }} onChange={(e) => setSizeGene(Number(e.target.value))} />
          </div>
        </div>

        <div className="panel">
          <div style={{ padding: 10 }} className="hint">
            <strong style={{ color: "var(--accent)" }}>Field note:</strong> your creature joins one world
            shared by everyone. Once released it's on its own — we'll email you a daily report of how your
            bloodline fares. Bigger bodies store more energy and armour but move slower.
          </div>
        </div>
      </div>
    </div>
  );
}
