import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ROOM, type Furniture, type Plan } from '../../shared/visuals/seating.ts';
import { floorTexture, labelTexture, rugTexture, wallTexture } from './textures.ts';

/** One metre = 60 plan pixels, so the 800 x 520 room becomes about 13.3 x 8.7 m. */
const S = 1 / 60;
const W = ROOM.w * S;
const D = ROOM.h * S;
const GOLD = 0xd9b865;

export interface HallSeat {
  id: string;
  label: string;
  role?: string;
  rank: number;
  x: number;
  y: number;
  facing: number;
}

export type CameraPreset = 'overview' | 'chief' | 'host' | 'door';

export interface HallSceneOptions {
  /** false: no orbit controls or picking (used as a decorative backdrop). Default true. */
  interactive?: boolean;
  /** false: hide the floating name labels. Default true. */
  labels?: boolean;
}

interface Walk {
  id: string;
  path: THREE.Vector3[];
  lengths: number[];
  total: number;
  t0: number;
  speed: number;
}

export interface HallState {
  plan: Plan;
  seats: HallSeat[];
  selectedId?: string | null;
  warnIds?: string[];
  rtl: boolean;
}

interface Person {
  group: THREE.Group;
  /** The figure alone (inside `group`), moved on its own while a guest walks in. */
  body: THREE.Group;
  thighs: THREE.Mesh;
  legs: THREE.Group;
  chair: THREE.Group;
  label: THREE.Sprite;
  ring: THREE.Mesh;
  target: THREE.Vector3;
  targetYaw: number;
  key: string;
}

const wx = (px: number) => (px - ROOM.w / 2) * S;
const wz = (py: number) => (py - ROOM.h / 2) * S;
const yawOf = (facingDeg: number) => Math.PI / 2 - (facingDeg * Math.PI) / 180;

function disposeObject(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
    if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => {
      (x as THREE.MeshStandardMaterial).map?.dispose();
      x.dispose();
    });
  });
}

