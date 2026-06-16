/** Renders a creature's derived stats as labelled bars for the builder. */
import { DerivedStats, Diet } from "../sim/genome";

interface Props {
  stats: DerivedStats;
  diet: Diet;
}

// Rough upper bounds for normalising each bar to 0..1.
const MAX = {
  maxEnergy: 280,
  maxSpeed: 130,
  agility: 4.5,
  vision: 360,
  feeding: 1.8,
  attack: 30,
  armor: 14,
  maxAge: 260,
};

interface Row {
  label: string;
  value: number;
  max: number;
  display: string;
}

export default function StatBars({ stats, diet }: Props) {
  const rows: Row[] = [
    { label: "Energy", value: stats.maxEnergy, max: MAX.maxEnergy, display: Math.round(stats.maxEnergy).toString() },
    { label: "Speed", value: stats.maxSpeed, max: MAX.maxSpeed, display: Math.round(stats.maxSpeed).toString() },
    { label: "Agility", value: stats.agility, max: MAX.agility, display: stats.agility.toFixed(1) },
    { label: "Vision", value: stats.vision, max: MAX.vision, display: Math.round(stats.vision).toString() },
    diet === "carnivore"
      ? { label: "Attack", value: stats.attack, max: MAX.attack, display: Math.round(stats.attack).toString() }
      : { label: "Feeding", value: stats.feeding, max: MAX.feeding, display: stats.feeding.toFixed(2) },
    { label: "Armor", value: stats.armor, max: MAX.armor, display: Math.round(stats.armor).toString() },
    { label: "Lifespan", value: stats.maxAge, max: MAX.maxAge, display: `${Math.round(stats.maxAge)}s` },
  ];

  return (
    <div>
      {rows.map((r) => (
        <div className="stat" key={r.label}>
          <span className="label">{r.label}</span>
          <span className="bar">
            <span style={{ width: `${Math.min(100, (r.value / r.max) * 100)}%` }} />
          </span>
          <span className="val">{r.display}</span>
        </div>
      ))}
    </div>
  );
}
