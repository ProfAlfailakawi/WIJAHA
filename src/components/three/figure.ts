import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { lerpPose, POSES, type Pose } from '../../shared/tools/poses.ts';

const rad = (d: number) => (d * Math.PI) / 180;
const GOLD = 0xd9b865;

interface Limb {
  upper: THREE.Group;
  lower: THREE.Group;
}

/** An articulated, stylised mannequin. Segments are capsules so any pose reads cleanly from every angle. */
export class Mannequin {
  readonly root = new THREE.Group();
  private pelvis = new THREE.Group();
  private spine = new THREE.Group();
  private neck = new THREE.Group();
  private head = new THREE.Group();
  private armL!: Limb;
  private armR!: Limb;
  private legL!: Limb;
  private legR!: Limb;
  private chair: THREE.Group;
  private cushion: THREE.Mesh;
  private soles: THREE.Mesh[] = [];
  private chest: THREE.Mesh;

  constructor() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xe9d3b6, roughness: 0.5 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x1b2a55, roughness: 0.55, metalness: 0.1 });
    const trim = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.85, roughness: 0.3 });
    const cap = (r: number, len: number, m: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), m);
      mesh.castShadow = true;
      return mesh;
    };
    const joint = (r: number) => {
      const j = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), trim);
      j.castShadow = true;
      return j;
    };

    this.root.add(this.pelvis);
    const pelvisMesh = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 16), cloth);
    pelvisMesh.scale.set(1.15, 0.8, 0.85);
    pelvisMesh.castShadow = true;
    this.pelvis.add(pelvisMesh);

    this.pelvis.add(this.spine);
    const torso = cap(0.17, 0.3, cloth);
    torso.position.y = 0.3;
    torso.scale.set(1.1, 1, 0.78);
    this.chest = torso;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 28), trim);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.58;
    this.spine.add(torso, collar);

    this.spine.add(this.neck);
    this.neck.position.y = 0.6;
    const neckMesh = cap(0.045, 0.06, skin);
    neckMesh.position.y = 0.05;
    this.neck.add(neckMesh, this.head);
    this.head.position.y = 0.15;
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.115, 28, 20), skin);
    headMesh.scale.set(0.92, 1.08, 1);
    headMesh.position.y = 0.06;
    headMesh.castShadow = true;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.045, 10), skin);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.05, 0.115);
    this.head.add(headMesh, nose);

    const makeArm = (side: 1 | -1): Limb => {
      const upper = new THREE.Group();
      upper.position.set(side * 0.2, 0.52, 0);
      this.spine.add(upper);
      upper.add(joint(0.05));
      const um = cap(0.04, 0.2, cloth);
      um.position.y = -0.15;
      upper.add(um);
      const lower = new THREE.Group();
      lower.position.y = -0.3;
      upper.add(lower);
      lower.add(joint(0.04));
      const fm = cap(0.034, 0.18, skin);
      fm.position.y = -0.14;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), skin);
      hand.position.y = -0.29;
      hand.scale.set(0.9, 1.2, 0.7);
      lower.add(fm, hand);
      return { upper, lower };
    };
    this.armL = makeArm(1);
    this.armR = makeArm(-1);

    const makeLeg = (side: 1 | -1): Limb => {
      const upper = new THREE.Group();
      upper.position.set(side * 0.095, 0, 0);
      this.pelvis.add(upper);
      const tm = cap(0.065, 0.28, cloth);
      tm.position.y = -0.22;
      upper.add(joint(0.07), tm);
      const lower = new THREE.Group();
      lower.position.y = -0.44;
      upper.add(lower);
      lower.add(joint(0.058));
      const sm = cap(0.05, 0.28, cloth);
      sm.position.y = -0.22;
      lower.add(sm);
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.12, 4, 10), skin);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(0, -0.47, 0.07);
      foot.scale.set(1, 1, 0.8);
      // The sole is tinted so the "do not show the soles" lesson is visible at a glance.
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.012, 0.24), new THREE.MeshStandardMaterial({ color: 0xb8402f, roughness: 0.6 }));
      sole.position.set(0, -0.51, 0.07);
      this.soles.push(sole);
      lower.add(foot, sole);
      return { upper, lower };
    };
    this.legL = makeLeg(1);
    this.legR = makeLeg(-1);

    // Props
    this.chair = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4b22, roughness: 0.6 });
    const pad = new THREE.MeshStandardMaterial({ color: 0x8a2f3b, roughness: 0.8 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), pad);
    seat.position.set(0, 0.43, 0.04);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.05), pad);
    back.position.set(0, 0.74, -0.2);
    this.chair.add(seat, back);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.43), wood);
      l.position.set(x * 0.21, 0.215, z * 0.21 + 0.04);
      this.chair.add(l);
    }
    this.chair.traverse((n) => ((n as THREE.Mesh).isMesh ? ((n as THREE.Mesh).castShadow = (n as THREE.Mesh).receiveShadow = true) : undefined));
    this.cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x8a2f3b, roughness: 0.9 }));
    this.cushion.position.y = 0.05;
    this.cushion.castShadow = this.cushion.receiveShadow = true;
    this.root.add(this.chair, this.cushion);
    this.apply(POSES.stand);
  }

  /** Whether soles should be highlighted (kept subtle unless the pose is the "avoid" one). */
  setSoleEmphasis(on: boolean) {
    for (const s of this.soles) (s.material as THREE.MeshStandardMaterial).emissive.set(on ? 0x7a1a10 : 0x000000);
  }

  apply(p: Pose) {
    this.root.position.set(0, 0, 0);
    this.pelvis.position.set(0, p.hipY, p.hipZ);
    this.spine.rotation.set(-rad(p.spine), 0, 0);
    this.neck.rotation.set(-rad(p.neck), rad(p.headYaw), 0);
    const arm = (l: Limb, a: Pose['armL'], side: 1 | -1) => {
      l.upper.rotation.set(-rad(a.flex), rad(a.twist ?? 0) * side, side * rad(a.abd), 'ZXY');
      l.lower.rotation.set(-rad(a.elbow), 0, 0);
    };
    arm(this.armL, p.armL, 1);
    arm(this.armR, p.armR, -1);
    const leg = (l: Limb, g: Pose['legL'], side: 1 | -1) => {
      l.upper.rotation.set(-rad(g.flex), 0, side * rad(g.abd), 'ZXY');
      l.lower.rotation.set(rad(g.knee), 0, 0);
    };
    leg(this.legL, p.legL, 1);
    leg(this.legR, p.legR, -1);
    this.chair.visible = p.prop === 'chair';
    this.cushion.visible = p.prop === 'cushion';
  }

  breathe(t: number) {
    const s = 1 + Math.sin(t / 900) * 0.012;
    this.chest.scale.set(1.1 * s, 1, 0.78 * s);
  }
}

