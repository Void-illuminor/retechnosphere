/**
 * The creature builder. You pick a diet, assemble body parts, tweak colour and
 * size, name your creature and release it. The preview and stat read-out update
 * live so the trade-offs of each part are visible before you commit.
 */
import { useMemo, useState } from "react";
import {
  Diet,
  Genome,
  deriveStats,
  generateName,
} from "../sim/genome";
import {
  CATEGORY_LABEL,
  PART_CATEGORIES,
  PartCategory,
  partsIn,
} from "../sim/parts";
import { Rng } from "../sim/rng";
import { World } from "../sim/world";
import CreaturePreview from "./CreaturePreview";
import StatBars from "./StatBars";

interface Props {
  world: World;
  onReleased: (creatureId: number) => void;
  onCancel: () => void;
  canCancel: boolean;
}

function defaultParts(): Record<PartCategory, string> {
  const parts = {} as Record<PartCategory, string>;
  for (const cat of PART_CATEGORIES) parts[cat] = partsIn(cat)[0].id;
  return parts;
}

export default function Builder({ world, onReleased, onCancel, canCancel }: Props) {
  const [diet, setDiet] = useState<Diet>("herbivore");
  const [parts, setParts] = useState<Record<PartCategory, string>>(defaultParts);
  const [hue, setHue] = useState(110);
  const [sizeGene, setSizeGene] = useState(1);
  const [name, setName] = useState("");
  const [placeholder] = useState(() => generateName(new Rng((Math.random() * 1e9) >>> 0)));

  const genome: Genome = useMemo(
    () => ({ diet, parts, hue, accent: 0.5, sizeGene, vigor: 1 }),
    [diet, parts, hue, sizeGene],
  );
  const stats = useMemo(() => deriveStats(genome), [genome]);

  function selectPart(cat: PartCategory, id: string) {
    setParts((p) => ({ ...p, [cat]: id }));
  }

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

  function release() {
    const finalName = name.trim() || placeholder;
    const c = world.addFounder({ ...genome }, finalName);
    onReleased(c.id);
  }

  return (
    <div className="builder">
      {/* ---- left: diet + part pickers ---- */}
      <div className="col">
        <div className="panel">
          <div className="titlebar">
            <span className="dot" /> 1 · Choose a niche
          </div>
          <div className="diet-toggle">
            <div
              className={`diet-opt ${diet === "herbivore" ? "sel-herb" : ""}`}
              onClick={() => chooseDiet("herbivore")}
            >
              <div className="big">🌿 Grazer</div>
              <div className="desc">Herbivore — eats plants, flees predators</div>
            </div>
            <div
              className={`diet-opt ${diet === "carnivore" ? "sel-carn" : ""}`}
              onClick={() => chooseDiet("carnivore")}
            >
              <div className="big">🦷 Prowler</div>
              <div className="desc">Carnivore — hunts and eats grazers</div>
            </div>
          </div>
        </div>

        <div className="panel col" style={{ flex: 1, minHeight: 0 }}>
          <div className="titlebar">
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
                      onClick={() => selectPart(cat, p.id)}
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

      {/* ---- center: preview + name + release ---- */}
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
          <CreaturePreview genome={genome} />
          <div className="name-row">
            <input
              value={name}
              maxLength={20}
              placeholder={`name your ${diet}… e.g. ${placeholder}`}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="btn primary" onClick={release}>
              ▶ Release into Sphere
            </button>
            {canCancel && (
              <button className="btn ghost" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---- right: analysis + tuning ---- */}
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
            <input
              type="range"
              min={0}
              max={359}
              value={hue}
              style={{ width: "100%" }}
              onChange={(e) => setHue(Number(e.target.value))}
            />
            <label className="hint">Size</label>
            <input
              type="range"
              min={0.8}
              max={1.3}
              step={0.01}
              value={sizeGene}
              style={{ width: "100%" }}
              onChange={(e) => setSizeGene(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="panel">
          <div style={{ padding: 10 }} className="hint">
            <strong style={{ color: "var(--accent)" }}>Field note:</strong> bigger
            bodies store more energy and armour but move slower. Predators need attack
            and vision; grazers thrive on feeding efficiency and agility to flee. Once
            released, your creature is on its own — and so are its descendants.
          </div>
        </div>
      </div>
    </div>
  );
}
