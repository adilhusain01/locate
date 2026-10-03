// Isometric Three.js scene for the landing hero: one short trade, looped. Everything on screen is a pure
// function of the loop time t, so the step rail can jump anywhere and reduced motion can show still frames.
import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { T } from "./tokens";

export const STEP_SECONDS = 4;
export const STEPS = 5;
export const PERIOD = STEP_SECONDS * STEPS;

type Station = "holder" | "pool" | "controller" | "dex" | "trader" | "liquidator";
type Kind = "tile" | "coin" | "drip";
type Stack = "holderTiles" | "poolTiles" | "controllerCoins" | "traderCoins" | "holderDrips" | "liquidatorCoins";

// Plan positions on the ground: a is the x axis (down and right on screen), b is the z axis (down and left).
const PLAN: Record<Station, [number, number]> = {
  holder: [-5.3, 0],
  pool: [-2.0, 0],
  controller: [1.7, 0],
  dex: [5.2, -1.1],
  trader: [1.7, 3.5],
  liquidator: [-0.2, -3.4],
};

// Height of each station's top face, where stacks sit and where tokens land.
const TOP: Record<Station, number> = { holder: 0.35, pool: 1.5, controller: 1.1, dex: 0.55, trader: 0.35, liquidator: 0.35 };

function plan(a: number, b: number, y = 0) {
  return new THREE.Vector3(a, y, b);
}

type Move = { kind: Kind; from: Station; to: Station; via?: Station[]; start: number; dur: number; out?: Stack; into?: Stack };

// The story. Step 1: holders lend. Step 2: the trader posts USDG. Step 3: borrow, sell on Uniswap, book the
// proceeds. Step 4: the fee flows back to lenders. Step 5: health drops below 1 and an auction repays the pool.
const S = STEP_SECONDS;
const MOVES: Move[] = [
  ...[0, 1, 2].map((i) => ({ kind: "tile" as const, from: "holder" as const, to: "pool" as const, start: 0.5 + i * 0.75, dur: 1.4, out: "holderTiles" as const, into: "poolTiles" as const })),
  ...[0, 1, 2].map((i) => ({ kind: "coin" as const, from: "trader" as const, to: "controller" as const, start: S + 0.5 + i * 0.7, dur: 1.3, out: "traderCoins" as const, into: "controllerCoins" as const })),
  { kind: "tile", from: "pool", to: "dex", via: ["controller"], start: 2 * S + 0.4, dur: 1.9, out: "poolTiles" },
  { kind: "coin", from: "dex", to: "controller", start: 2 * S + 2.5, dur: 1.1, into: "controllerCoins" },
  ...[0, 1, 2].map((i) => ({ kind: "drip" as const, from: "controller" as const, to: "holder" as const, via: ["pool" as const], start: 3 * S + 0.4 + i * 0.7, dur: 1.9, into: "holderDrips" as const })),
  { kind: "tile", from: "liquidator", to: "pool", start: 4 * S + 0.9, dur: 1.3, into: "poolTiles" },
  ...[0, 1].map((i) => ({ kind: "coin" as const, from: "controller" as const, to: "liquidator" as const, start: 4 * S + 1.9 + i * 0.6, dur: 1.1, out: "controllerCoins" as const, into: "liquidatorCoins" as const })),
];

const BASE: Record<Stack, number> = { holderTiles: 5, poolTiles: 3, controllerCoins: 0, traderCoins: 4, holderDrips: 0, liquidatorCoins: 0 };
const MAX: Record<Stack, number> = { holderTiles: 5, poolTiles: 7, controllerCoins: 6, traderCoins: 4, holderDrips: 3, liquidatorCoins: 2 };
const STACK_AT: Record<Stack, Station> = {
  holderTiles: "holder",
  poolTiles: "pool",
  controllerCoins: "controller",
  traderCoins: "trader",
  holderDrips: "holder",
  liquidatorCoins: "liquidator",
};

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// Stack counts at time t. The loop resets by sinking every stack into its station and raising the base state.
function counts(t: number): Record<Stack, number> {
  const c = { ...BASE };
  for (const m of MOVES) {
    if (m.out && t >= m.start) c[m.out] -= 1;
    if (m.into && t >= m.start + m.dur) c[m.into] += 1;
  }
  return c;
}

function stackScale(t: number) {
  if (t > PERIOD - 0.6) return 1 - ease((t - (PERIOD - 0.6)) / 0.6);
  if (t < 0.4) return ease(t / 0.4);
  return 1;
}