export class PostureScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  readonly controls: OrbitControls;
  readonly figure = new Mannequin();
  private cur: Pose = POSES.stand;
  private tween: { from: Pose; to: Pose; t0: number; dur: number } | null = null;
  private raf = 0;
  private running = false;
  private disposed = false;
  private reduce: boolean;

  constructor(private host: HTMLElement) {
    this.reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const el = this.renderer.domElement;
    el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    el.setAttribute('data-testid', 'posture-canvas');
    host.appendChild(el);

    this.scene.background = new THREE.Color(0x0e1630);
    this.scene.fog = new THREE.Fog(0x0e1630, 6, 14);
    this.scene.add(new THREE.HemisphereLight(0xfff3dc, 0x2a3358, 0.9));
    const key = new THREE.DirectionalLight(0xfff0d0, 2.1);
    key.position.set(-2.5, 4, 3);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 2.5;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0005;
    const rim = new THREE.DirectionalLight(0x6fb2ff, 1.1);
    rim.position.set(3, 2.5, -3);
    this.scene.add(key, rim);

    const stage = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.55, 0.05, 64), new THREE.MeshStandardMaterial({ color: 0x1a2650, roughness: 0.35, metalness: 0.2 }));
    stage.position.y = -0.025;
    stage.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.018, 10, 96), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.9, roughness: 0.25 }));
    ring.rotation.x = Math.PI / 2;
    this.scene.add(stage, ring, this.figure.root);

    this.camera.position.set(1.6, 1.5, 3.4);
    this.controls = new OrbitControls(this.camera, el);
    this.controls.target.set(0, 0.85, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 6;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.autoRotate = !this.reduce;
    this.controls.autoRotateSpeed = 0.8;
    this.controls.addEventListener('start', () => (this.controls.autoRotate = false));
    this.resize();
  }

  setPose(id: string, instant = false) {
    const to = POSES[id];
    if (!to) return;
    this.figure.setSoleEmphasis(id === 'majlisAvoid');
    if (instant || this.reduce) {
      this.cur = to;
      this.tween = null;
      this.figure.apply(to);
    } else {
      this.tween = { from: this.cur, to, t0: performance.now(), dur: 850 };
    }
    this.frameOnce();
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frameOnce();
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

  private frameOnce() {
    if (!this.running) this.frame();
  }

  private frame() {
    const now = performance.now();
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.t0) / this.tween.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const p = lerpPose(this.tween.from, this.tween.to, e);
      this.figure.apply(p);
      if (k >= 1) {
        this.cur = this.tween.to;
        this.figure.apply(this.cur);
        this.tween = null;
      }
    }
    if (!this.reduce) this.figure.breathe(now);
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
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