export class HallScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private room = new THREE.Group();
  private furniture = new THREE.Group();
  private people = new Map<string, Person>();
  private peopleGroup = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private tween: { fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t0: number; dur: number } | null = null;
  private flame: THREE.PointLight | null = null;
  private raf = 0;
  private running = false;
  private disposed = false;
  private state: HallState | null = null;
  private labelKey = new Map<string, string>();
  private reduce: boolean;
  private walks: Walk[] = [];
  private walkDone: (() => void) | null = null;
  private readonly opts: Required<HallSceneOptions>;
  onPick: ((id: string) => void) | null = null;

  constructor(private host: HTMLElement, opts: HallSceneOptions = {}) {
    this.opts = { interactive: opts.interactive ?? true, labels: opts.labels ?? true };
    this.reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = this.opts.interactive ? 'none' : 'auto';
    this.renderer.domElement.setAttribute('data-testid', 'hall3d-canvas');
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0e1630);
    this.scene.fog = new THREE.Fog(0x0e1630, 16, 34);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.minDistance = 0.4;
    this.controls.maxDistance = 20;
    this.controls.autoRotate = !this.reduce;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.enabled = this.opts.interactive;
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
      this.tween = null;
    });

    this.buildLights();
    this.buildRoom();
    this.scene.add(this.room, this.furniture, this.peopleGroup);
    this.setPreset('overview', true);
    this.resize();

    let downAt = 0;
    let downX = 0;
    let downY = 0;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      downAt = performance.now();
      downX = e.clientX;
      downY = e.clientY;
    });
    el.addEventListener('pointerup', (e) => {
      if (!this.opts.interactive) return;
      if (performance.now() - downAt < 350 && Math.hypot(e.clientX - downX, e.clientY - downY) < 6) this.pick(e);
    });
  }

  // ----------------------------------------------------------------- environment
  private buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff3dc, 0x2a3358, 0.85));
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.5);
    sun.position.set(-4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.flame = new THREE.PointLight(0xffa24a, 0, 4);
    this.scene.add(this.flame);
  }

  private buildRoom() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.38, metalness: 0.05 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.room.add(floor);
    // A dark apron so the hall reads as a room in a larger space.
    const apron = new THREE.Mesh(new THREE.RingGeometry(0.01, 1, 4), new THREE.MeshBasicMaterial({ visible: false }));
    this.room.add(apron);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture(), roughness: 0.8 });
    const wallH = 3.2;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, wallH), wallMat);
    back.position.set(0, wallH / 2, -D / 2);
    back.receiveShadow = true;
    const left = new THREE.Mesh(new THREE.PlaneGeometry(D, wallH), wallMat.clone());
    left.rotation.y = Math.PI / 2;
    left.position.set(-W / 2, wallH / 2, 0);
    const right = left.clone();
    right.rotation.y = -Math.PI / 2;
    right.position.x = W / 2;
    // Front wall with the door gap. Planes face inward, so from outside (overview camera) they are culled and never block the view.
    const gap = 2.1;
    const sideW = (W - gap) / 2;
    for (const sx of [-1, 1]) {
      const fw = new THREE.Mesh(new THREE.PlaneGeometry(sideW, wallH), wallMat.clone());
      fw.rotation.y = Math.PI;
      fw.position.set(sx * (gap / 2 + sideW / 2), wallH / 2, D / 2);
      this.room.add(fw);
    }
    const above = new THREE.Mesh(new THREE.PlaneGeometry(gap, wallH - 2.62), wallMat.clone());
    above.rotation.y = Math.PI;
    above.position.set(0, 2.62 + (wallH - 2.62) / 2, D / 2);
    this.room.add(back, left, right, above);
    // Gold skirting
    const skirtMat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.7, roughness: 0.35 });
    for (const [w, x, z, ry] of [[W, 0, -D / 2 + 0.02, 0], [D, -W / 2 + 0.02, 0, Math.PI / 2], [D, W / 2 - 0.02, 0, Math.PI / 2]] as const) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.05), skirtMat);
      s.position.set(x, 0.06, z);
      s.rotation.y = ry;
      this.room.add(s);
    }
    // Door frame (the door is at the bottom of the plan, centred).
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x8a6a2a, metalness: 0.5, roughness: 0.4 });
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.6, 0.14), frameMat);
      post.position.set(sx * 1.05, 1.3, D / 2);
      post.castShadow = true;
      this.room.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 0.14), frameMat);
    lintel.position.set(0, 2.62, D / 2);
    this.room.add(lintel);
    // Chandeliers
    const glow = new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffc860, emissiveIntensity: 1.4, metalness: 0.6, roughness: 0.3 });
    for (const x of [-W / 4, W / 4]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 12, 48), glow);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 3.0, 0);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6), frameMat);
      rod.position.set(x, 3.3, 0);
      this.room.add(ring, rod);
    }
  }

  // ----------------------------------------------------------------- furniture
  private clothed(radiusTop: number, h: number, color = 0xfbf7ee): THREE.Group {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusTop, 0.05, 56), new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    top.position.y = h;
    top.castShadow = top.receiveShadow = true;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop * 0.96, radiusTop * 1.02, h, 56, 1, true), new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }));
    skirt.position.y = h / 2;
    skirt.castShadow = true;
    const edge = new THREE.Mesh(new THREE.TorusGeometry(radiusTop, 0.012, 8, 64), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.8, roughness: 0.3 }));
    edge.rotation.x = Math.PI / 2;
    edge.position.y = h + 0.026;
    g.add(top, skirt, edge);
    return g;
  }

  private box(w: number, h: number, d: number, color: number, y: number, x = 0, z = 0, rough = 0.7): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: rough }));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  private buildFurniture(items: Furniture[]) {
    for (const c of [...this.furniture.children]) {
      this.furniture.remove(c);
      disposeObject(c);
    }
    for (const f of items) {
      if (f.kind === 'ellipse') {
        const t = this.clothed(((f.rx + f.ry) / 2) * S, 0.76);
        t.position.set(wx(f.cx), 0, wz(f.cy));
        this.furniture.add(t);
      } else if (f.kind === 'rrect') {
        const w = f.w * S;
        const d = f.h * S;
        const cx = wx(f.x + f.w / 2);
        const cz = wz(f.y + f.h / 2);
        const tone = f.tone ?? 'table';
        const g = new THREE.Group();
        g.position.set(cx, 0, cz);
        if (tone === 'rug') {
          const t = rugTexture();
          const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
          m.rotation.x = -Math.PI / 2;
          m.position.y = 0.012;
          m.receiveShadow = true;
          g.add(m);
        } else if (tone === 'stage') {
          g.add(this.box(w, 0.4, d, 0x6b4b22, 0.2));
          g.add(this.box(w, 0.02, d, 0xb8923a, 0.41));
        } else if (tone === 'sofa') {
          g.add(this.box(w, 0.4, d, 0x8a2f3b, 0.2, 0, 0, 0.9));
          const along = w > d;
          g.add(along ? this.box(w, 0.42, Math.min(0.28, d * 0.4), 0x7a2632, 0.6, 0, -d / 2 + 0.14, 0.9) : this.box(Math.min(0.28, w * 0.4), 0.42, d, 0x7a2632, 0.6, f.x < ROOM.w / 2 ? -w / 2 + 0.14 : w / 2 - 0.14, 0, 0.9));
        } else if (tone === 'low') {
          g.add(this.box(w, 0.05, d, 0x7a5a2a, 0.36, 0, 0, 0.4));
          for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(this.box(0.05, 0.34, 0.05, 0x5a3f1c, 0.17, (sx * (w - 0.1)) / 2, (sz * (d - 0.1)) / 2));
        } else {
          g.add(this.box(w, 0.05, d, 0xfbf7ee, 0.76, 0, 0, 0.85));
          g.add(this.box(w * 0.97, 0.72, d * 0.97, 0xfbf7ee, 0.36, 0, 0, 0.9));
          const e = this.box(w + 0.02, 0.02, d + 0.02, GOLD, 0.79, 0, 0, 0.3);
          (e.material as THREE.MeshStandardMaterial).metalness = 0.8;
          g.add(e);
        }
        this.furniture.add(g);
      } else if (f.kind === 'podium') {
        const g = new THREE.Group();
        g.position.set(wx(f.x), 0, wz(f.y));
        g.add(this.box(0.7, 1.1, 0.5, 0x5a3f1c, 0.55));
        const top = this.box(0.76, 0.06, 0.56, 0x7a5a2a, 1.13);
        top.rotation.x = -0.18;
        g.add(top);
        const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8 }));
        mic.position.set(0, 1.3, 0.05);
        mic.rotation.x = 0.5;
        g.add(mic);
        this.furniture.add(g);
      } else if (f.kind === 'brazier') {
        const g = new THREE.Group();
        g.position.set(wx(f.x), 0, wz(f.y));
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.14, 0.2, 24), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.7, roughness: 0.4 }));
        bowl.position.y = 0.42;
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.7 }));
        stand.position.y = 0.16;
        const ember = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff6a00, emissiveIntensity: 2 }));
        ember.rotation.x = -Math.PI / 2;
        ember.position.y = 0.52;
        g.add(bowl, stand, ember);
        this.furniture.add(g);
        if (this.flame) {
          this.flame.position.set(wx(f.x), 0.8, wz(f.y));
          this.flame.intensity = 1.2;
        }
      } else if (f.kind === 'coffee') {
        const g = new THREE.Group();
        g.position.set(wx(f.x), 0.38, wz(f.y));
        const pts = [[0.001, 0], [0.1, 0], [0.13, 0.06], [0.07, 0.2], [0.04, 0.3], [0.06, 0.36], [0.02, 0.4]].map(([x, y]) => new THREE.Vector2(x, y));
        const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshStandardMaterial({ color: 0xc89a3c, metalness: 0.9, roughness: 0.25 }));
        body.castShadow = true;
        g.add(body);
        this.furniture.add(g);
      }
    }
  }

  // ----------------------------------------------------------------- people
  private makeChair(): THREE.Group {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4b22, roughness: 0.6 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.46), new THREE.MeshStandardMaterial({ color: 0x1b2a55, roughness: 0.8 }));
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), new THREE.MeshStandardMaterial({ color: 0x1b2a55, roughness: 0.8 }));
    back.position.set(0, 0.75, -0.22);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45), wood);
      leg.position.set(x * 0.2, 0.225, z * 0.2);
      g.add(leg);
    }
    g.add(seat, back);
    g.traverse((n) => ((n as THREE.Mesh).isMesh ? ((n as THREE.Mesh).castShadow = true) : undefined));
    return g;
  }

  private makePerson(seat: HallSeat, tier: 'host' | 'chief' | 'guest'): Person {
    const group = new THREE.Group();
    const body = tier === 'host' ? 0x14213d : tier === 'chief' ? 0x0f5f58 : 0x3b4a6b;
    const mat = new THREE.MeshStandardMaterial({ color: body, roughness: 0.55, metalness: 0.1 });
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.38, 6, 16), mat);
    torso.position.y = 0.95;
    const shoulders = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.34, 6, 12), mat);
    shoulders.rotation.z = Math.PI / 2;
    shoulders.position.y = 1.14;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 24, 18), new THREE.MeshStandardMaterial({ color: 0xe9d3b6, roughness: 0.5 }));
    head.position.y = 1.4;
    const thighs = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 10), mat);
    thighs.rotation.x = Math.PI / 2;
    thighs.position.set(0, 0.55, 0.2);
    const sash = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 8, 32), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.8, roughness: 0.3 }));
    sash.rotation.x = Math.PI / 2;
    sash.position.y = 0.82;
    // Standing legs, shown only while the guest walks in (the seated figure uses `thighs`).
    const legs = new THREE.Group();
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 10), mat);
      leg.position.set(sx * 0.09, 0.3, 0);
      legs.add(leg);
    }
    legs.visible = false;
    group.add(torso, shoulders, head, thighs, legs);
    if (tier !== 'guest') group.add(sash);
    group.traverse((n) => ((n as THREE.Mesh).isMesh ? ((n as THREE.Mesh).castShadow = true) : undefined));
    group.position.y = 0;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: 0xffd770, transparent: true, opacity: 0.0, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    label.position.set(0, 1.85, 0);
    label.renderOrder = 10;
    label.visible = this.opts.labels;
    const chair = this.makeChair();
    const outer = new THREE.Group();
    outer.add(chair, group, ring, label);
    this.peopleGroup.add(outer);
    return { group: outer, body: group, thighs, legs, chair, label, ring, target: new THREE.Vector3(), targetYaw: 0, key: seat.id };
  }

  private applyLabel(p: Person, seat: HallSeat, accent: string) {
    if (!this.opts.labels) return;
    const key = `${seat.label}|${seat.role ?? ''}|${this.state?.rtl ? 1 : 0}|${accent}`;
    if (this.labelKey.get(seat.id) === key) return;
    this.labelKey.set(seat.id, key);
    const { tex, aspect } = labelTexture(seat.label, seat.role, !!this.state?.rtl, accent);
    const mat = p.label.material as THREE.SpriteMaterial;
    mat.map?.dispose();
    mat.map = tex;
    mat.needsUpdate = true;
    p.label.scale.set(1.5 * Math.min(1, aspect / 3.2) + 0.2, (1.5 * Math.min(1, aspect / 3.2) + 0.2) / aspect, 1);
  }

  update(state: HallState) {
    this.state = state;
    this.buildFurniture(state.plan.furniture);
    const seen = new Set<string>();
    for (const seat of state.seats) {
      seen.add(seat.id);
      let p = this.people.get(seat.id);
      const tier = seat.rank === 1 ? 'host' : seat.rank === 2 ? 'chief' : 'guest';
      if (!p) {
        p = this.makePerson(seat, tier);
        this.people.set(seat.id, p);
        p.group.position.set(wx(seat.x), 0, wz(seat.y));
        p.group.rotation.y = yawOf(seat.facing);
      }
      p.target.set(wx(seat.x), 0, wz(seat.y));
      p.targetYaw = yawOf(seat.facing);
      const warn = state.warnIds?.includes(seat.id);
      this.applyLabel(p, seat, warn ? '#ff6b6b' : tier === 'guest' ? '#d9b865' : '#5eead4');
      (p.ring.material as THREE.MeshBasicMaterial).opacity = state.selectedId === seat.id ? 0.95 : warn ? 0.7 : 0;
      (p.ring.material as THREE.MeshBasicMaterial).color.set(warn && state.selectedId !== seat.id ? 0xff6b6b : 0xffd770);
    }
    for (const [id, p] of this.people) {
      if (!seen.has(id)) {
        this.peopleGroup.remove(p.group);
        disposeObject(p.group);
        this.people.delete(id);
        this.labelKey.delete(id);
      }
    }
    this.requestFrame();
  }

  // ----------------------------------------------------------------- camera
  setPreset(preset: CameraPreset, instant = false) {
    const seats = this.state?.seats ?? [];
    const find = (rank: number) => seats.find((s) => s.rank === rank);
    let viewer: string | null = null;
    let pos = new THREE.Vector3(0, 7.2, 8.2);
    let tgt = new THREE.Vector3(0, 0.5, 0.2);
    if (preset === 'chief' || preset === 'host') {
      const me = find(preset === 'chief' ? 2 : 1);
      const other = find(preset === 'chief' ? 1 : 2) ?? find(1);
      if (me && other) {
        viewer = me.id;
        pos = new THREE.Vector3(wx(me.x), 1.3, wz(me.y));
        // First-person: look the way this seat faces, which is what the person actually sees.
        const dir = new THREE.Vector3(Math.cos((me.facing * Math.PI) / 180), 0, Math.sin((me.facing * Math.PI) / 180));
        void other;
        pos.addScaledVector(dir, -0.05);
        tgt = pos.clone().addScaledVector(dir, 1.2);
        tgt.y = 1.1;
      }
    } else if (preset === 'door') {
      pos = new THREE.Vector3(0, 1.7, D / 2 + 0.6);
      tgt = new THREE.Vector3(0, 1.0, -1.5);
    }
    // In a first-person view the viewer's own figure would block the camera, so it is hidden.
    for (const [id, person] of this.people) person.group.visible = id !== viewer;
    this.controls.autoRotate = false;
    if (instant || this.reduce) {
      this.camera.position.copy(pos);
      this.controls.target.copy(tgt);
      this.tween = null;
      this.controls.update();
    } else {
      this.tween = { fromP: this.camera.position.clone(), toP: pos, fromT: this.controls.target.clone(), toT: tgt, t0: performance.now(), dur: 1000 };
    }
    this.requestFrame();
  }

  // ----------------------------------------------------------------- loop
  resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestFrame();
  }

  private pick(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    for (const [id, p] of this.people) {
      const hits = this.raycaster.intersectObject(p.group, true).filter((h) => h.object !== p.ring);
      if (hits.length) {
        this.onPick?.(id);
        return;
      }
    }
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

  private requestFrame() {
    if (!this.running) this.frame();
  }

  private frame() {
    const now = performance.now();
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.camera.position.lerpVectors(this.tween.fromP, this.tween.toP, e);
      this.controls.target.lerpVectors(this.tween.fromT, this.tween.toT, e);
      if (k >= 1) this.tween = null;
    }
    for (const p of this.people.values()) {
      p.group.position.lerp(p.target, this.reduce ? 1 : 0.14);
      let dy = p.targetYaw - p.group.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      p.group.rotation.y += dy * (this.reduce ? 1 : 0.2);
      const ringM = p.ring.material as THREE.MeshBasicMaterial;
      if (ringM.opacity > 0.9) ringM.opacity = 0.75 + 0.2 * Math.sin(now / 250);
    }
    if (this.walks.length) this.stepWalks(now);
    if (this.flame && this.flame.intensity > 0 && !this.reduce) this.flame.intensity = 1.1 + 0.25 * Math.sin(now / 90) * Math.sin(now / 37);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // ----------------------------------------------------------------- guests enter
  /** The drawing surface, e.g. for recording a clip with MediaRecorder. */
  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  private resetBody(p: Person) {
    p.body.position.set(0, 0, 0);
    p.body.rotation.set(0, 0, 0);
    p.body.visible = true;
    p.legs.visible = false;
    p.thighs.visible = true;
    p.label.position.set(0, 1.85, 0);
  }

  /**
   * Walk every guest in from the door to his seat, one after another in order of precedence (rank 1 first).
   * Each figure is moved inside its own seat group, so seat data and the plan never change. Resolves when all
   * are seated (immediately with reduced motion).
   */
  walkIn(): Promise<void> {
    this.walkDone?.();
    this.walks = [];
    for (const p of this.people.values()) this.resetBody(p);
    const seats = [...(this.state?.seats ?? [])].sort((a, b) => a.rank - b.rank);
    if (this.reduce || !seats.length) return Promise.resolve();
    const door = new THREE.Vector3(0, 0, D / 2 + 0.6);
    const inside = new THREE.Vector3(0, 0, D / 2 - 0.9);
    const now = performance.now();
    seats.forEach((seat, i) => {
      const p = this.people.get(seat.id);
      if (!p) return;
      const end = new THREE.Vector3(wx(seat.x), 0, wz(seat.y));
      // Go round the outside of the table: along a circle about the room centre, a little beyond the seat.
      const r = Math.min(Math.hypot(end.x, end.z) + 0.75, Math.min(W, D) / 2 - 0.35);
      const a0 = Math.atan2(inside.z, inside.x);
      let a1 = Math.atan2(end.z, end.x);
      let da = a1 - a0;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      a1 = a0 + da;
      const path = [door, inside];
      const steps = Math.max(1, Math.ceil(Math.abs(da) / 0.25));
      for (let k = 0; k <= steps; k++) {
        const a = a0 + (da * k) / steps;
        path.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      path.push(end);
      const lengths = [0];
      for (let k = 1; k < path.length; k++) lengths.push(lengths[k - 1] + path[k].distanceTo(path[k - 1]));
      this.walks.push({ id: seat.id, path, lengths, total: lengths[lengths.length - 1], t0: now + i * 650, speed: 2.1 });
      p.body.visible = false;
      p.label.visible = false;
    });
    this.requestFrame();
    return new Promise((resolve) => {
      this.walkDone = resolve;
    });
  }

  private stepWalks(now: number) {
    const tmp = new THREE.Vector3();
    let active = 0;
    for (const w of this.walks) {
      const p = this.people.get(w.id);
      if (!p) continue;
      const dist = ((now - w.t0) / 1000) * w.speed;
      if (dist < 0) {
        active++;
        continue;
      }
      if (dist >= w.total) {
        if (!p.body.visible || p.legs.visible) {
          this.resetBody(p);
          p.label.visible = this.opts.labels;
        }
        continue;
      }
      active++;
      let k = 1;
      while (k < w.lengths.length - 1 && w.lengths[k] < dist) k++;
      const segK = (dist - w.lengths[k - 1]) / Math.max(1e-6, w.lengths[k] - w.lengths[k - 1]);
      tmp.lerpVectors(w.path[k - 1], w.path[k], segK);
      const heading = Math.atan2(w.path[k].x - w.path[k - 1].x, w.path[k].z - w.path[k - 1].z);
      // World to seat-group local space (the group sits at the seat and is rotated by its yaw).
      p.group.updateMatrixWorld();
      const local = p.group.worldToLocal(tmp.clone());
      p.body.visible = true;
      p.legs.visible = true;
      p.thighs.visible = false;
      p.body.position.set(local.x, 0.32 + Math.abs(Math.sin(dist * 5)) * 0.03, local.z);
      p.body.rotation.y = heading - p.group.rotation.y;
      p.label.visible = this.opts.labels;
      p.label.position.set(local.x, 2.15, local.z);
    }
    if (!active) {
      this.walks = [];
      const done = this.walkDone;
      this.walkDone = null;
      done?.();
    }
  }

  /** PNG of the current view (rendered synchronously first, so no preserveDrawingBuffer is needed). */
  snapshot(): Promise<Blob> {
    this.frame();
    return new Promise((resolve, reject) => this.renderer.domElement.toBlob((b) => (b ? resolve(b) : reject(new Error('snapshot'))), 'image/png'));
  }

  dispose() {
    this.walkDone?.();
    this.walkDone = null;
    this.disposed = true;
    this.stop();
    this.controls.dispose();
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
