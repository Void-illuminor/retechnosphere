/**
 * The digital ecology. Holds the terrain, the plants and the creatures, and
 * advances them in fixed time steps. Behaviour is deliberately simple per
 * creature (sense -> decide -> steer -> act); the interesting dynamics —
 * predator/prey oscillations, evolution, local extinctions — emerge from the
 * population, exactly as they did in the original TechnoSphere.
 */
import { FOOD, LIFE, WORLD } from "./constants";
import {
  Behaviour,
  Creature,
  energyFrac,
  makeCreature,
  resetCreatureIds,
} from "./creature";
import { LifeEvent, LifeEventKind, makeEvent } from "./events";
import { Diet, Genome, breed, deriveStats, generateName, mutate, randomGenome } from "./genome";
import { SpatialHash } from "./grid";
import { Rng } from "./rng";
import { Terrain } from "./terrain";
import { TAU, angleDiff, clamp, dist } from "./vec";

export interface Plant {
  x: number;
  y: number;
  growth: number; // 0..1
}

export interface Lineage {
  id: number;
  founderName: string;
  diet: Diet;
  hue: number;
  alive: number;
  born: number;
  deaths: number;
  bestGeneration: number;
  extinct: boolean;
}

export interface WorldStats {
  herbivores: number;
  carnivores: number;
  plants: number;
  population: number;
  births: number;
  deaths: number;
  generation: number;
}

export interface PopSample {
  herb: number;
  carn: number;
}

const EVENT_CAP = 600;
const POP_HISTORY_CAP = 160;

export class World {
  rng: Rng;
  terrain: Terrain;
  creatures: Creature[] = [];
  plants: Plant[] = [];
  events: LifeEvent[] = [];
  lineages = new Map<number, Lineage>();
  popHistory: PopSample[] = [];

  time = 0;
  births = 0;
  deaths = 0;
  maxGeneration = 0;

  private creatureGrid: SpatialHash;
  private plantGrid: SpatialHash;
  private newborns: Creature[] = [];
  private accumulator = 0;
  private foodCredit = 0;
  private sampleTimer = 0;
  private immigrationTimer = 0;

  constructor(seed = (Math.random() * 0xffffffff) >>> 0) {
    this.rng = new Rng(seed);
    resetCreatureIds();
    this.terrain = new Terrain(WORLD.width, WORLD.height, this.rng);
    this.creatureGrid = new SpatialHash(WORLD.width, WORLD.height, 140);
    this.plantGrid = new SpatialHash(WORLD.width, WORLD.height, 120);
    this.seed();
  }

  // ---------------------------------------------------------------- seeding

  private randomLandPoint(): { x: number; y: number } {
    for (let i = 0; i < 40; i++) {
      const x = this.rng.range(40, WORLD.width - 40);
      const y = this.rng.range(40, WORLD.height - 40);
      if (!this.terrain.isWater(x, y)) return { x, y };
    }
    return { x: WORLD.width / 2, y: WORLD.height / 2 };
  }

  private fertilePoint(): { x: number; y: number } | null {
    for (let i = 0; i < 30; i++) {
      const x = this.rng.range(20, WORLD.width - 20);
      const y = this.rng.range(20, WORLD.height - 20);
      const cell = this.terrain.cellAt(x, y);
      if (cell.fertility > 0 && this.rng.chance(cell.fertility)) return { x, y };
    }
    return null;
  }

  seed(): void {
    // Pre-grow a field of plants.
    for (let i = 0; i < FOOD.target; i++) {
      const p = this.fertilePoint();
      if (p) this.plants.push({ x: p.x, y: p.y, growth: this.rng.range(0.2, 1) });
    }
    // Seed wild stock.
    for (let i = 0; i < LIFE.startHerbivores; i++) this.spawnWild("herbivore");
    for (let i = 0; i < LIFE.startCarnivores; i++) this.spawnWild("carnivore");
  }

  spawnWild(diet: Diet): Creature {
    const genome = randomGenome(this.rng, diet);
    const p = this.randomLandPoint();
    const c = makeCreature(genome, {
      x: p.x,
      y: p.y,
      angle: this.rng.range(0, TAU),
      name: generateName(this.rng),
      birthTime: this.time,
    });
    this.creatures.push(c);
    return c;
  }

