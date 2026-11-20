import * as THREE from 'three';

// Two prints for the Hall frames, painted at load time in the site's palette: the sun rising (07:00) and
// setting (19:30). The frame scan maps its artwork to u 0.165-0.835 and the full height of a square
// texture (a 0.51 x 0.76 m picture), so each print is drawn into that band.

const SIZE = 1024;
const X0 = 0.165 * SIZE;
const W = 0.67 * SIZE;

function paint(draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  g.translate(X0, 0);
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false; // glTF UVs put v = 0 at the top of the image
  t.anisotropy = 4;
  return t;
}

function caption(g: CanvasRenderingContext2D, text: string, colour: string) {
  g.fillStyle = colour;
  g.font = '600 26px "Instrument Sans", Helvetica, Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(text, W / 2, SIZE - 70);
}

const sunrise = () => paint((g) => {
  g.fillStyle = '#efe6d6';
  g.fillRect(0, 0, W, SIZE);
  const horizon = SIZE * 0.66;
  // Sun just clear of the horizon, with three faint rings of morning haze.
  g.strokeStyle = 'rgba(196, 87, 47, 0.28)';
  g.lineWidth = 3;
  for (const r of [230, 290, 350]) { g.beginPath(); g.arc(W / 2, horizon - 40, r, Math.PI, 0); g.stroke(); }
  g.fillStyle = '#c4572f';
  g.beginPath();
  g.arc(W / 2, horizon - 40, 170, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#efe6d6';
  g.fillRect(0, horizon, W, SIZE - horizon);
  g.fillStyle = '#2a2623';
  g.fillRect(60, horizon, W - 120, 4);
  for (let i = 1; i <= 4; i++) g.fillRect(60 + i * 30, horizon + i * 38, W - 120 - i * 60, 2);
  caption(g, '07:00', '#6b625b');
});

const sunset = () => paint((g) => {
  // Dusk bands, warm at the horizon, the sun half gone below it.
  const bands = ['#e9d3b4', '#e3bf98', '#d9a47c', '#c98762'];
  const horizon = SIZE * 0.6;
  bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, (horizon / bands.length) * i, W, horizon / bands.length + 1); });
  g.fillStyle = '#a8471f';
  g.beginPath();
  g.arc(W / 2, horizon, 190, Math.PI, 0);
  g.fill();
  g.fillStyle = '#2f4a3c';
  g.fillRect(0, horizon, W, SIZE - horizon);
  g.fillStyle = 'rgba(243, 236, 224, 0.35)';
  for (let i = 0; i < 5; i++) g.fillRect(W / 2 - 150 + i * 22, horizon + 30 + i * 34, 300 - i * 44, 3);
  caption(g, '19:30', '#efe6d6');
});

let made = 0;
/** Gives a placed frame its own artwork material with the next print (sunrise, then sunset). */
export function hangPrint(frame: THREE.Object3D) {
  const texture = made++ % 2 === 0 ? sunrise() : sunset();
  frame.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const m = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (!mesh.isMesh || !m || !/_artwork$/.test(m.name)) return;
    const own = m.clone();
    own.map = texture;
    own.roughnessMap = null;
    own.roughness = 0.85; // matte paper
    own.normalMap = null;
    mesh.material = own;
  });
}
