/**
 * Real-time 3D creature renderer (Three.js).
 *
 * Builds a creature as an actual 3D model from its genome — body, head on a
 * neck, glowing eyes, mouth, and 3D locomotion (wheels/legs/tracks/hover) — with
 * PBR materials, key/fill/rim lighting and soft shadows on a checkerboard floor.
 * This is the genuine "3D like the original" look: it has real depth and can be
 * rotated.
 *
 * One shared WebGL renderer drives everything (live rotating previews blit its
 * frames onto 2D canvases; roster thumbnails render once). Keeps a single GL
 * context regardless of how many creatures are shown.
 */
import * as THREE from "three";
import type { Genome } from "../sim/genome";

interface Pal {
  body: THREE.Color;
  gold: number;
  obsidian: number;
  glow: THREE.Color;
}

function palette(g: Genome): Pal {
  const carn = g.diet === "carnivore";
  const v = ((((g.hue % 50) + 50) % 50) - 25) * (carn ? 0.5 : 0.6);
  const baseH = (((carn ? 14 + v : 152 + v) % 360) + 360) % 360;
  return {
    body: new THREE.Color().setHSL(baseH / 360, carn ? 0.5 : 0.46, 0.42),
    gold: 0xc9a227,
    obsidian: 0x0a0c11,
    glow: carn ? new THREE.Color(0xff3a1e) : new THREE.Color(0x37ff8a),
  };
}

function seedHue(g: Genome): number {
  return g.hue;
}

function bodyScale(part: string): [number, number, number] {
  switch (part) {
    case "body_tank":
      return [1.0, 0.74, 0.84];
    case "body_sleek":
      return [1.34, 0.5, 0.62];
    case "body_pod":
      return [0.86, 0.86, 0.86];
    default:
      return [1.04, 0.76, 0.86];
  }
}

function headR(part: string): number {
  return part === "head_compact" ? 0.36 : 0.42;
}

// --- model assembly ----------------------------------------------------------