  /** Release a player-designed creature and start a new bloodline for it. */
  addFounder(genome: Genome, name: string): Creature {
    const p = this.randomLandPoint();
    const c = makeCreature(genome, {
      x: p.x,
      y: p.y,
      angle: this.rng.range(0, TAU),
      name,
      founder: true,
      birthTime: this.time,
      energy: deriveMax(genome) * 0.85,
    });
    c.lineageId = c.id;
    this.creatures.push(c);
    this.lineages.set(c.id, {
      id: c.id,
      founderName: name,
      diet: genome.diet,
      hue: genome.hue,
      alive: 1,
      born: 1,
      deaths: 0,
      bestGeneration: 0,
      extinct: false,
    });
    this.pushEvent(
      "released",
      c,
      `${name} released into TechnoSphere`,
      `You released ${name}, a ${genome.diet}, into the digital ecology. Its fate is now its own. We'll write when something happens.`,
      true,
    );
    return c;
  }

  getCreature(id: number): Creature | undefined {
    return this.creatures.find((c) => c.id === id && c.alive);
  }

  // ------------------------------------------------------------------ update

  /** Advance by real elapsed seconds, scaled by speed, in fixed steps. */
  update(dtReal: number, speed: number): void {
    this.accumulator += clamp(dtReal, 0, 0.1) * speed;
    let steps = 0;
    while (this.accumulator >= WORLD.fixedStep && steps < 240) {
      this.step(WORLD.fixedStep);
      this.accumulator -= WORLD.fixedStep;
      steps++;
    }
  }

  private step(dt: number): void {
    this.growFood(dt);
    this.plantGrid.build(this.plants);
    this.creatureGrid.build(this.creatures);

    for (const c of this.creatures) {
      if (c.alive) this.actCreature(c, dt);
    }

    this.collectDead();
    this.compactPlants();

    if (this.newborns.length) {
      this.creatures.push(...this.newborns);
      this.newborns.length = 0;
    }

    this.immigrationTimer -= dt;
    if (this.immigrationTimer <= 0) {
      this.immigrationTimer = LIFE.immigrationInterval;
      this.reseedIfNeeded();
    }

    this.time += dt;
    this.sampleTimer += dt;
    if (this.sampleTimer >= 1) {
      this.sampleTimer = 0;
      this.recordSample();
    }
  }

  // --------------------------------------------------------------- food

  private growFood(dt: number): void {
    for (const p of this.plants) {
      if (p.growth < 1) p.growth = Math.min(1, p.growth + dt / FOOD.ripenTime);
    }
    this.foodCredit += FOOD.growthPerSecond * dt;
    while (this.foodCredit >= 1 && this.plants.length < FOOD.target) {
      this.foodCredit -= 1;
      const pt = this.fertilePoint();
      if (pt) this.plants.push({ x: pt.x, y: pt.y, growth: 0 });
    }
    if (this.foodCredit > 5) this.foodCredit = 5;
  }

  // ----------------------------------------------------- creature behaviour

