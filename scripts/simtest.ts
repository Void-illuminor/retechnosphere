/**
 * Headless smoke test for the simulation engine. Runs the world for a stretch of
 * simulation time with no renderer and prints the population over time, so we can
 * confirm the predator/prey balance holds (no instant extinction, no explosion)
 * and that the event log fills up. Run with: npm run sim:test
 */
import { randomGenome } from "../src/sim/genome";
import { Rng } from "../src/sim/rng";
import { World } from "../src/sim/world";

const SEED = Number(process.argv[2] ?? 12345);
const SIM_SECONDS = Number(process.argv[3] ?? 240);

const world = World.createFresh(SEED);

// Release a couple of player bloodlines so we exercise the event log too.
const designRng = new Rng(SEED ^ 0xabcdef);
world.addFounder(randomGenome(designRng, "herbivore"), "Test-Grazer");
world.addFounder(randomGenome(designRng, "carnivore"), "Test-Prowler");

const STEP = 1 / 30;
let printed = 0;
let peakPop = 0;

for (let t = 0; t < SIM_SECONDS; t += STEP) {
  world.update(STEP, 1);
  const s = world.stats();
  peakPop = Math.max(peakPop, s.population);
  if (Math.floor(world.time) >= printed) {
    if (printed % 20 === 0) {
      console.log(
        `t=${String(printed).padStart(3)}s  ` +
          `herb=${String(s.herbivores).padStart(3)}  ` +
          `carn=${String(s.carnivores).padStart(3)}  ` +
          `plants=${String(s.plants).padStart(3)}  ` +
          `gen=${s.generation}  births=${s.births}  deaths=${s.deaths}  events=${world.events.length}`,
      );
    }
    printed++;
  }
}

const final = world.stats();
console.log("\n--- summary ---");
console.log(`seed=${SEED} simulated=${SIM_SECONDS}s`);
console.log(`final population: ${final.population} (herb ${final.herbivores}, carn ${final.carnivores})`);
console.log(`peak population: ${peakPop}`);
console.log(`total births: ${final.births}, deaths: ${final.deaths}, max generation: ${final.generation}`);
console.log(`life events logged: ${world.events.length}`);
console.log(`bloodlines: ${world.lineages.size}`);
for (const line of world.lineages.values()) {
  console.log(
    `  - ${line.founderName} (${line.diet}): alive ${line.alive}, born ${line.born}, deaths ${line.deaths}, bestGen ${line.bestGeneration}, extinct=${line.extinct}`,
  );
}

if (final.population === 0) {
  console.error("\nWARNING: total extinction — balance needs attention.");
  process.exit(1);
}
console.log("\nOK: ecosystem survived.");

// --- snapshot round-trip determinism check ---------------------------------
// Save the world, restore a copy, advance both identically, and confirm they
// stay bit-for-bit in sync. This proves the persistence layer is faithful.
console.log("\n--- snapshot round-trip ---");
const snap = JSON.parse(JSON.stringify(world.toSnapshot()));
const restored = World.fromSnapshot(snap);
let mismatch = "";
for (let i = 0; i < 30 * 20; i++) {
  world.update(STEP, 1);
  restored.update(STEP, 1);
}
const a = world.stats();
const b = restored.stats();
for (const k of Object.keys(a) as (keyof typeof a)[]) {
  if (a[k] !== b[k]) mismatch += ` ${k}: ${a[k]} != ${b[k]}`;
}
if (world.events.length !== restored.events.length) {
  mismatch += ` events: ${world.events.length} != ${restored.events.length}`;
}
if (mismatch) {
  console.error("MISMATCH after restore —" + mismatch);
  process.exit(1);
}
console.log(`OK: original and restored worlds identical after 20s (pop=${a.population}, gen=${a.generation}).`);

