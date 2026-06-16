/** Detail panel for the currently-selected creature (streamed from the server). */
import { formatSimTime } from "../sim/events";

export interface InspectableCreature {
  id: number;
  name: string;
  diet: "herbivore" | "carnivore";
  gen: number;
  founder: boolean;
  ef: number;
  beh: string;
  age: number;
  meals: number;
  kills: number;
  offspring: number;
  lineageId: number;
}

interface Props {
  creature: InspectableCreature | null;
  following: boolean;
  isMine: boolean;
  onToggleFollow: () => void;
  onClose: () => void;
}

export default function Inspector({ creature, following, isMine, onToggleFollow, onClose }: Props) {
  if (!creature) return null;
  const carn = creature.diet === "carnivore";

  return (
    <div className="inspector panel">
      <div className="spread">
        <div>
          <div className="cname">
            {creature.name}
            {isMine ? <span style={{ color: "var(--accent)" }}> ★</span> : null}
          </div>
          <div className={`ctype ${carn ? "carn" : "herb"}`}>
            {carn ? "Prowler" : "Grazer"} · gen {creature.gen}
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
            width: `${Math.round(Math.max(0, Math.min(1, creature.ef)) * 100)}%`,
            background:
              creature.ef > 0.5
                ? "linear-gradient(90deg,#3fa35a,#7fd66a)"
                : creature.ef > 0.25
                  ? "#e0c04a"
                  : "#e0584a",
          }}
        />
      </div>

      <div className="grid">
        <span className="k">Energy</span>
        <span className="v">{Math.round(creature.ef * 100)}%</span>
        <span className="k">Age</span>
        <span className="v">{formatSimTime(creature.age)}</span>
        <span className="k">Doing</span>
        <span className="v">{creature.beh}</span>
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