export type SceneHandle = { setTime: (t: number) => void; setPlaying: (p: boolean) => void; dispose: () => void };
export type SceneOptions = { onTick: (t: number) => void; labels: Record<Station, string>; playing: boolean; startAt?: number };

export function createScene(host: HTMLElement, opts: SceneOptions): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Absolutely placed, so the canvas's pixel size never feeds back into the layout that sizes it.
  renderer.domElement.style.display = "block";
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";
  host.appendChild(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  host.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.position.set(30, 30, 30);
  camera.lookAt(0, 0, 0);

  // Light from above and to the left-front, so cylinders shade like the flat-faced blocks.
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c0ca, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(4, 14, 10);
  scene.add(sun);

  const disposables: { dispose: () => void }[] = [];
  const keep = <D extends { dispose: () => void }>(d: D) => (disposables.push(d), d);
  const mat = (color: string) => keep(new THREE.MeshLambertMaterial({ color }));
  const edgeMat = keep(new THREE.LineBasicMaterial({ color: T.ink, transparent: true, opacity: 0.55 }));

  // Iso illustration shading: the top face is the colour, the left (+z) face a step darker, the right (+x) two.
  const ink = new THREE.Color(T.ink);
  const faces = (color: string, k1 = 0.07, k2 = 0.16) => {
    const top = keep(new THREE.MeshBasicMaterial({ color }));
    const left = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(ink, k1) }));
    const right = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(ink, k2) }));
    return [right, right, top, top, left, left];
  };
  const sheet = faces(T.paper2);
  const plate = faces("#fbfbfa", 0.05, 0.1);
  const greenFaces = faces(T.lend, 0.18, 0.32);
  const cobalt = mat(T.accent);
  const cobaltTint = faces(T.accentTint, 0.06, 0.13);
  const ring = keep(new THREE.MeshBasicMaterial({ color: T.accent }));

  function block(w: number, h: number, d: number, m: THREE.Material | THREE.Material[], at: THREE.Vector3) {
    const geo = keep(new THREE.BoxGeometry(w, h, d));
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.copy(at).setY(at.y + h / 2);
    const edges = new THREE.LineSegments(keep(new THREE.EdgesGeometry(geo)), edgeMat);
    mesh.add(edges);
    scene.add(mesh);
    return mesh;
  }

  // Ground plate with a quiet one-unit grid, the drafting table everything stands on.
  const PLATE = { cx: -0.1, cz: 0.05, w: 13.4, d: 9.6 };
  block(PLATE.w, 0.3, PLATE.d, plate, plan(PLATE.cx, PLATE.cz, -0.3));
  const grid = new THREE.GridHelper(PLATE.d, PLATE.d, T.rule, T.rule);
  grid.scale.x = PLATE.w / PLATE.d;
  grid.position.set(PLATE.cx, 0.005, PLATE.cz);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  keep(grid.geometry);
  keep(grid.material as THREE.Material);
  scene.add(grid);

  const at = (s: Station, y = 0) => plan(PLAN[s][0], PLAN[s][1], y);

  // Stations.
  block(2.0, TOP.holder, 2.0, sheet, at("holder"));
  block(2.4, TOP.pool, 2.4, sheet, at("pool"));
  block(2.6, TOP.controller, 2.6, cobaltTint, at("controller"));
  block(2.0, TOP.trader, 2.0, sheet, at("trader"));
  block(1.8, TOP.liquidator, 1.8, sheet, at("liquidator"));
  const dexGeo = keep(new THREE.CylinderGeometry(1.35, 1.35, TOP.dex, 48));
  const dex = new THREE.Mesh(dexGeo, mat(T.paper2));
  dex.position.copy(at("dex", TOP.dex / 2));
  dex.add(new THREE.LineSegments(keep(new THREE.EdgesGeometry(dexGeo, 30)), edgeMat));
  scene.add(dex);

  // Health frame around the Controller: cobalt while healthy, short red once the auction step begins.
  const ringMesh = new THREE.Mesh(keep(new THREE.RingGeometry(2.05, 2.25, 4, 1, Math.PI / 4)), ring);
  ringMesh.rotation.x = -Math.PI / 2;
  ringMesh.position.copy(at("controller", 0.02));
  scene.add(ringMesh);
  const healthy = new THREE.Color(T.accent);
  const unhealthy = new THREE.Color(T.short);

  // Swap ripple on the Uniswap basin.
  const rippleMat = keep(new THREE.MeshBasicMaterial({ color: T.accent, transparent: true, opacity: 0 }));
  const ripple = new THREE.Mesh(keep(new THREE.RingGeometry(0.5, 0.58, 48)), rippleMat);
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.copy(at("dex", TOP.dex + 0.01));
  scene.add(ripple);

  // Flow paths drawn on the plate: orthogonal in plan, so they read as iso lines.
  const pathMat = keep(new THREE.LineDashedMaterial({ color: T.muted, dashSize: 0.18, gapSize: 0.14, transparent: true, opacity: 0.8 }));
  const paths: [Station, Station][] = [
    ["holder", "pool"],
    ["pool", "controller"],
    ["controller", "dex"],
    ["trader", "controller"],
    ["liquidator", "pool"],
    ["liquidator", "controller"],
  ];
  for (const [a, b] of paths) {
    const [a1, b1] = PLAN[a];
    const [a2, b2] = PLAN[b];
    const pts = a1 === a2 || b1 === b2 ? [plan(a1, b1, 0.01), plan(a2, b2, 0.01)] : [plan(a1, b1, 0.01), plan(a2, b1, 0.01), plan(a2, b2, 0.01)];
    const line = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(pts)), pathMat);
    line.computeLineDistances();
    scene.add(line);
  }

  // Token geometry.
  const tileGeo = keep(new THREE.BoxGeometry(0.62, 0.16, 0.62));
  const coinGeo = keep(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 28));
  const dripGeo = keep(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 20));
  const tileEdges = keep(new THREE.EdgesGeometry(tileGeo));
  const tokenEdge = keep(new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.45 }));

  function token(kind: Kind) {
    const mesh = new THREE.Mesh(kind === "tile" ? tileGeo : kind === "coin" ? coinGeo : dripGeo, kind === "tile" ? greenFaces : cobalt);
    if (kind === "tile") mesh.add(new THREE.LineSegments(tileEdges, tokenEdge));
    scene.add(mesh);
    return mesh;
  }

  // Stacks: fixed meshes shown up to the current count.
  const kindOf: Record<Stack, Kind> = { holderTiles: "tile", poolTiles: "tile", controllerCoins: "coin", traderCoins: "coin", holderDrips: "drip", liquidatorCoins: "coin" };
  const offset: Record<Stack, [number, number]> = {
    holderTiles: [-0.25, 0],
    poolTiles: [0, 0],
    controllerCoins: [0, 0],
    traderCoins: [0, 0],
    holderDrips: [0.55, 0.45],
    liquidatorCoins: [0, 0],
  };
  const stacks = Object.fromEntries(
    (Object.keys(MAX) as Stack[]).map((k) => {
      const kind = kindOf[k];
      const step = kind === "tile" ? 0.18 : kind === "coin" ? 0.14 : 0.1;
      const base = PLAN[STACK_AT[k]];
      const meshes = Array.from({ length: MAX[k] }, (_, i) => {
        const m = token(kind);
        m.position.copy(plan(base[0] + offset[k][0], base[1] + offset[k][1], TOP[STACK_AT[k]] + step * i + step / 2));
        return m;
      });
      return [k, meshes];
    }),
  ) as unknown as Record<Stack, THREE.Mesh[]>;

  const movers = MOVES.map((m) => ({ m, mesh: token(m.kind) }));

  // Labels.
  const labelEls: HTMLElement[] = [];
  for (const s of Object.keys(PLAN) as Station[]) {
    const el = document.createElement("div");
    el.textContent = opts.labels[s];
    el.className = "hero-label";
    labelEls.push(el);
    const obj = new CSS2DObject(el);
    // Hang each label just below the station's front corner on screen.
    const [a, b] = PLAN[s];
    const half = s === "dex" ? 1.0 : s === "controller" ? 1.55 : s === "pool" ? 1.3 : 1.1;
    if (s === "liquidator") {
      // Behind the margin block on screen, so its label sits above the station's back corner instead.
      obj.position.copy(plan(a - 0.9, b - 0.9, TOP.liquidator));
      obj.center.set(0.5, 1.5);
    } else {
      obj.position.copy(plan(a + half, b + half, 0.02));
      obj.center.set(0.5, -0.35);
    }
    scene.add(obj);
  }

  function waypoints(m: Move) {
    const chain = [m.from, ...(m.via ?? []), m.to];
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      const [a1, b1] = PLAN[chain[i]];
      const [a2, b2] = PLAN[chain[i + 1]];
      if (i === 0) pts.push(plan(a1, b1));
      if (a1 !== a2 && b1 !== b2) pts.push(plan(a2, b1));
      pts.push(plan(a2, b2));
    }
    return pts;
  }
  const routes = MOVES.map((m) => {
    const pts = waypoints(m);
    const lens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]));
    return { pts, lens, total: lens.reduce((a, b) => a + b, 0) };
  });

  const tmp = new THREE.Vector3();
  function place(t: number) {
    const sc = stackScale(t);
    const c = counts(t);
    for (const k of Object.keys(stacks) as Stack[]) {
      stacks[k].forEach((mesh, i) => {
        mesh.visible = i < c[k] && sc > 0.01;
        mesh.scale.setScalar(sc);
      });
    }
    movers.forEach(({ m, mesh }, idx) => {
      const p = (t - m.start) / m.dur;
      mesh.visible = p >= 0 && p < 1;
      if (!mesh.visible) return;
      const e = ease(p);
      const r = routes[idx];
      let d = e * r.total;
      let seg = 0;
      while (seg < r.lens.length - 1 && d > r.lens[seg]) d -= r.lens[seg++];
      tmp.lerpVectors(r.pts[seg], r.pts[seg + 1], r.lens[seg] ? d / r.lens[seg] : 0);
      const y0 = TOP[m.from] + 0.2;
      const y1 = TOP[m.to] + 0.2;
      const lift = 0.9 + 0.25 * (m.via?.length ?? 0);
      mesh.position.set(tmp.x, y0 + (y1 - y0) * e + Math.sin(Math.PI * e) * lift, tmp.z);
      mesh.scale.setScalar(m.kind === "tile" && m.to === "dex" ? 1 - 0.6 * clamp01((p - 0.85) / 0.15) : 1);
    });
    // Health ring turns red as the auction step starts, then recovers with the reset.
    const sick = t < 4 * S ? 0 : t < 4 * S + 0.8 ? (t - 4 * S) / 0.8 : t > PERIOD - 0.6 ? 1 - (t - (PERIOD - 0.6)) / 0.6 : 1;
    ring.color.copy(healthy).lerp(unhealthy, clamp01(sick));
    // Ripple when the borrowed tile hits the pool and turns into USDG.
    const rp = (t - (2 * S + 2.2)) / 0.9;
    rippleMat.opacity = rp > 0 && rp < 1 ? 0.7 * (1 - rp) : 0;
    ripple.scale.setScalar(1 + 1.6 * clamp01(rp));
    const step = Math.min(STEPS - 1, Math.floor(t / S));
    const active: Station[][] = [["holder", "pool"], ["trader", "controller"], ["pool", "controller", "dex"], ["controller", "pool", "holder"], ["controller", "liquidator", "pool"]];
    (Object.keys(PLAN) as Station[]).forEach((s, i) => labelEls[i].classList.toggle("is-active", active[step].includes(s)));
  }

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = `${w}px`;
    renderer.domElement.style.height = `${h}px`;
    labelRenderer.setSize(w, h);
    // Fit the plate's projected corners (plus headroom for stacks and hops) with a small margin.
    const centre = new THREE.Vector3(PLATE.cx, 0, PLATE.cz);
    camera.position.copy(centre).add(new THREE.Vector3(30, 30, 30));
    camera.lookAt(centre);
    camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const x of [PLATE.cx - PLATE.w / 2, PLATE.cx + PLATE.w / 2])
      for (const z of [PLATE.cz - PLATE.d / 2, PLATE.cz + PLATE.d / 2])
        for (const y of [-0.3, 2.6]) {
          v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
          minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
        }
    const pad = 0.3;
    let halfW = (maxX - minX) / 2 + pad;
    let halfH = (maxY - minY) / 2 + pad;
    const aspect = w / h;
    if (halfW / halfH < aspect) halfW = halfH * aspect; else halfH = halfW / aspect;
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    camera.left = cx - halfW; camera.right = cx + halfW; camera.top = cy + halfH; camera.bottom = cy - halfH;
    camera.updateProjectionMatrix();
    draw();
  }

  let t = opts.startAt ?? 0;
  let playing = opts.playing;
  let visible = true;
  let raf = 0;
  let last = 0;

  function draw() {
    place(t);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  function frame(now: number) {
    raf = 0;
    if (!playing || !visible || document.hidden) return;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    t = (t + dt) % PERIOD;
    draw();
    opts.onTick(t);
    raf = requestAnimationFrame(frame);
  }
  function kick() {
    if (!raf && playing && visible && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    kick();
  });
  io.observe(host);
  const onVis = () => kick();
  document.addEventListener("visibilitychange", onVis);
  resize();
  opts.onTick(t);
  kick();

  return {
    setTime(next) {
      t = ((next % PERIOD) + PERIOD) % PERIOD;
      draw();
      opts.onTick(t);
    },
    setPlaying(p) {
      playing = p;
      kick();
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    },
  };
}