  private actCreature(c: Creature, dt: number): void {
    c.age += dt;
    if (c.mateCooldown > 0) c.mateCooldown -= dt;

    // Baseline metabolism.
    c.energy -= c.stats.metabolism * dt;

    const carnivore = c.genome.diet === "carnivore";
    let desiredAngle = c.wanderAngle;
    let desiredSpeed = c.stats.maxSpeed * 0.55;
    let behaviour: Behaviour = "wander";

    // --- sense the surroundings -------------------------------------------
    let threat: Creature | null = null;
    let threatD = Infinity;
    let prey: Creature | null = null;
    let preyD = Infinity;
    let mate: Creature | null = null;
    let mateD = Infinity;

    const wantsToMate =
      c.age > LIFE.maturity &&
      c.mateCooldown <= 0 &&
      energyFrac(c) > LIFE.mateEnergyFrac &&
      this.creatures.length < WORLD.maxCreatures;

    this.creatureGrid.query(c.x, c.y, c.stats.vision, (idx) => {
      const o = this.creatures[idx];
      if (o === c || !o.alive) return;
      const d = dist(c.x, c.y, o.x, o.y);
      if (d > c.stats.vision) return;
      const sameDiet = o.genome.diet === c.genome.diet;
      if (!carnivore && o.genome.diet === "carnivore" && d < threatD) {
        threat = o;
        threatD = d;
      }
      if (carnivore && o.genome.diet === "herbivore" && d < preyD) {
        prey = o;
        preyD = d;
      }
      if (
        wantsToMate &&
        sameDiet &&
        o.age > LIFE.maturity &&
        o.mateCooldown <= 0 &&
        energyFrac(o) > LIFE.mateEnergyFrac &&
        d < mateD
      ) {
        mate = o;
        mateD = d;
      }
    });

    // --- decide -----------------------------------------------------------
    if (threat && threatD < c.stats.vision * 0.75) {
      // Flee directly away from the nearest predator.
      const t = threat as Creature;
      desiredAngle = Math.atan2(c.y - t.y, c.x - t.x);
      desiredSpeed = c.stats.maxSpeed;
      behaviour = "flee";
    } else if (carnivore && prey) {
      const t = prey as Creature;
      desiredAngle = Math.atan2(t.y - c.y, t.x - c.x);
      desiredSpeed = c.stats.maxSpeed;
      behaviour = "hunt";
      if (preyD < c.stats.radius + t.stats.radius + 4) {
        this.bite(c, t, dt);
      }
    } else if (mate) {
      const t = mate as Creature;
      desiredAngle = Math.atan2(t.y - c.y, t.x - c.x);
      desiredSpeed = c.stats.maxSpeed * 0.8;
      behaviour = "court";
      if (mateD < c.stats.radius + t.stats.radius + 4) {
        this.tryBreed(c, t);
      }
    } else if (!carnivore) {
      // Herbivore: head for the nearest ripe plant.
      const plant = this.nearestRipePlant(c);
      if (plant) {
        desiredAngle = Math.atan2(plant.y - c.y, plant.x - c.x);
        desiredSpeed = c.stats.maxSpeed * 0.9;
        behaviour = "forage";
        if (dist(c.x, c.y, plant.x, plant.y) < c.stats.radius + FOOD.radius) {
          this.eatPlant(c, plant);
        }
      }
    }

    // Wander: slowly drift the heading so idle creatures roam naturally.
    if (behaviour === "wander") {
      c.wanderAngle += this.rng.jitter() * 1.5 * dt;
      desiredAngle = c.wanderAngle;
    }

    c.behaviour = behaviour;
    this.steerAndMove(c, desiredAngle, desiredSpeed, dt);

    // Budding: a thriving loner that found no mate this tick divides instead,
    // so even sparse populations can grow when conditions are good.
    if (
      behaviour !== "court" &&
      c.mateCooldown <= 0 &&
      c.age > LIFE.maturity &&
      energyFrac(c) > LIFE.budEnergyFrac &&
      this.creatures.length + this.newborns.length < WORLD.maxCreatures &&
      this.rng.chance(LIFE.budChancePerSecond * dt)
    ) {
      this.bud(c);
    }

    // --- death checks -----------------------------------------------------
    if (!c.alive) return; // killed mid-step by a predator
    if (c.energy <= 0) {
      this.kill(c, "starved");
    } else if (c.age >= c.stats.maxAge) {
      this.kill(c, "oldage");
    }
    if (c.energy > c.peakEnergy) c.peakEnergy = c.energy;
  }

  private steerAndMove(c: Creature, desiredAngle: number, desiredSpeed: number, dt: number): void {
    // Turn toward the desired heading, limited by agility.
    const turn = clamp(angleDiff(c.angle, desiredAngle), -c.stats.agility * dt, c.stats.agility * dt);
    c.angle += turn;

    // Sharp turns cost speed, so agile creatures corner better than fast ones.
    const alignment = Math.cos(angleDiff(c.angle, desiredAngle));
    let speed = desiredSpeed * clamp(0.4 + 0.6 * alignment, 0.2, 1);

    // Look ahead; if we'd hit water or the edge, steer back toward open land.
    const aheadX = c.x + Math.cos(c.angle) * (c.stats.radius + 18);
    const aheadY = c.y + Math.sin(c.angle) * (c.stats.radius + 18);
    if (
      aheadX < 20 ||
      aheadY < 20 ||
      aheadX > WORLD.width - 20 ||
      aheadY > WORLD.height - 20 ||
      this.terrain.isWater(aheadX, aheadY)
    ) {
      c.wanderAngle = c.angle + this.rng.range(1.6, 2.4) * (this.rng.chance(0.5) ? 1 : -1);
      c.angle += c.stats.agility * dt * (this.rng.chance(0.5) ? 1 : -1);
      speed *= 0.4;
    }

    const nx = c.x + Math.cos(c.angle) * speed * dt;
    const ny = c.y + Math.sin(c.angle) * speed * dt;
    if (!this.terrain.isWater(nx, ny)) {
      c.x = clamp(nx, 8, WORLD.width - 8);
      c.y = clamp(ny, 8, WORLD.height - 8);
    }
    c.speed = speed;

    // Movement costs energy on top of metabolism.
    c.energy -= 0.011 * speed * dt;
  }