export function buildCreature(genome: Genome): THREE.Group {
  const pal = palette(genome);
  const carn = genome.diet === "carnivore";
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({ color: pal.body, roughness: 0.62, metalness: 0.04 });
  const gold = new THREE.MeshStandardMaterial({ color: pal.gold, roughness: 0.28, metalness: 0.95 });
  const obs = new THREE.MeshStandardMaterial({ color: pal.obsidian, roughness: 0.12, metalness: 0.55 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x111417,
    emissive: pal.glow,
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.3,
  });

  const [bx, by, bz] = bodyScale(genome.parts.body);
  const front = bz; // +Z is forward

  // BODY
  let body: THREE.Mesh;
  if (genome.parts.body === "body_tank") {
    body = new THREE.Mesh(new THREE.BoxGeometry(bx * 2, by * 2, bz * 2), stone);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(bx * 2.02, by * 0.32, bz * 2.02), gold);
    edge.position.y = 0;
    g.add(edge);
  } else {
    body = new THREE.Mesh(new THREE.SphereGeometry(1, 36, 28), stone);
    body.scale.set(bx, by, bz);
  }
  body.castShadow = true;
  g.add(body);

  // Aztec gold belt (greca) — a flat ring around the body
  const belt = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 10, 40), gold);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(bx * 0.98, bz * 0.98, by * 0.9);
  belt.position.y = -by * 0.05;
  g.add(belt);

  // HEAD on a neck, at the front
  const hr = headR(genome.parts.head);
  const headZ = front + hr * 0.7;
  const headY = by * 0.35;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.55, hr * 0.7, hr * 1.1, 16), stone);
  neck.position.set(0, headY * 0.5, front * 0.7);
  neck.rotation.x = Math.PI / 2.3;
  g.add(neck);

  const head = new THREE.Mesh(
    genome.parts.head === "head_blunt"
      ? new THREE.BoxGeometry(hr * 1.8, hr * 1.7, hr * 1.8)
      : new THREE.SphereGeometry(hr, 28, 22),
    stone,
  );
  head.position.set(0, headY, headZ);
  if (genome.parts.head === "head_compact") head.scale.set(1, 0.9, 1);
  head.castShadow = true;
  g.add(head);

  // EYES (gold-ringed, glowing)
  const eyeR = genome.parts.eyes === "eyes_night" ? hr * 0.34 : hr * 0.22;
  const eyePositions: [number, number, number][] =
    genome.parts.eyes === "eyes_compound"
      ? [[-0.4, 0.2, 0.85], [0.4, 0.2, 0.85], [-0.5, -0.05, 0.8], [0.5, -0.05, 0.8], [0, 0.35, 0.9]]
      : genome.parts.eyes === "eyes_telescopic"
        ? [[-0.25, 0.5, 0.8], [0.25, 0.5, 0.8]]
        : [[-0.38, 0.12, 0.86], [0.38, 0.12, 0.86]];
  for (const [ex, ey, ez] of eyePositions) {
    const er = genome.parts.eyes === "eyes_compound" ? eyeR * 0.7 : eyeR;
    const px = ex * hr;
    const py = headY + ey * hr;
    const pz = headZ + ez * hr;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(er * 1.15, er * 0.32, 10, 20), gold);
    ring.position.set(px, py, pz);
    g.add(ring);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(er, 18, 14), eyeMat);
    ball.position.set(px, py, pz + er * 0.2);
    g.add(ball);
    if (genome.parts.eyes === "eyes_telescopic") {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(er * 0.3, er * 0.3, hr * 0.8, 10), obs);
      stalk.position.set(px, headY + 0.25 * hr, headZ + 0.5 * hr);
      g.add(stalk);
    }
  }

  // MOUTH
  const mouthY = headY - hr * 0.5;
  const mouthZ = headZ + hr * 0.7;
  if (genome.parts.mouth === "mouth_shear" || genome.parts.mouth === "mouth_fangs") {
    const maw = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.42, 16, 12), new THREE.MeshStandardMaterial({ color: 0x180c0c, roughness: 0.5 }));
    maw.scale.set(1, 0.7, 0.6);
    maw.position.set(0, mouthY, mouthZ);
    g.add(maw);
    const teeth = new THREE.MeshStandardMaterial({ color: 0xeef2f7, roughness: 0.3 });
    const n = genome.parts.mouth === "mouth_shear" ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.07, hr * 0.22, 6), teeth);
      t.position.set(-hr * 0.28 + (i / (n - 1)) * hr * 0.56, mouthY + hr * 0.12, mouthZ + hr * 0.05);
      t.rotation.x = Math.PI;
      g.add(t);
    }
  } else if (genome.parts.mouth === "mouth_beak") {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(hr * 0.3, hr * 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xd8c062, roughness: 0.4, metalness: 0.2 }));
    beak.position.set(0, mouthY, mouthZ + hr * 0.1);
    beak.rotation.x = Math.PI / 2;
    g.add(beak);
  } else {
    const m = new THREE.Mesh(new THREE.TorusGeometry(hr * 0.22, hr * 0.05, 8, 16), obs);
    m.position.set(0, mouthY, mouthZ);
    g.add(m);
  }

  // SENSORS / ANTENNAE
  if (genome.parts.head === "head_antenna" || genome.parts.head === "head_sensor") {
    const n = genome.parts.head === "head_sensor" ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const ax = (-0.4 + (i / (n - 1)) * 0.8) * hr;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(hr * 0.06, hr * 0.06, hr * 0.9, 8), gold);
      stalk.position.set(ax, headY + hr * 1.1, headZ - hr * 0.2);
      g.add(stalk);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(hr * 0.16, 12, 10), eyeMat);
      tip.position.set(ax, headY + hr * 1.6, headZ - hr * 0.2);
      g.add(tip);
    }
  }

  // CREST (feathered-serpent plumes / spines along the back)
  const crestN = carn ? 7 : 4;
  for (let i = 0; i < crestN; i++) {
    const t = i / Math.max(1, crestN - 1);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(by * 0.16, by * (0.7 + (i % 2) * 0.2), 6),
      i % 2 === 0 ? gold : stone,
    );
    cone.position.set(0, by * 0.85, (0.5 - t) * bz * 1.4);
    cone.rotation.x = -0.5;
    cone.castShadow = true;
    g.add(cone);
  }

  // LOCOMOTION
  addLocomotion(g, genome.parts.locomotion, bx, by, bz, gold, obs);

  // normalise every creature to a similar footprint, then rest it on y=0
  const box = new THREE.Box3().setFromObject(g);
  const size = new THREE.Vector3();
  box.getSize(size);
  const k = 2.2 / Math.max(size.x, size.y, size.z, 0.001);
  g.scale.setScalar(k);
  const box2 = new THREE.Box3().setFromObject(g);
  g.position.y -= box2.min.y;
  void seedHue;
  return g;
}

function wheelMesh(r: number, gold: THREE.Material, obs: THREE.Material): THREE.Group {
  const w = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.32, 14, 28), obs);
  tyre.castShadow = true;
  w.add(tyre);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.34, r * 0.34, r * 0.45, 16), gold);
  hub.rotation.x = Math.PI / 2;
  w.add(hub);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 0.08, r * 1.2, r * 0.08), gold);
    spoke.rotation.z = (i / 5) * Math.PI;
    w.add(spoke);
  }
  w.rotation.y = Math.PI / 2; // axle along X
  return w;
}

