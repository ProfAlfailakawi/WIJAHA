import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ShowcaseKind = 'table' | 'podium';

const GOLD = 0xd9b865;
const metal = (c: number, r = 0.25) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.95, roughness: r });
const std = (c: number, r = 0.7, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
// Plain transparency rather than physical transmission: far cheaper, so it also runs well on phones.
const glass = () => new THREE.MeshStandardMaterial({ color: 0xcfe0ff, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });

function lathe(points: Array<[number, number]>, mat: THREE.Material, seg = 48): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function tagTexture(text: string, accent = '#d9b865'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbf7ee';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = accent;
  g.lineWidth = 10;
  g.strokeRect(14, 14, 484, 228);
  g.fillStyle = '#14213d';
  g.textAlign = 'center';
  g.font = "700 64px Alexandria, 'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Segoe UI', sans-serif";
  g.fillText(text, 256, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Abstract tricolour flag, deliberately not any real state's flag. */
function flagTexture(a: string, b: string, c2: string, vertical: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 170;
  const g = c.getContext('2d')!;
  const cols = [a, b, c2];
  cols.forEach((col, i) => {
    g.fillStyle = col;
    if (vertical) g.fillRect((256 / 3) * i, 0, 256 / 3 + 1, 170);
    else g.fillRect(0, (170 / 3) * i, 256, 170 / 3 + 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ShowcaseScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
  readonly controls: OrbitControls;
  private flags: Array<{ geo: THREE.PlaneGeometry; base: Float32Array; phase: number; dir: 1 | -1 }> = [];
  private raf = 0;
  private running = false;
  private disposed = false;
  private reduce: boolean;

  constructor(private host: HTMLElement, kind: ShowcaseKind) {
    this.reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const el = this.renderer.domElement;
    el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    el.setAttribute('data-testid', 'showcase-canvas');
    host.appendChild(el);

    this.scene.background = new THREE.Color(0x0e1630);
    this.scene.fog = new THREE.Fog(0x0e1630, 8, 22);
    this.scene.add(new THREE.HemisphereLight(0xfff3dc, 0x2a3358, 0.9));
    const key = new THREE.DirectionalLight(0xfff0d0, 2.2);
    key.position.set(-2.5, 5, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = kind === 'table' ? 2 : 7;
    key.shadow.camera.left = -s;
    key.shadow.camera.right = s;
    key.shadow.camera.top = s;
    key.shadow.camera.bottom = -s;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.01;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fb2ff, 0.9);
    rim.position.set(3, 3, -4);
    this.scene.add(rim);

    this.controls = new OrbitControls(this.camera, el);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.autoRotate = !this.reduce;
    this.controls.autoRotateSpeed = 0.6;
    this.controls.addEventListener('start', () => (this.controls.autoRotate = false));

    if (kind === 'table') this.buildTable();
    else this.buildPodium();
    this.resize();
  }

  // ------------------------------------------------------------ place setting
  private buildTable() {
    const cloth = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.05, 72), std(0xfbf7ee, 0.9));
    cloth.position.y = -0.025;
    cloth.receiveShadow = true;
    const edge = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.012, 8, 96), metal(GOLD));
    edge.rotation.x = Math.PI / 2;
    this.scene.add(cloth, edge);

    // Plates: charger (gold), dinner plate, side plate (bread) at the upper left.
    const charger = lathe([[0, 0], [0.34, 0], [0.36, 0.015], [0.34, 0.02], [0, 0.02]], metal(GOLD, 0.3));
    charger.position.set(0, 0.002, 0.25);
    const dinner = lathe([[0, 0.018], [0.24, 0.018], [0.27, 0.04], [0.26, 0.042], [0.23, 0.026], [0, 0.026]], std(0xffffff, 0.25));
    dinner.position.copy(charger.position);
    const bread = lathe([[0, 0], [0.12, 0], [0.145, 0.025], [0.135, 0.027], [0.11, 0.012], [0, 0.012]], std(0xffffff, 0.25));
    bread.position.set(0.55, 0.002, -0.05);
    this.scene.add(charger, dinner, bread);

    // Napkin folded on the plate.
    const napkin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), std(0x1b2a55, 0.95));
    napkin.position.set(0, 0.055, 0.25);
    napkin.rotation.y = 0.35;
    napkin.castShadow = true;
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.034, 0.17), metal(GOLD));
    band.position.copy(napkin.position);
    band.rotation.y = 0.35;
    this.scene.add(napkin, band);

    // Cutlery. Outside-in order: fork on the left, knife (blade towards the plate) and spoon on the right.
    const steel = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, metalness: 0.55, roughness: 0.28 });
    const fork = (x: number, len: number) => {
      const g = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, len), steel);
      handle.position.z = len / 2;
      g.add(handle);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.075), steel);
      head.position.z = len + 0.035;
      g.add(head);
      for (let i = -1.5; i <= 1.5; i++) {
        const tine = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006, 0.07), steel);
        tine.position.set(i * 0.016, 0, len + 0.1);
        g.add(tine);
      }
      g.position.set(x, 0.004, -0.25);
      g.traverse((n) => ((n as THREE.Mesh).isMesh ? ((n as THREE.Mesh).castShadow = true) : undefined));
      return g;
    };
    this.scene.add(fork(0.52, 0.34), fork(0.43, 0.3));
    const knife = new THREE.Group();
    const kh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.2), metal(GOLD, 0.3));
    kh.position.z = 0.1;
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.2), steel);
    kb.position.z = 0.3;
    knife.add(kh, kb);
    knife.position.set(-0.44, 0.004, -0.22);
    knife.traverse((n) => ((n as THREE.Mesh).isMesh ? ((n as THREE.Mesh).castShadow = true) : undefined));
    const spoon = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.28), steel);
    sh.position.z = 0.14;
    const sb = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 14), steel);
    sb.scale.set(1, 0.18, 1.45);
    sb.position.z = 0.34;
    spoon.add(sh, sb);
    spoon.position.set(-0.53, 0.004, -0.24);
    spoon.traverse((n) => ((n as THREE.Mesh).isMesh ? ((n as THREE.Mesh).castShadow = true) : undefined));
    this.scene.add(knife, spoon);

    // Glasses above the knife, on the right: water goblet then wine glass.
    const water = lathe([[0.001, 0], [0.035, 0], [0.012, 0.01], [0.012, 0.09], [0.05, 0.17], [0.058, 0.26], [0.052, 0.27], [0.044, 0.18], [0.001, 0.1]], glass(), 40);
    water.position.set(-0.42, 0, 0.66);
    const wine = lathe([[0.001, 0], [0.03, 0], [0.008, 0.008], [0.008, 0.11], [0.04, 0.17], [0.046, 0.24], [0.03, 0.29], [0.026, 0.285], [0.04, 0.24], [0.034, 0.17], [0.001, 0.12]], glass(), 40);
    wine.position.set(-0.62, 0, 0.5);
    this.scene.add(water, wine);

    // Place card standing above the plates.
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.006), new THREE.MeshStandardMaterial({ map: tagTexture('اسم الضيف'), roughness: 0.6 }));
    card.position.set(0, 0.07, 0.72);
    card.rotation.x = -0.22;
    card.castShadow = true;
    this.scene.add(card);

    // A candle and a small flower bowl as quiet decoration at the table's centre.
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.28, 20), std(0xf3ead2, 0.6));
    candle.position.set(-0.55, 0.14, 0.75);
    candle.castShadow = true;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
    flame.scale.set(1, 1.7, 1);
    flame.position.set(-0.55, 0.3, 0.75);
    const glow = new THREE.PointLight(0xffb868, 0.9, 1.6);
    glow.position.set(-0.55, 0.32, 0.75);
    this.scene.add(candle, flame, glow);

    this.camera.position.set(0, 1.5, -1.9);
    this.controls.target.set(0, 0.05, 0.25);
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 4;
  }

  // ------------------------------------------------------------ podium and flags
  private buildPodium() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 20), std(0x1a2347, 0.55, 0.1));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 3.2), std(0x6b4b22, 0.5));
    stage.position.set(0, 0.25, -3.2);
    stage.castShadow = stage.receiveShadow = true;
    const edge = new THREE.Mesh(new THREE.BoxGeometry(9.62, 0.04, 3.22), metal(GOLD));
    edge.position.set(0, 0.52, -3.2);
    this.scene.add(stage, edge);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.4), std(0x1b2a55, 0.9));
    back.position.set(0, 2.2, -4.85);
    back.receiveShadow = true;
    this.scene.add(back);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.9), new THREE.MeshStandardMaterial({ map: tagTexture('شعار الجهة', '#5eead4'), roughness: 0.7 }));
    banner.position.set(0, 3.15, -4.82);
    this.scene.add(banner);

    // Podium
    const podium = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.6), std(0x5a3f1c, 0.45));
    body.position.y = 0.575;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.07, 0.7), std(0x7a5a2a, 0.4));
    top.position.y = 1.18;
    top.rotation.x = -0.16;
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4), metal(0x222222, 0.3));
    mic.position.set(0, 1.42, 0.05);
    mic.rotation.x = 0.45;
    const crest = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), metal(GOLD));
    crest.position.set(0, 0.62, 0.305);
    podium.add(body, top, mic, crest);
    podium.position.set(0, 0.5, -3.1);
    podium.traverse((n) => ((n as THREE.Mesh).isMesh ? ((n as THREE.Mesh).castShadow = true) : undefined));
    this.scene.add(podium);

    // Flags: equal pole height, equal cloth size; the host's own flag is first on the audience's left... positions are symmetrical.
    const palettes: Array<[string, string, string, boolean]> = [
      ['#0f766e', '#e2c07a', '#312e81', true], ['#6d28d9', '#fde68a', '#0f172a', false], ['#ea8a2d', '#fbf7ee', '#0f766e', false],
      ['#334155', '#e2c07a', '#0f766e', true], ['#312e81', '#fde68a', '#6d28d9', false], ['#0f766e', '#fbf7ee', '#ea8a2d', true],
    ];
    const poleMat = metal(GOLD, 0.3);
    const place = (x: number, idx: number, dir: 1 | -1) => {
      const g = new THREE.Group();
      g.position.set(x, 0.5, -4.2);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 3.3, 14), poleMat);
      pole.position.y = 1.65;
      pole.castShadow = true;
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), poleMat);
      knob.position.y = 3.33;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.05, 20), poleMat);
      base.position.y = 0.025;
      const [a, b, c, v] = palettes[idx % palettes.length];
      const geo = new THREE.PlaneGeometry(1.1, 0.75, 14, 8);
      const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagTexture(a, b, c, v), side: THREE.DoubleSide, roughness: 0.85 }));
      flag.position.set(dir * 0.57, 2.85, 0);
      flag.castShadow = false;
      this.flags.push({ geo, base: (geo.attributes.position.array as Float32Array).slice(), phase: idx * 0.9, dir });
      g.add(pole, knob, base, flag);
      this.scene.add(g);
    };
    [-1.9, -3.3, -4.7].forEach((x, i) => place(x, i, -1));
    [1.9, 3.3, 4.7].forEach((x, i) => place(x, i + 3, 1));

    // Red-carpet aisle and the reserved front row with name cards.
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 12), std(0x8a1f2b, 0.9));
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.set(0, 0.01, 2.2);
    aisle.receiveShadow = true;
    this.scene.add(aisle);
    const chairMat = std(0x1b2a55, 0.8);
    const wood = std(0x6b4b22, 0.6);
    const chair = (x: number, z: number) => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.5), chairMat);
      seat.position.y = 0.46;
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), chairMat);
      bk.position.set(0, 0.77, -0.23);
      g.add(seat, bk);
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.46), wood);
        l.position.set(lx * 0.21, 0.23, lz * 0.21);
        g.add(l);
      }
      g.position.set(x, 0, z);
      g.rotation.y = Math.PI;
      g.traverse((n) => ((n as THREE.Mesh).isMesh ? ((n as THREE.Mesh).castShadow = (n as THREE.Mesh).receiveShadow = true) : undefined));
      this.scene.add(g);
    };
    const row = [-3.9, -3.1, -2.3, -1.5, 1.5, 2.3, 3.1, 3.9];
    row.forEach((x) => chair(x, -0.3));
    row.forEach((x) => chair(x, 0.9));
    const tag = (x: number, z: number, n: string) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshStandardMaterial({ map: tagTexture(n), roughness: 0.7 }));
      m.position.set(x, 0.9, z + 0.28);
      m.rotation.y = Math.PI;
      this.scene.add(m);
    };
    row.forEach((x, i) => tag(x, -0.3, String(i + 1)));

    const spot = new THREE.SpotLight(0xfff0d0, 90, 14, 0.5, 0.6, 1.6);
    spot.position.set(0, 6.5, 2.5);
    spot.target.position.set(0, 1, -3.1);
    this.scene.add(spot, spot.target);
    this.scene.add(new THREE.AmbientLight(0xaab6ff, 0.55));
    this.camera.position.set(0, 3.2, 7.4);
    this.controls.target.set(0, 1.5, -2);
    this.controls.minDistance = 2;
    this.controls.maxDistance = 14;
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.frame();
  }

  start() {
    if (this.running || this.disposed) return;
    this.running = true;
    const tick = () => {
      if (!this.running || this.disposed) return;
      this.frame();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame() {
    const t = performance.now() / 1000;
    if (!this.reduce) {
      for (const f of this.flags) {
        const pos = f.geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = f.base[i * 3];
          // The edge next to the pole stays still; the free edge ripples.
          const k = (Math.abs(x) * 2) / 1.1 < 1 ? ((x * f.dir + 0.55) / 1.1) : 0.5;
          pos.setZ(i, Math.sin(x * 4 - t * 3 + f.phase) * 0.06 * k);
        }
        pos.needsUpdate = true;
        f.geo.computeVertexNormals();
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  snapshot(): Promise<Blob> {
    this.frame();
    return new Promise((resolve, reject) => this.renderer.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('snapshot'))), 'image/png'));
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.controls.dispose();
    this.scene.traverse((n) => {
      const m = n as THREE.Mesh;
      m.geometry?.dispose();
      const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => {
        (x as THREE.MeshStandardMaterial).map?.dispose();
        x.dispose();
      });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
