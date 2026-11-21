import * as THREE from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, repeat?: [number, number]): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

/** Eight-pointed star tiling on warm marble: a quiet Islamic geometric floor. */
export function floorTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#efe6d2';
  g.fillRect(0, 0, 512, 512);
  const grad = g.createRadialGradient(256, 256, 20, 256, 256, 360);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(120,90,40,0.12)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(184,146,58,0.75)';
  g.lineWidth = 3;
  const star = (cx: number, cy: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI / 8) * i - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.62;
      g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    g.closePath();
    g.stroke();
  };
  for (const [x, y] of [[128, 128], [384, 128], [128, 384], [384, 384]]) star(x, y, 112);
  g.strokeStyle = 'rgba(184,146,58,0.4)';
  g.lineWidth = 2;
  for (const [x, y] of [[256, 256], [0, 256], [512, 256], [256, 0], [256, 512]]) star(x, y, 70);
  g.strokeRect(1.5, 1.5, 509, 509);
  return finish(c, [6, 4]);
}

/** Majlis rug: deep indigo field, gold border, central medallion. */
export function rugTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.fillStyle = '#16264f';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#d9b865';
  g.lineWidth = 10;
  g.strokeRect(14, 14, 484, 484);
  g.lineWidth = 3;
  g.strokeRect(34, 34, 444, 444);
  g.strokeStyle = 'rgba(217,184,101,0.8)';
  g.lineWidth = 3;
  for (let r = 40; r <= 190; r += 30) {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI / 8) * i;
      const rr = i % 2 === 0 ? r : r * 0.66;
      g.lineTo(256 + rr * Math.cos(a), 256 + rr * Math.sin(a));
    }
    g.closePath();
    g.stroke();
  }
  g.fillStyle = '#b8402f';
  g.beginPath();
  g.arc(256, 256, 26, 0, Math.PI * 2);
  g.fill();
  return finish(c);
}

/** Wall with tall arched panels and a lattice (mashrabiya) feel. */
export function wallTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#f3ecdc';
  g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(184,146,58,0.85)';
  g.lineWidth = 4;
  for (let i = 0; i < 2; i++) {
    const x = 20 + i * 250;
    g.beginPath();
    g.moveTo(x, 256);
    g.lineTo(x, 100);
    g.arc(x + 108, 100, 108, Math.PI, 0);
    g.lineTo(x + 216, 256);
    g.stroke();
    g.strokeStyle = 'rgba(184,146,58,0.35)';
    g.lineWidth = 2;
    for (let k = -3; k <= 3; k++) {
      g.beginPath();
      g.moveTo(x + 108 + k * 28, 256);
      g.lineTo(x + 108 + k * 28 - 60, 40);
      g.stroke();
      g.beginPath();
      g.moveTo(x + 108 + k * 28, 256);
      g.lineTo(x + 108 + k * 28 + 60, 40);
      g.stroke();
    }
    g.strokeStyle = 'rgba(184,146,58,0.85)';
    g.lineWidth = 4;
  }
  return finish(c, [3, 1]);
}

/** Name tag texture (also used for the host/title line). Canvas handles Arabic shaping and bidi natively. */
export function labelTexture(name: string, role: string | undefined, rtl: boolean, accent: string): { tex: THREE.CanvasTexture; aspect: number } {
  const [c, g] = canvas(640, 170);
  const r = 40;
  g.fillStyle = 'rgba(10,19,48,0.9)';
  g.beginPath();
  g.roundRect(6, 6, 628, 158, r);
  g.fill();
  g.lineWidth = 5;
  g.strokeStyle = accent;
  g.stroke();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.direction = rtl ? 'rtl' : 'ltr';
  const font = "Alexandria, 'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif";
  const fit = (text: string, size: number, weight: number, maxW: number) => {
    let s = size;
    g.font = `${weight} ${s}px ${font}`;
    while (g.measureText(text).width > maxW && s > 18) {
      s -= 2;
      g.font = `${weight} ${s}px ${font}`;
    }
  };
  if (role) {
    fit(name, 52, 700, 560);
    g.fillText(name, 320, 76);
    fit(role, 34, 500, 560);
    g.fillStyle = '#e7d3a1';
    g.fillText(role, 320, 128);
  } else {
    fit(name, 58, 700, 560);
    g.fillText(name, 320, 108);
  }
  return { tex: finish(c), aspect: 640 / 170 };
}