function addLocomotion(g: THREE.Group, part: string, bx: number, by: number, bz: number, gold: THREE.Material, obs: THREE.Material): void {
  const wy = -by * 0.55;
  switch (part) {
    case "loco_bigwheels": {
      const r = Math.min(0.5, by * 0.9);
      for (const sx of [-1, 1]) {
        const w = wheelMesh(r, gold, obs);
        w.position.set(sx * bx * 0.85, wy, 0);
        g.add(w);
      }
      break;
    }
    case "loco_mono": {
      const r = Math.min(0.7, bx * 0.7);
      const w = wheelMesh(r, gold, obs);
      w.position.set(0, -by * 0.5, 0);
      g.add(w);
      break;
    }
    case "loco_tracks": {
      const tread = new THREE.Mesh(new THREE.BoxGeometry(bx * 2.1, by * 0.6, bz * 1.4), obs);
      tread.position.set(0, -by * 0.55, 0);
      tread.castShadow = true;
      g.add(tread);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const w = wheelMesh(by * 0.34, gold, obs);
          w.position.set(sx * bx * 0.9, -by * 0.55, sz * bz * 0.6);
          g.add(w);
        }
      }
      break;
    }
    case "loco_legs": {
      const legMat = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.5, metalness: 0.3 });
      for (const sx of [-1, 1]) {
        for (const sz of [-0.6, 0, 0.6]) {
          const hip = new THREE.Vector3(sx * bx * 0.7, -by * 0.2, sz * bz);
          const foot = new THREE.Vector3(sx * bx * 1.15, -by - 0.45, sz * bz * 1.1);
          const leg = cylinderBetween(hip, foot, 0.07, legMat);
          leg.castShadow = true;
          g.add(leg);
        }
      }
      break;
    }
    case "loco_hover": {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(bx * 0.95, bx * 0.7, by * 0.18, 28),
        new THREE.MeshStandardMaterial({ color: 0x2f7fc0, emissive: 0x39a0ff, emissiveIntensity: 1.4, roughness: 0.3 }),
      );
      disc.position.set(0, -by * 0.7, 0);
      g.add(disc);
      break;
    }
  }
}

function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.7, len, 8), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return m;
}

// --- shared studio (one WebGL context) --------------------------------------

class Studio {
  readonly renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private floor: THREE.Mesh;
  private current?: THREE.Group;
  available = true;

  constructor() {
    const canvas = document.createElement("canvas");
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(3.4, 2.6, 4.6);
    this.camera.lookAt(0, 0.75, 0);

    const key = new THREE.DirectionalLight(0xfff1e0, 2.1);
    key.position.set(-3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 20;
    (key.shadow.camera as THREE.OrthographicCamera).left = -4;
    (key.shadow.camera as THREE.OrthographicCamera).right = 4;
    (key.shadow.camera as THREE.OrthographicCamera).top = 4;
    (key.shadow.camera as THREE.OrthographicCamera).bottom = -4;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5fa8ff, 0.7);
    rim.position.set(2, 1.5, -4);
    this.scene.add(rim);
    this.scene.add(new THREE.HemisphereLight(0x9fc2ff, 0x1a130c, 0.5));

    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: 0.9 }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);
  }

  private setModel(genome: Genome): void {
    if (this.current) {
      this.scene.remove(this.current);
      disposeGroup(this.current);
    }
    this.current = buildCreature(genome);
    this.scene.add(this.current);
  }

  /** Render one frame for `genome` at w×h px, rotated `rotY` rad; returns the GL canvas. */
  render(genome: Genome, rotY: number, w: number, h: number, floor: boolean): HTMLCanvasElement {
    this.floor.visible = floor;
    if (!this.current || this.current.userData.key !== keyOf(genome)) {
      this.setModel(genome);
      this.current!.userData.key = keyOf(genome);
    }
    this.current!.rotation.y = rotY;
    if (this.renderer.domElement.width !== w || this.renderer.domElement.height !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement;
  }
}

let studioSingleton: Studio | null = null;
export function getStudio(): Studio | null {
  if (typeof document === "undefined") return null;
  try {
    if (!studioSingleton) studioSingleton = new Studio();
    return studioSingleton;
  } catch {
    return null; // WebGL unavailable
  }
}

function keyOf(g: Genome): string {
  return g.diet + g.parts.head + g.parts.body + g.parts.locomotion + g.parts.eyes + g.parts.mouth + Math.round(g.hue);
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) {
      const mat = m.material as THREE.Material | THREE.Material[];
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat.dispose();
    }
  });
}

let checkerTex: THREE.CanvasTexture | null = null;
function checkerTexture(): THREE.CanvasTexture {
  if (checkerTex) return checkerTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#26303a" : "#1a232e";
      ctx.fillRect(x * 32, y * 32, 32, 32);
    }
  }
  checkerTex = new THREE.CanvasTexture(c);
  checkerTex.wrapS = checkerTex.wrapT = THREE.RepeatWrapping;
  checkerTex.repeat.set(6, 6);
  return checkerTex;
}
