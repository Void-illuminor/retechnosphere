/** Detail panel for the currently-selected creature. */
import { Creature, energyFrac } from "../sim/creature";
import { formatSimTime } from "../sim/events";

interface Props {
  creature: Creature | null;
  selectedId: number | null;
  following: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
}

export default function Inspector({
  creature,
  selectedId,
  following,
  onToggleFollow,
  onClose,
}: Props) {
  if (selectedId === null) return null;

  if (!creature) {
    return (
      <div className="inspector panel">
        <div className="spread">
          <span className="cname">signal lost</span>
          <button className="btn small ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="hint" style={{ marginTop: 6 }}>
          This creature has died or left sensor range.
        </div>
      </div>
    );
  }

  const carn = creature.genome.diet === "carnivore";
  const frac = energyFrac(creature);

  return (
    <div className="inspector panel">
      <div className="spread">
        <div>
          <div className="cname">{creature.name}</div>
          <div className={`ctype ${carn ? "carn" : "herb"}`}>
            {carn ? "Prowler" : "Grazer"} · gen {creature.generation}
            {creature.founder ? " · founder" : ""}
          </div>
        </div>
        <button className="btn small ghost" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="bar" style={{ marginTop: 8 }}>
        <span
          style={{
            width: `${Math.round(frac * 100)}%`,
            background:
              frac > 0.5 ? "linear-gradient(90deg,#3fa35a,#7fd66a)" : frac > 0.25 ? "#e0c04a" : "#e0584a",
          }}
        />
      </div>

      <div className="grid">
        <span className="k">Energy</span>
        <span className="v">
          {Math.round(creature.energy)}/{Math.round(creature.stats.maxEnergy)}
        </span>
        <span className="k">Age</span>
        <span className="v">
          {formatSimTime(creature.age)}/{formatSimTime(creature.stats.maxAge)}
        </span>
        <span className="k">Doing</span>
        <span className="v">{creature.behaviour}</span>
        <span className="k">Meals</span>
        <span className="v">{creature.meals}</span>
        {carn ? (
          <>
            <span className="k">Kills</span>
            <span className="v">{creature.kills}</span>
          </>
        ) : null}
        <span className="k">Offspring</span>
        <span className="v">{creature.offspring}</span>
      </div>

      <div className="gap" style={{ marginTop: 8 }}>
        <button className={`btn small ${following ? "toggle-on" : ""}`} onClick={onToggleFollow}>
          {following ? "● Following" : "Follow"}
        </button>
      </div>
    </div>
  );
}
