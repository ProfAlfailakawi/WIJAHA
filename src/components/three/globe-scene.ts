import * as THREE from 'three';

/** A navy globe with a gold graticule and one light per partner capital (no textures, no map tiles). */
export interface GlobeMarker {
  code: string;
  lat: number;
  lon: number;
  glow: number; // 0..1
  selected?: boolean;
}

const R = 1;
function toVec(lat: number, lon: number, r = R): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

export class GlobeScene {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  private globe = new THREE.Group();
  private markers = new Map<string, { dot: THREE.Mesh; halo: THREE.Mesh; beam: THREE.Mesh; glow: number }>();
  private raf = 0;
  private running = false;
  private reduce: boolean;
  private baseYaw: number;

  constructor(private host: HTMLElement) {
    this.reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const el = this.renderer.domElement;
    el.style.cssText = 'display:block;width:100%;height:100%';
    el.setAttribute('data-testid', 'globe-canvas');
    host.appendChild(el);

    this.camera.position.set(0, 0.35, 4.4);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.AmbientLight(0x8fa4d8, 0.9));
    const key = new THREE.DirectionalLight(0xfff0d0, 1.6);
    key.position.set(-3, 2, 4);
    this.scene.add(key);

    const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), new THREE.MeshStandardMaterial({ color: 0x15275a, roughness: 0.7, metalness: 0.15 }));
    this.globe.add(sphere);
    // Graticule every 15 degrees.
    const lineMat = new THREE.LineBasicMaterial({ color: 0xd9b865, transparent: true, opacity: 0.22 });
    for (let lat = -75; lat <= 75; lat += 15) {
      const pts = Array.from({ length: 97 }, (_, i) => toVec(lat, -180 + i * 3.75, R * 1.002));
      this.globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    for (let lon = -180; lon < 180; lon += 15) {
      const pts = Array.from({ length: 61 }, (_, i) => toVec(-90 + i * 3, lon, R * 1.002));
      this.globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    // Soft atmosphere rim.
    const rim = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 48, 32), new THREE.MeshBasicMaterial({ color: 0xe8c882, transparent: true, opacity: 0.06, side: THREE.BackSide }));
    this.scene.add(rim, this.globe);
    // Face the Arab world: longitude ~35E toward the camera (yaw = -(lon + 90)).
    this.baseYaw = -((35 + 90) * Math.PI) / 180;
    this.globe.rotation.set(0.3, this.baseYaw, 0);
    this.resize();
  }

  setMarkers(list: GlobeMarker[]) {
    const seen = new Set<string>();
    for (const m of list) {
      seen.add(m.code);
      let mk = this.markers.get(m.code);
      if (!mk) {
        const pos = toVec(m.lat, m.lon, R * 1.004);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        dot.position.copy(pos);
        const halo = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), new THREE.MeshBasicMaterial({ color: 0xffd770, transparent: true, opacity: 0, depthWrite: false }));
        halo.position.copy(pos);
        halo.lookAt(pos.clone().multiplyScalar(2));
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffd770, transparent: true, opacity: 0.85 }));
        beam.position.copy(pos.clone().multiplyScalar(1));
        beam.lookAt(pos.clone().multiplyScalar(2));
        beam.rotateX(Math.PI / 2);
        this.globe.add(dot, halo, beam);
        mk = { dot, halo, beam, glow: 0 };
        this.markers.set(m.code, mk);
      }
      mk.glow = m.glow;
      const c = new THREE.Color(0x6b7aa8).lerp(new THREE.Color(0xffd770), Math.min(1, m.glow * 1.4));
      (mk.dot.material as THREE.MeshBasicMaterial).color.copy(c);
      mk.dot.scale.setScalar(m.selected ? 1.6 : 1);
      const h = 0.04 + m.glow * 0.32;
      mk.beam.scale.set(1, h, 1);
      const out = mk.dot.position.clone().normalize();
      mk.beam.position.copy(out.multiplyScalar(R + h / 2));
      mk.beam.visible = m.glow > 0.02;
    }
    for (const [code, mk] of this.markers) {
      const on = seen.has(code);
      mk.dot.visible = on;
      mk.halo.visible = on;
      if (!on) mk.beam.visible = false;
    }
    this.frame();
  }

  resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frame();
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
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
    const now = performance.now();
    if (!this.reduce) this.globe.rotation.y = this.baseYaw + Math.sin(now / 9000) * 0.28;
    for (const mk of this.markers.values()) {
      const pulse = this.reduce ? 0.5 : 0.5 + 0.5 * Math.sin(now / 420 + mk.dot.position.x * 10);
      (mk.halo.material as THREE.MeshBasicMaterial).opacity = mk.glow * (0.25 + 0.45 * pulse);
      mk.halo.scale.setScalar(0.6 + mk.glow * (1 + 0.4 * pulse));
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
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