  private nearestRipePlant(c: Creature): Plant | null {
    let best: Plant | null = null;
    let bestD = c.stats.vision * c.stats.vision;
    this.plantGrid.query(c.x, c.y, c.stats.vision, (idx) => {
      const p = this.plants[idx];
      if (p.growth < 1) return;
      const dx = p.x - c.x;
      const dy = p.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = p;
      }
    });
    return best;
  }

  // ------------------------------------------------------- interactions

  private eatPlant(c: Creature, plant: Plant): void {
    if (plant.growth < 1) return; // already eaten this step, or not yet ripe
    const gain = FOOD.energy * c.stats.feeding;
    c.energy = Math.min(c.stats.maxEnergy, c.energy + gain);
    c.meals++;
    c.mealsSinceLog++;
    // Mark as eaten; the plants array is compacted at the end of the step so we
    // never mutate it while the spatial hash still indexes into it.
    plant.growth = -1;
    // Log feeding occasionally so the inbox has flavour without spam.
    if (c.lineageId >= 0 && c.mealsSinceLog >= 6) {
      c.mealsSinceLog = 0;
      this.pushEvent(
        "fed",
        c,
        `${c.name} is grazing well`,
        `${c.name} has eaten its fill out on the savanna — ${c.meals} meals and counting. Energy is healthy at ${Math.round(c.energy)}.`,
      );
    }
  }

  private bite(predator: Creature, victim: Creature, dt: number): void {
    const damage = predator.stats.attack * 4 * dt;
    const mitigated = damage * (1 - clamp(victim.stats.armor / (victim.stats.armor + 12), 0, 0.6));
    victim.energy -= mitigated;
    if (victim.energy <= 0 && victim.alive) {
      // Kill: the predator gains a hearty meal.
      const meal = victim.stats.maxEnergy * 0.5 + victim.stats.radius * 2;
      predator.energy = Math.min(predator.stats.maxEnergy, predator.energy + meal);
      predator.kills++;
      predator.meals++;
      if (predator.lineageId >= 0) {
        this.pushEvent(
          "killed",
          predator,
          `${predator.name} made a kill`,
          `${predator.name} ran down ${victim.name} and fed. That's ${predator.kills} kill(s) for your prowler.`,
          true,
        );
      }
      this.kill(victim, "eaten", predator.name);
    }
  }

  private tryBreed(a: Creature, b: Creature): void {
    if (this.creatures.length + this.newborns.length >= WORLD.maxCreatures) return;
    if (a.mateCooldown > 0 || b.mateCooldown > 0) return;

    a.mateCooldown = LIFE.mateCooldown;
    b.mateCooldown = LIFE.mateCooldown;
    a.energy -= a.stats.maxEnergy * LIFE.mateCost;
    b.energy -= b.stats.maxEnergy * LIFE.mateCost;
    a.offspring++;
    b.offspring++;

    const genome: Genome = breed(a.genome, b.genome, this.rng);
    const generation = Math.max(a.generation, b.generation) + 1;
    this.maxGeneration = Math.max(this.maxGeneration, generation);

    // The child inherits a player bloodline from either parent if present.
    const lineageId = a.lineageId >= 0 ? a.lineageId : b.lineageId;

    const child = makeCreature(genome, {
      x: clamp(a.x + this.rng.range(-20, 20), 10, WORLD.width - 10),
      y: clamp(a.y + this.rng.range(-20, 20), 10, WORLD.height - 10),
      angle: this.rng.range(0, TAU),
      energy: deriveMax(genome) * 0.55,
      generation,
      lineageId,
      name: generateName(this.rng),
      birthTime: this.time,
    });
    this.newborns.push(child);
    this.births++;

    if (lineageId >= 0) {
      const line = this.lineages.get(lineageId);
      if (line) {
        line.born++;
        line.alive++;
        line.bestGeneration = Math.max(line.bestGeneration, generation);
        line.extinct = false;
      }
      // Report the mating from the lineage parent's perspective.
      const parent = a.lineageId >= 0 ? a : b;
      this.pushEvent(
        "offspring",
        parent,
        `${parent.name} has bred — generation ${generation}`,
        `${parent.name} mated with ${parent === a ? b.name : a.name}. A new creature, ${child.name}, has been born into your bloodline (generation ${generation}).`,
        true,
      );
    }
  }

  private bud(c: Creature): void {
    c.mateCooldown = LIFE.mateCooldown;
    c.energy -= c.stats.maxEnergy * LIFE.budCost;
    c.offspring++;

    const genome = mutate(c.genome, this.rng);
    const generation = c.generation + 1;
    this.maxGeneration = Math.max(this.maxGeneration, generation);

    const child = makeCreature(genome, {
      x: clamp(c.x + this.rng.range(-24, 24), 10, WORLD.width - 10),
      y: clamp(c.y + this.rng.range(-24, 24), 10, WORLD.height - 10),
      angle: this.rng.range(0, TAU),
      energy: deriveMax(genome) * 0.5,
      generation,
      lineageId: c.lineageId,
      name: generateName(this.rng),
      birthTime: this.time,
    });
    this.newborns.push(child);
    this.births++;

    if (c.lineageId >= 0) {
      const line = this.lineages.get(c.lineageId);
      if (line) {
        line.born++;
        line.alive++;
        line.bestGeneration = Math.max(line.bestGeneration, generation);
        line.extinct = false;
      }
      this.pushEvent(
        "offspring",
        c,
        `${c.name} has budded — generation ${generation}`,
        `Thriving on its own, ${c.name} divided and brought ${child.name} (generation ${generation}) into your bloodline.`,
        true,
      );
    }
  }

  // --------------------------------------------------------------- death

  private kill(c: Creature, cause: LifeEventKind & string, by?: string): void {
    if (!c.alive) return;
    c.alive = false;
    c.cause = cause;
    this.deaths++;
    if (c.lineageId >= 0) {
      const line = this.lineages.get(c.lineageId);
      if (line) {
        line.alive = Math.max(0, line.alive - 1);
        line.deaths++;
        if (line.alive === 0) line.extinct = true;
      }
      const lived = Math.round(c.age);
      const msg =
        cause === "eaten"
          ? `${c.name} was hunted down and eaten${by ? ` by ${by}` : ""} after ${lived}s, leaving ${c.offspring} offspring.`
          : cause === "oldage"
            ? `${c.name} died peacefully of old age at ${lived}s, having raised ${c.offspring} offspring and eaten ${c.meals} meals.`
            : `${c.name} starved on the savanna after ${lived}s. It leaves ${c.offspring} offspring behind.`;
      this.pushEvent(cause, c, `${c.name} has died`, msg, true);
    }
  }

  private collectDead(): void {
    // Keep dead creatures out of the array but preserve order cheaply.
    let w = 0;
    for (let i = 0; i < this.creatures.length; i++) {
      if (this.creatures[i].alive) this.creatures[w++] = this.creatures[i];
    }
    this.creatures.length = w;
  }

  private compactPlants(): void {
    // Drop plants marked eaten (growth < 0) in one pass.
    let w = 0;
    for (let i = 0; i < this.plants.length; i++) {
      if (this.plants[i].growth >= 0) this.plants[w++] = this.plants[i];
    }
    this.plants.length = w;
  }

  // ------------------------------------------------------------- upkeep

  private reseedIfNeeded(): void {
    if (this.creatures.length >= WORLD.maxCreatures) return;
    let herb = 0;
    let carn = 0;
    for (const c of this.creatures) {
      if (c.genome.diet === "herbivore") herb++;
      else carn++;
    }
    // Prey safety net: top up if grazers crash.
    if (herb < LIFE.reseedThreshold) {
      for (let i = 0; i < 5; i++) this.spawnWild("herbivore");
    }
    // Predator floor: a lone prowler can't breed, so let migrants trickle in
    // while there's enough prey to support them.
    if (carn < LIFE.carnivoreFloor && herb > 20) {
      this.spawnWild("carnivore");
    }
  }

  private recordSample(): void {
    let herb = 0;
    let carn = 0;
    for (const c of this.creatures) {
      if (c.genome.diet === "herbivore") herb++;
      else carn++;
    }
    this.popHistory.push({ herb, carn });
    if (this.popHistory.length > POP_HISTORY_CAP) this.popHistory.shift();
  }

  private pushEvent(
    kind: LifeEventKind,
    c: Creature,
    headline: string,
    body: string,
    notable = false,
  ): void {
    if (c.lineageId < 0) return;
    this.events.push(makeEvent(kind, this.time, c.name, c.lineageId, headline, body, notable));
    if (this.events.length > EVENT_CAP) this.events.shift();
  }

  // ------------------------------------------------------------- queries

  stats(): WorldStats {
    let herb = 0;
    let carn = 0;
    for (const c of this.creatures) {
      if (c.genome.diet === "herbivore") herb++;
      else carn++;
    }
    return {
      herbivores: herb,
      carnivores: carn,
      plants: this.plants.length,
      population: this.creatures.length,
      births: this.births,
      deaths: this.deaths,
      generation: this.maxGeneration,
    };
  }

  /** Living creatures belonging to a player bloodline, newest first. */
  lineageMembers(lineageId: number): Creature[] {
    return this.creatures.filter((c) => c.lineageId === lineageId);
  }
}

/** Maximum energy a genome will yield once derived — used to size starting energy. */
function deriveMax(genome: Genome): number {
  return deriveStats(genome).maxEnergy;
}
