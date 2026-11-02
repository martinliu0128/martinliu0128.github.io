// The engine behind the vessel's walkable interiors (the command module, the court): one renderer shared by all of
// them, first-person walking with a captured mouse as in a game, display glass that boots as the pilot comes near,
// live displays that redraw at their own pace, and the hatch the pilot leaves by. Each interior builds its own scene
// through a Kit and says how it is walked: its scale, eye height, spawn point, collisions and where its hatch is.
// Units are metres before an interior's scale; +Y is up, and every hatch is on a bulkhead facing +Z.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A wall display's record: a section, a title, the text, and photos with captions
export type Panel = {
	tag: string;
	section: string;
	title: string;
	chips: string[];
	paragraphs: string[];
	photos: { src: string; caption: string }[];
};

export const AMBER = '#f2b13b', ICE = '#e4ecf7', DIM = '#93a3c0', CYAN = '#6fd6ff', GREEN = '#5fd28a', RED = '#e2574c';
export const FONT = '"Barlow", "Barlow Condensed", Arial, sans-serif';
export const COND = '"Barlow Condensed", "Barlow", "Arial Narrow", Arial, sans-serif';
export const DISPLAY = 'Michroma, "Barlow Condensed", Arial, sans-serif';

// Resolves once the faces the displays are lettered in have loaded, so text drawn earlier can be drawn again
export const fontsReady: Promise<unknown> = typeof document === 'undefined' || !document.fonts
	? Promise.resolve()
	: Promise.all(['400 40px Barlow', '600 40px "Barlow Condensed"', '400 40px Michroma'].map((f) => document.fonts.load(f))).catch(() => {});

export function rng(seed: number) {
	return () => {
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function canvas(w: number, h: number) {
	const cv = document.createElement('canvas');
	cv.width = w;
	cv.height = h;
	return { cv, g: cv.getContext('2d')! };
}

export function tex(cv: HTMLCanvasElement, srgb = true) {
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
	t.anisotropy = 8;
	return t;
}

// Word-wrapped text; returns the y below the last line. With `dry` it only measures.
export function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, dry = false) {
	let line = '';
	for (const word of text.split(' ')) {
		const test = line ? `${line} ${word}` : word;
		if (g.measureText(test).width > maxW && line) {
			if (!dry) g.fillText(line, x, y);
			line = word;
			y += lineH;
		} else line = test;
	}
	if (line) { if (!dry) g.fillText(line, x, y); y += lineH; }
	return y;
}

// The lines a text breaks into at `maxW`
export function lines(g: CanvasRenderingContext2D, text: string, maxW: number) {
	const out: string[] = [];
	let line = '';
	for (const word of text.split(' ')) {
		const test = line ? `${line} ${word}` : word;
		if (g.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
	}
	if (line) out.push(line);
	return out;
}

// The largest body size at which the paragraphs fit in `maxH`
export function fitText(g: CanvasRenderingContext2D, paragraphs: string[], w: number, maxH: number) {
	for (let size = 58; size >= 30; size -= 2) {
		g.font = `400 ${size}px ${FONT}`;
		const lh = Math.round(size * 1.42), gap = Math.round(size * 0.62);
		let y = 0;
		for (const p of paragraphs) y = wrap(g, p, 0, y, w, lh, true) + gap;
		if (y - gap - lh <= maxH) return { size, lh, gap };
	}
	return { size: 30, lh: 43, gap: 19 };
}

// ---------- Shared surfaces ----------

export function hazardSheet(w: number, h: number, stripe = 48) {
	const { cv, g } = canvas(w, h);
	g.fillStyle = '#1c1d20';
	g.fillRect(0, 0, w, h);
	g.fillStyle = '#e3b23c';
	for (let x = -h; x < w + h; x += stripe * 2) {
		g.beginPath();
		g.moveTo(x, h); g.lineTo(x + h, 0); g.lineTo(x + h + stripe, 0); g.lineTo(x + stripe, h);
		g.fill();
	}
	return tex(cv);
}

// A lit sign, or with `painted` just the lettering, for stencilling onto a wall
export function signTexture(text: string, color: string, painted = false) {
	const { cv, g } = canvas(1024, 256);
	if (!painted) {
		g.fillStyle = '#06090d';
		g.fillRect(0, 0, 1024, 256);
		g.strokeStyle = color;
		g.lineWidth = 6;
		g.strokeRect(12, 12, 1000, 232);
	}
	g.font = `400 86px ${DISPLAY}`;
	g.fillStyle = color;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText(text, 512, 134);
	return tex(cv);
}

// ---------- Displays ----------

// Every display shares one look: deep navy glass, a faint grid, a header bar and corner brackets.
// Returns the inner padding and where the content starts.
export function displayFrame(g: CanvasRenderingContext2D, w: number, h: number, title: string, tag: string, tagColor = DIM) {
	const bg = g.createLinearGradient(0, 0, 0, h);
	bg.addColorStop(0, '#0c1828');
	bg.addColorStop(1, '#03080f');
	g.fillStyle = bg;
	g.fillRect(0, 0, w, h);
	const cell = Math.round(h / 20);
	g.fillStyle = 'rgba(110,170,240,0.045)';
	for (let x = cell; x < w; x += cell) g.fillRect(x, 0, 1, h);
	for (let y = cell; y < h; y += cell) g.fillRect(0, y, w, 1);
	const bar = Math.round(h * 0.075), pad = Math.round(h * 0.045);
	g.fillStyle = 'rgba(111,214,255,0.09)';
	g.fillRect(0, 0, w, bar);
	g.fillStyle = 'rgba(111,214,255,0.55)';
	g.fillRect(0, bar, w, 2);
	g.fillStyle = AMBER;
	g.fillRect(pad, bar * 0.36, bar * 0.28, bar * 0.28);
	g.textBaseline = 'middle';
	g.font = `400 ${Math.round(bar * 0.34)}px ${DISPLAY}`;
	g.fillStyle = ICE;
	g.fillText(title.toUpperCase(), pad + bar * 0.5, bar * 0.52);
	g.textAlign = 'right';
	g.font = `600 ${Math.round(bar * 0.4)}px ${COND}`;
	g.fillStyle = tagColor;
	g.fillText(tag.toUpperCase(), w - pad, bar * 0.52);
	g.textAlign = 'left';
	g.textBaseline = 'alphabetic';
	g.strokeStyle = 'rgba(228,236,247,0.55)';
	g.lineWidth = Math.max(2, h / 400);
	const c = pad * 0.9, e = 10;
	for (const [x, y, dx, dy] of [[e, e, 1, 1], [w - e, e, -1, 1], [e, h - e, 1, -1], [w - e, h - e, -1, -1]]) {
		g.beginPath(); g.moveTo(x, y + dy * c); g.lineTo(x, y); g.lineTo(x + dx * c, y); g.stroke();
	}
	return { pad, top: bar + pad };
}

export function cornerTicks(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, len: number, color: string) {
	g.strokeStyle = color;
	g.lineWidth = 4;
	for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
		g.beginPath(); g.moveTo(cx, cy + dy * len); g.lineTo(cx, cy); g.lineTo(cx + dx * len, cy); g.stroke();
	}
}

// One wall display: a column of photos beside the record's text, which takes the largest size that fits
export function storyScreen(p: Panel, index: number, total: number, photosLeft: boolean, onChange: () => void, place = { code: 'VSL-01', name: 'Command module' }) {
	const W = 2560, H = 1600;
	const { cv, g } = canvas(W, H);
	const t = tex(cv);
	const imgs: (HTMLImageElement | null)[] = p.photos.map(() => null);
	const draw = () => {
		const { pad, top } = displayFrame(g, W, H, `${p.tag} · ${p.section}`, `${place.code} · Record ${index + 1} / ${total}`);
		const foot = H - pad - 20;
		const bottom = foot - 70;
		// Footer: which of the records this is
		g.fillStyle = 'rgba(111,214,255,0.25)';
		g.fillRect(pad, foot - 42, W - pad * 2, 2);
		g.font = `600 30px ${COND}`;
		g.fillStyle = DIM;
		g.fillText(`ML-1  //  ${place.name.toUpperCase()}  //  PERSONAL RECORD`, pad, foot);
		for (let i = 0; i < total; i++) {
			g.fillStyle = i === index ? AMBER : 'rgba(147,163,192,0.3)';
			g.fillRect(W - pad - (total - i) * 92 + 12, foot - 14, 80, 10);
		}

		// Photos, each at its own proportions
		const n = p.photos.length, capH = 58, gap = 34;
		const aspect = imgs.map((im) => (im ? im.width / im.height : 4 / 3));
		const avail = bottom - top;
		const colW = n ? Math.min(1000, ...aspect.map((a) => ((avail - (n - 1) * gap - n * capH) / n) * a)) : 0;
		const px = photosLeft ? pad : W - pad - colW;
		const stack = aspect.reduce((sum, a) => sum + colW / a + capH, 0) + (n - 1) * gap;
		let py = top + Math.max(0, (avail - stack) / 2);
		p.photos.forEach((ph, i) => {
			const h = colW / aspect[i];
			const im = imgs[i];
			if (im) {
				g.drawImage(im, px, py, colW, h);
				// Dimmed a little so bright backgrounds sit on the glass instead of glaring
				const shade = g.createLinearGradient(0, py, 0, py + h);
				shade.addColorStop(0, 'rgba(6,16,32,0.2)');
				shade.addColorStop(1, 'rgba(6,16,32,0.38)');
				g.fillStyle = shade;
				g.fillRect(px, py, colW, h);
			} else {
				g.fillStyle = 'rgba(111,214,255,0.06)';
				g.fillRect(px, py, colW, h);
			}
			g.strokeStyle = 'rgba(111,214,255,0.4)';
			g.lineWidth = 2;
			g.strokeRect(px, py, colW, h);
			cornerTicks(g, px - 8, py - 8, colW + 16, h + 16, 34, ICE);
			g.font = `600 30px ${COND}`;
			g.fillStyle = AMBER;
			g.fillText(`IMG ${String(i + 1).padStart(2, '0')}`, px, py + h + 44);
			g.fillStyle = ICE;
			g.fillText(ph.caption.toUpperCase(), px + 112, py + h + 44);
			py += h + capH + gap;
		});

		// The record: its section, its title, then the text
		const tx = n && photosLeft ? px + colW + 100 : pad, tw = W - pad * 2 - (n ? colW + 100 : 0);
		let y = top + 36;
		g.font = `600 34px ${COND}`;
		g.fillStyle = AMBER;
		g.fillText(`${p.tag}  //  ${p.section.toUpperCase()}`, tx, y);
		y += 90;
		g.font = `400 60px ${DISPLAY}`;
		g.fillStyle = '#ffffff';
		y = wrap(g, p.title, tx, y, tw, 80);
		g.fillStyle = AMBER;
		g.fillRect(tx, y - 36, 140, 5);
		y += 44;
		const chipsH = p.chips.length ? 100 : 0;
		if (n) {
			const fit = fitText(g, p.paragraphs, tw, bottom - chipsH - y);
			p.paragraphs.forEach((para, i) => {
				g.font = `400 ${fit.size}px ${FONT}`;
				g.fillStyle = i === 0 ? '#eef3fa' : '#c3cfdf';
				y = wrap(g, para, tx, y, tw, fit.lh) + fit.gap;
			});
		} else columns(g, p.paragraphs, tx, y, tw, bottom - chipsH - y - 20);
		let cx = tx;
		g.font = `600 32px ${COND}`;
		for (const chip of p.chips) {
			const label = chip.toUpperCase(), cw = g.measureText(label).width + 44;
			g.beginPath();
			g.roundRect(cx, bottom - 56, cw, 56, 6);
			g.fillStyle = 'rgba(111,214,255,0.08)';
			g.fill();
			g.strokeStyle = 'rgba(111,214,255,0.6)';
			g.lineWidth = 2;
			g.stroke();
			g.fillStyle = ICE;
			g.fillText(label, cx + 22, bottom - 17);
			cx += cw + 18;
		}
		t.needsUpdate = true;
	};
	p.photos.forEach((ph, i) => {
		const im = new Image();
		im.onload = () => { imgs[i] = im; draw(); onChange(); };
		im.src = ph.src;
	});
	draw();
	void fontsReady.then(() => { draw(); onChange(); });
	return t;
}

// Text alone across a whole display, flowed down two columns at the largest size that fits
function columns(g: CanvasRenderingContext2D, paragraphs: string[], x: number, y: number, w: number, maxH: number) {
	const gutter = 110, cw = (w - gutter) / 2;
	let size = 60, layout: { text: string; col: number; y: number; para: number }[] = [];
	for (; size >= 30; size -= 2) {
		g.font = `400 ${size}px ${FONT}`;
		const lh = Math.round(size * 1.45), gap = Math.round(size * 0.62);
		layout = [];
		let col = 0, cy = 0;
		paragraphs.forEach((para, i) => {
			if (cy > 0) cy += gap;
			for (const text of lines(g, para, cw)) {
				if (cy + lh > maxH) { col++; cy = 0; }
				layout.push({ text, col, y: cy, para: i });
				cy += lh;
			}
		});
		if (col < 2) break;
	}
	g.font = `400 ${size}px ${FONT}`;
	const first = Math.round(size * 1.0);
	for (const l of layout) {
		g.fillStyle = l.para === 0 ? '#eef3fa' : '#c3cfdf';
		g.fillText(l.text, x + l.col * (cw + gutter), y + first + l.y);
	}
	// A hairline between the columns
	g.fillStyle = 'rgba(111,214,255,0.18)';
	g.fillRect(x + cw + gutter / 2, y + 10, 2, maxH - 10);
}

export type Live = { tex: THREE.CanvasTexture; draw(time: number): void };

// A display redrawn while it runs: drawn in its design units onto a smaller canvas, and kept without mipmaps,
// so each update is a quick upload
export function liveCanvas(w: number, h: number, k: number) {
	const { cv, g } = canvas(Math.round(w * k), Math.round(h * k));
	const t = tex(cv);
	t.generateMipmaps = false;
	t.minFilter = THREE.LinearFilter;
	return { g, t, begin: () => g.setTransform(k, 0, 0, k, 0, 0) };
}

// ---------- Geometry ----------

// An open surface of revolution about Z, radius r0 at z0 to r1 at z1; u runs around from +X, v from z0 to z1
export function shell(r0: number, r1: number, z0: number, z1: number, seg = 128) {
	const pos: number[] = [], uv: number[] = [], idx: number[] = [];
	for (let i = 0; i <= seg; i++) {
		const a = (i / seg) * Math.PI * 2;
		for (const [r, z, v] of [[r0, z0, 0], [r1, z1, 1]]) {
			pos.push(Math.cos(a) * r, Math.sin(a) * r, z);
			uv.push(i / seg, v);
		}
	}
	for (let i = 0; i < seg; i++) {
		const a = i * 2;
		idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}

// Many flat quads in one geometry, each placed by a matrix (the quad lies in its local XY plane, facing +Z) with its
// own part of a shared texture: one draw call however many there are
export class Quads {
	private p: number[] = [];
	private n: number[] = [];
	private uv: number[] = [];
	private idx: number[] = [];
	add(m: THREE.Matrix4, w: number, h: number, [u0, v0, u1, v1]: number[]) {
		const base = this.p.length / 3;
		const nm = new THREE.Vector3(0, 0, 1).transformDirection(m);
		for (const [x, y, u, v] of [[-w / 2, -h / 2, u0, v0], [w / 2, -h / 2, u1, v0], [w / 2, h / 2, u1, v1], [-w / 2, h / 2, u0, v1]]) {
			const q = new THREE.Vector3(x, y, 0).applyMatrix4(m);
			this.p.push(q.x, q.y, q.z);
			this.n.push(nm.x, nm.y, nm.z);
			this.uv.push(u, v);
		}
		this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
	}
	mesh(material: THREE.Material) {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
		g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
		g.setIndex(this.idx);
		return new THREE.Mesh(g, material);
	}
}

// A placement: position, then a turn about Y and a tilt about X
const UNIT = new THREE.Vector3(1, 1, 1);
export const M = (x: number, y: number, z: number, ry = 0, rx = 0) =>
	new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), UNIT);

// Display glass: the picture with fine scanlines and a slow rolling band; until it boots, a dim standby
// that a bright line wipes away from the top
const SCREEN_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SCREEN_FRAG = /* glsl */ `
	uniform sampler2D uMap;
	uniform float uTime, uReveal, uGain;
	varying vec2 vUv;
	void main() {
		vec3 c = texture2D(uMap, vUv).rgb;
		float edge = 1.0 - uReveal * 1.1;
		float on = smoothstep(edge - 0.004, edge + 0.004, vUv.y);
		float line = exp(-abs(vUv.y - edge) * 120.0) * step(uReveal, 0.999);
		c *= mix(0.04, 1.0, on);
		c *= 0.97 + 0.03 * sin(vUv.y * 1600.0);
		c *= 1.0 + 0.06 * smoothstep(0.95, 1.0, fract(vUv.y * 0.7 - uTime * 0.11));
		c += vec3(0.4, 0.8, 1.0) * line * 1.4;
		gl_FragColor = vec4(c * uGain, 1.0);
	}`;

// Static meshes that share a material become one mesh per material, so an interior draws in a few dozen calls
// instead of several hundred. Anything that moves (under an object marked `keep`), glass, displays and instanced
// meshes stay as they are.
function mergeStatic(scene: THREE.Scene) {
	scene.updateMatrixWorld(true);
	const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
	const merged: THREE.Mesh[] = [];
	scene.traverse((o) => {
		if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || Array.isArray(o.material)) return;
		const m = o.material as THREE.Material;
		if (m instanceof THREE.ShaderMaterial || m.transparent) return;
		for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.keep) return;
		if (!['position', 'normal', 'uv'].every((name) => name in o.geometry.attributes)) return; // merged meshes must match
		let g = o.geometry.clone().applyMatrix4(o.matrixWorld);
		if (g.index) g = g.toNonIndexed();
		for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
		g.clearGroups();
		const list = byMaterial.get(m);
		if (list) list.push(g);
		else byMaterial.set(m, [g]);
		merged.push(o);
	});
	for (const o of merged) o.removeFromParent();
	for (const [m, list] of byMaterial) {
		const g = mergeGeometries(list, false);
		if (g) scene.add(new THREE.Mesh(g, m));
	}
}

// ---------- The engine ----------

function makeMaterials() {
	const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
	const glow = (c: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
	return {
		metal: std({ color: '#9aa0a8', roughness: 0.35, metalness: 0.85 }),
		gunmetal: std({ color: '#454a52', roughness: 0.45, metalness: 0.7 }),
		dark: std({ color: '#1f2227', roughness: 0.6, metalness: 0.4 }),
		white: std({ color: '#d9dbd8', roughness: 0.7, metalness: 0.02 }),
		locker: std({ color: '#e1e2de', roughness: 0.55, metalness: 0.02 }),
		rail: std({ color: '#d6a63a', roughness: 0.4, metalness: 0.3 }),
		seat: std({ color: '#2f343c', roughness: 0.92, metalness: 0 }),
		strap: std({ color: '#c8662e', roughness: 0.8, metalness: 0 }),
		red: std({ color: '#b3261e', roughness: 0.45, metalness: 0.2 }),
		guard: std({ color: '#c42a1f', roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.6 }),
		glass: std({ color: '#0a0e14', roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.18 }),
		body: std({ color: '#2b2f36', roughness: 0.5, metalness: 0.55 }),
		trim: std({ color: '#7a808a', roughness: 0.28, metalness: 0.9 }),
		plastic: std({ color: '#15181c', roughness: 0.5, metalness: 0.1 }),
		cap: std({ color: '#3a3f46', roughness: 0.55, metalness: 0.05 }),
		grip: std({ color: '#7d838c', roughness: 0.75, metalness: 0.1 }),
		light: glow('#fff4e2', 1.8),
		cool: glow('#bfe2ff', 1.8),
		green: glow(GREEN, 2.2),
		led: glow(CYAN, 2.4),
		ledSoft: glow(CYAN, 1.1),
	};
}
export type Materials = ReturnType<typeof makeMaterials>;

// What an interior builds its scene with
export type Kit = {
	world: THREE.Group; // the interior's root; everything goes in here
	mat: Materials;
	std(p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial;
	glow(color: string, k: number): THREE.MeshBasicMaterial;
	add(g: THREE.BufferGeometry, m: THREE.Material, x?: number, y?: number, z?: number): THREE.Mesh;
	put<T extends THREE.Object3D>(o: T, parent: THREE.Object3D, x?: number, y?: number, z?: number): T;
	box(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh;
	rbox(w: number, h: number, d: number, m: THREE.Material, r?: number): THREE.Mesh;
	rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material): THREE.Mesh;
	// Display glass; wall displays boot when approached, `booted` ones are already running
	face(t: THREE.Texture, w: number, h: number, booted: boolean): THREE.Mesh;
	// A display that redraws every `every` seconds while `at` (`radius` metres around it) is on screen and within `range` metres
	live(l: Live, at: THREE.Object3D, every: number, range?: number, radius?: number): void;
	// A bulkhead disc at `z` with the hatch cut through it at height `y`, a short airlock behind, and the door
	hatch(o: { z: number; y: number; radius: number; material: THREE.Material }): { door: THREE.Group; wheel: THREE.Group };
	loader: THREE.TextureLoader;
	textures: string;
	reduced: boolean;
	redraw(): void; // draw a frame now, for a texture that finished loading while nothing runs
};

// How an interior is walked. Positions are in its own units; it is drawn `scale` times larger, so a person stays
// human-sized only if `eye` is given in those units too.
export type Interior = {
	code: string;
	name: string;
	scale: number;
	eye: number; // eye height above the floor, or above y = 0 where the interior gives no `ground`
	ground?(p: THREE.Vector3): number; // the floor's height under p, for an interior on more than one level
	spawn: THREE.Vector3;
	spawnYaw: number;
	collide(p: THREE.Vector3, radius: number): void;
	hatch: { z: number; y: number; door: THREE.Group; wheel: THREE.Group }; // on a bulkhead facing +Z, centred on x = 0
	revealAt: number; // metres
	exposure: number;
	environment?: number; // how much the surroundings reflect in its surfaces, for an interior meant to be dark
	actions?: Action[]; // other things F does, besides opening the hatch
	update?(dt: number, time: number): void; // each frame while inside
	leave?(): void; // when the pilot leaves or the view closes
};

// Something F does near a spot on the floor (x, z) while facing `look`; `label` finishes "Press F to …"
export type Action = { x: number; z: number; reach: number; look: THREE.Vector3; label(): string; run(): void };

export type Interiors = {
	open(id: string): void;
	close(): void;
	readonly isOpen: boolean;
	readonly current: string;
	readonly lockReleasedAt: number; // when the mouse was last freed, so the Escape that freed it can be ignored
	readonly inspecting: boolean; // a display is open across the view
	closeInspect(): void;
};

// Pushes a walker of `radius` out of each box (x0..x1 by z0..z1)
export function pushOut(p: THREE.Vector3, boxes: { x0: number; x1: number; z0: number; z1: number }[], radius: number) {
	for (const b of boxes) {
		const cx = THREE.MathUtils.clamp(p.x, b.x0, b.x1), cz = THREE.MathUtils.clamp(p.z, b.z0, b.z1);
		const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
		if (d < radius) {
			if (d > 1e-5) { p.x = cx + (dx / d) * radius; p.z = cz + (dz / d) * radius; }
			else p.z = b.z0 - radius;
		}
	}
}

type Screen = { mat: THREE.ShaderMaterial; mesh: THREE.Mesh; at: THREE.Vector3; reveal: number; on: boolean; booted: boolean; src: HTMLCanvasElement | null };
type Slot = { live: Live; obj: THREE.Object3D; at: THREE.Vector3; every: number; range: number; radius: number; next: number };
type Loaded = { id: string; scene: THREE.Scene; it: Interior; screens: Screen[]; slots: Slot[]; meshes: THREE.Mesh[] };

// One renderer serves every interior; each is built the first time it opens and kept for the next visit
export function createInteriors(host: HTMLElement, builders: Record<string, (kit: Kit) => Interior>, opts: { reduced: boolean; textures: string; onExit: (id: string) => void }): Interiors {
	const view = host.querySelector<HTMLElement>('.cabin-view')!;
	const prompt = host.querySelector<HTMLElement>('.cabin-prompt')!;
	const inspectEl = host.querySelector<HTMLElement>('.cabin-inspect')!;
	const inspectCv = inspectEl.querySelector('canvas')!;
	const inspectG = inspectCv.getContext('2d')!;
	const title = host.querySelector<HTMLElement>('.cabin-bar p')!;
	let renderer: THREE.WebGLRenderer | null = null;
	let composer: EffectComposer | null = null;
	let bloom: UnrealBloomPass | null = null;
	let pass: RenderPass | null = null;
	let env: THREE.Texture | null = null, sky: THREE.Texture | null = null, mat: Materials | null = null;
	const loader = new THREE.TextureLoader();
	const camera = new THREE.PerspectiveCamera(70, 1, 0.03, 900);
	camera.rotation.order = 'YXZ';
	const loaded = new Map<string, Loaded>();
	let cur: Loaded | null = null;
	let isOpen = false, raf = 0, last = 0, openedAt = 0, lockReleasedAt = -1e9;
	// The view eases toward where the mouse turns it
	let yaw = Math.PI, pitch = -0.04, yawGoal = yaw, pitchGoal = pitch;
	const pos = new THREE.Vector3(), vel = new THREE.Vector3();
	let leaving = false, openT = -1, bob = 0;
	let groundY = 0; // the floor under the pilot, eased so steps and ramps read as smooth
	// What F would do now: open the hatch, one of the interior's actions, or nothing
	const HATCH = 'hatch';
	let target: Action | typeof HATCH | null = null, shown = '';
	const promptWhat = [...prompt.querySelectorAll('em')];
	const keys = new Set<string>();
	const frustum = new THREE.Frustum(), viewProj = new THREE.Matrix4(), probe = new THREE.Sphere();
	// The render resolution steps down if frames run long, and stays there
	const MAX_PR = Math.min(devicePixelRatio || 1, 1.5);
	let pr = MAX_PR, frameMs = 16.7, judgedAt = 0;

	function setup() {
		renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.setPixelRatio(pr);
		view.prepend(renderer.domElement);
		composer = new EffectComposer(renderer);
		pass = new RenderPass(new THREE.Scene(), camera);
		composer.addPass(pass);
		bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.36, 0.5, 0.93);
		composer.addPass(bloom);
		composer.addPass(new OutputPass());
		const pmrem = new THREE.PMREMGenerator(renderer);
		env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		pmrem.dispose();
		sky = loader.load(opts.textures + 'milky_way.jpg');
		sky.colorSpace = THREE.SRGBColorSpace;
		sky.mapping = THREE.EquirectangularReflectionMapping;
		mat = makeMaterials();
	}

	// Frees an interior's geometry, materials and textures. Each interior holds a few hundred megabytes of textures;
	// kept all at once they can exhaust the graphics card's memory, and then the textures that arrive last (photos
	// drawn in once they load, the poster atlas, video frames) fail to upload and show black. The materials and
	// textures every interior shares (the environment, the sky, the kit's materials) stay.
	function unload(l: Loaded) {
		const shared = new Set<THREE.Material>(Object.values(mat!));
		const textures = new Set<THREE.Texture>();
		l.scene.traverse((o) => {
			const m = o as THREE.Mesh;
			// A sprite's geometry is shared by every sprite, so only its material goes
			if (m.geometry && !(o instanceof THREE.Sprite)) m.geometry.dispose();
			if (o instanceof THREE.InstancedMesh) o.dispose();
			const list = !m.material ? [] : Array.isArray(m.material) ? m.material : [m.material];
			for (const x of list) {
				if (shared.has(x)) continue;
				for (const v of Object.values(x)) if (v instanceof THREE.Texture) textures.add(v);
				if (x instanceof THREE.ShaderMaterial) for (const u of Object.values(x.uniforms)) if (u.value instanceof THREE.Texture) textures.add(u.value);
				x.dispose();
			}
		});
		for (const sl of l.slots) textures.add(sl.live.tex);
		textures.delete(env!);
		textures.delete(sky!);
		for (const t of textures) t.dispose();
		l.it.leave?.();
		loaded.delete(l.id);
	}

	function load(id: string): Loaded {
		const scene = new THREE.Scene();
		scene.environment = env;
		scene.environmentIntensity = 0.35;
		scene.background = sky;
		scene.backgroundIntensity = 1.6;
		scene.backgroundRotation.set(0.4, 2.2, 0.3);
		const world = new THREE.Group();
		scene.add(world);
		const screens: Screen[] = [], slots: Slot[] = [];
		const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
			const mesh = new THREE.Mesh(g, m);
			mesh.position.set(x, y, z);
			world.add(mesh);
			return mesh;
		};
		const put = <T extends THREE.Object3D>(o: T, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
			o.position.set(x, y, z);
			parent.add(o);
			return o;
		};
		const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
		const glow = (c: string, k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k) });
		const m = mat!;
		const kit: Kit = {
			world, mat: m, std, glow, add, put,
			box: (w, h, d, mt, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mt, x, y, z),
			rbox: (w, h, d, mt, r = 0.012) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mt),
			rod(a, b, r, mt) {
				const d = b.clone().sub(a);
				const g = new THREE.CylinderGeometry(r, r, d.length(), 10);
				g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
				return add(g, mt, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
			},
			face(t, w, h, booted) {
				const sm = new THREE.ShaderMaterial({
					uniforms: { uMap: { value: t }, uTime: { value: 0 }, uReveal: { value: booted || opts.reduced ? 1 : 0 }, uGain: { value: 1.05 } },
					vertexShader: SCREEN_VERT,
					fragmentShader: SCREEN_FRAG,
				});
				const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), sm);
				screens.push({ mat: sm, mesh, at: new THREE.Vector3(), reveal: sm.uniforms.uReveal.value, on: booted, booted, src: t.image instanceof HTMLCanvasElement ? t.image : null });
				return mesh;
			},
			live(l, at, every, range = 7, radius = 0.7) {
				slots.push({ live: l, obj: at, at: new THREE.Vector3(), every, range, radius, next: slots.length * 0.02 });
			},
			hatch({ z, y, radius, material }) {
				const shape = new THREE.Shape().absarc(0, 0, radius, 0, Math.PI * 2, false);
				shape.holes.push(new THREE.Path().absarc(0, y, 0.68, 0, Math.PI * 2, true));
				const geo = new THREE.ShapeGeometry(shape, 64);
				const uv = geo.attributes.uv;
				for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / (2 * radius) + 0.5, uv.getY(i) / (2 * radius) + 0.5);
				add(geo, material, 0, 0, z);
				add(shell(0.68, 0.68, z - 1.4, z, 48).translate(0, y, 0), std({ color: '#3a3f46', roughness: 0.6, metalness: 0.5, side: THREE.BackSide }));
				add(new THREE.CircleGeometry(0.68, 48), m.gunmetal, 0, y, z - 1.4);
				for (const dz of [-0.45, -0.95]) add(new THREE.TorusGeometry(0.66, 0.012, 8, 48), m.green, 0, y, z + dz);
				add(new THREE.RingGeometry(0.68, 0.86, 64), new THREE.MeshStandardMaterial({ map: hazardSheet(1024, 128, 40), roughness: 0.6 }), 0, y, z + 0.005);
				add(new THREE.TorusGeometry(0.68, 0.04, 12, 64), m.metal, 0, y, z + 0.06);
				// The door: its wheel spins to unlock it, then it slides aside
				const door = new THREE.Group();
				door.position.set(0, y, z);
				door.userData.keep = true;
				world.add(door);
				put(new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.08, 64).rotateX(Math.PI / 2), m.white), door, 0, 0, 0.04);
				put(new THREE.Mesh(new THREE.CircleGeometry(0.11, 32), m.glass), door, 0, 0.36, 0.085);
				for (const s of [-1, 1]) put(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.08), m.gunmetal), door, s * 0.58, 0.3, 0.06);
				const wheel = put(new THREE.Group(), door, 0, 0, 0.12);
				put(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 10, 40), m.gunmetal), wheel, 0, 0, 0.02);
				put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 20).rotateX(Math.PI / 2), m.gunmetal), wheel);
				for (let i = 0; i < 4; i++) {
					const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
					const spoke = put(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 10).rotateZ(Math.PI / 2), m.gunmetal), wheel, Math.cos(a) * 0.11, Math.sin(a) * 0.11, 0.01);
					spoke.rotation.z = a;
				}
				const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: signTexture('AIRLOCK · EXIT', '#5fd28a') }));
				exitSign.position.set(0, y + 1.0, z + 0.02);
				world.add(exitSign);
				add(new THREE.SphereGeometry(0.03, 12, 8), m.green, 0.55, y + 1.0, z + 0.04);
				const hatchLight = new THREE.PointLight('#7dffa8', 0.6, 3, 2);
				hatchLight.position.set(0, y + 0.9, z + 0.3);
				world.add(hatchLight);
				return { door, wheel };
			},
			loader,
			textures: opts.textures,
			reduced: opts.reduced,
			redraw: () => { if (!raf) render(); },
		};
		const it = builders[id](kit);
		if (it.environment !== undefined) scene.environmentIntensity = it.environment;
		world.scale.setScalar(it.scale);
		// Lights fall off over world distance: stretch their reach with the interior and keep their brightness
		if (it.scale !== 1) world.traverse((o) => {
			if (o instanceof THREE.PointLight) {
				o.distance *= it.scale;
				o.intensity *= it.scale * it.scale;
			}
		});
		scene.updateMatrixWorld(true);
		for (const s of screens) s.mesh.getWorldPosition(s.at);
		for (const sl of slots) { sl.obj.getWorldPosition(sl.at); sl.live.draw(0); }
		mergeStatic(scene);
		// Compile every shader now rather than on the first frames, which would stutter
		renderer!.compile(scene, camera);
		return { id, scene, it, screens, slots, meshes: screens.filter((sc) => sc.src).map((sc) => sc.mesh) };
	}

	const fwd = new THREE.Vector3(), right = new THREE.Vector3(), want = new THREE.Vector3();
	function step(dt: number) {
		if (!cur) return;
		const { it, screens, slots } = cur, S = it.scale;
		const ease = opts.reduced ? 1 : 1 - Math.exp(-dt * 22);
		yaw += (yawGoal - yaw) * ease;
		pitch += (pitchGoal - pitch) * ease;
		const f = (keys.has('f') ? 1 : 0) - (keys.has('b') ? 1 : 0);
		const s = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
		fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
		right.set(Math.cos(yaw), 0, -Math.sin(yaw));
		want.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, s);
		// Walking pace in metres a second, so in the interior's units it shrinks as the interior is drawn larger
		if (want.lengthSq() > 0) want.normalize().multiplyScalar((keys.has('run') ? 3.4 : 1.7) / S);
		vel.lerp(want, 1 - Math.exp(-dt * 9));
		if (leaving) vel.multiplyScalar(0.9);
		pos.addScaledVector(vel, dt);
		it.collide(pos, 0.2 / S);
		const speed = Math.hypot(vel.x, vel.z) * S;
		bob += dt * speed * 5.2;
		if (it.ground) groundY += (it.ground(pos) - groundY) * (opts.reduced ? 1 : 1 - Math.exp(-dt * 14));
		camera.position.set(pos.x, it.eye + groundY + (opts.reduced ? 0 : (Math.sin(bob) * 0.018 * Math.min(speed, 1.6)) / S), pos.z).multiplyScalar(S);
		camera.rotation.set(pitch, yaw, 0);
		camera.updateMatrixWorld();
		// At the hatch and facing it, F opens it; near one of the interior's spots and facing its object, F does that
		const { hatch } = it;
		let next: Action | typeof HATCH | null = null;
		if (!leaving) {
			if (pos.z < hatch.z + 1.8 && Math.abs(pos.x) < 0.9 && fwd.z < -0.55) next = HATCH;
			else for (const a of it.actions ?? []) {
				if (Math.hypot(pos.x - a.x, pos.z - a.z) > a.reach) continue;
				want.set(a.look.x - pos.x, 0, a.look.z - pos.z).normalize();
				if (want.dot(fwd) > 0.75) { next = a; break; }
			}
		}
		const label = next === HATCH ? 'open the hatch' : next ? next.label() : shown;
		if (next !== target || label !== shown) {
			target = next;
			prompt.classList.toggle('on', !!next);
			if (label !== shown) for (const em of promptWhat) em.textContent = label;
			shown = label;
		}
		if (openT >= 0) {
			openT += dt;
			// Step back and look at the door while it opens
			const k = 1 - Math.exp(-dt * 4), back = hatch.z + 1.15;
			if (pos.z < back) pos.z += (back - pos.z) * k;
			pos.x -= pos.x * k;
			pitchGoal = Math.atan2(hatch.y - it.eye - groundY, pos.z - hatch.z);
			hatch.wheel.rotation.z = -Math.PI * 2 * THREE.MathUtils.smoothstep(openT, 0, 0.55);
			hatch.door.position.x = 1.42 * THREE.MathUtils.smoothstep(openT, 0.45, 1.15);
			// Timed by the animation itself, so the fade never runs ahead of the door
			if (openT > 0.95) host.classList.add('fading');
			if (openT > 1.55) { openT = -1; opts.onExit(cur.id); }
		}
		// The display under the reticle, if any, can be opened across the view
		const under = leaving ? null : aimAt(center);
		if (under !== aimed) {
			aimed = under;
			host.classList.toggle('aiming', !!under);
		}
		// Wall displays boot as the pilot comes near; all of them run their scanlines
		const time = (performance.now() - openedAt) / 1000;
		it.update?.(dt, time);
		for (const sc of screens) {
			if (!sc.on && camera.position.distanceTo(sc.at) < it.revealAt) sc.on = true;
			if (sc.on && sc.reveal < 1) sc.reveal = Math.min(1, sc.reveal + dt / 1.1);
			sc.mat.uniforms.uReveal.value = sc.reveal;
			sc.mat.uniforms.uTime.value = time;
		}
		// Live displays redraw at a display's pace, at most one per frame, and only while in view
		if (!opts.reduced) {
			let due: Slot | null = null;
			for (const sl of slots) if (time >= sl.next && (!due || sl.next < due.next)) due = sl;
			if (due) {
				due.next = time + due.every;
				viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
				frustum.setFromProjectionMatrix(viewProj);
				if (frustum.intersectsSphere(probe.set(due.at, due.radius * S)) && camera.position.distanceTo(due.at) < due.range) due.live.draw(time);
			}
		}
	}

	// ---------- Reading a display up close: the one under the reticle (or a tap) opens across the view ----------
	const ray = new THREE.Raycaster(), center = new THREE.Vector2();
	ray.far = 18;
	let aimed: Screen | null = null;
	let inspecting: { sc: Screen; slot: Slot | null; next: number } | null = null;
	function aimAt(ndc: THREE.Vector2) {
		if (!cur || !cur.meshes.length) return null;
		ray.setFromCamera(ndc, camera);
		const hit = ray.intersectObjects(cur.meshes, false)[0];
		return hit ? cur.screens.find((sc) => sc.mesh === hit.object) ?? null : null;
	}
	function copyInspect() {
		const src = inspecting?.sc.src;
		if (!src) return;
		if (inspectCv.width !== src.width || inspectCv.height !== src.height) {
			inspectCv.width = src.width;
			inspectCv.height = src.height;
			inspectEl.style.setProperty('--a', String(src.width / src.height));
		}
		inspectG.drawImage(src, 0, 0);
	}
	function openInspect(sc: Screen) {
		if (!cur || !sc.src || leaving) return;
		// A live display keeps drawing at its own pace while open
		const shown = sc.mat.uniforms.uMap.value;
		inspecting = { sc, slot: cur.slots.find((sl) => sl.live.tex === shown) ?? null, next: 0 };
		keys.clear();
		vel.set(0, 0, 0);
		copyInspect();
		inspectEl.hidden = false;
		void inspectEl.offsetWidth;
		host.classList.add('inspecting');
		prompt.classList.remove('on');
		// The mouse stays captured, so closing the display goes straight back to looking around
	}
	function closeInspect(relock = false, byClick = false) {
		if (!inspecting) return;
		inspecting = null;
		host.classList.remove('inspecting');
		inspectEl.hidden = true;
		target = null;
		last = performance.now();
		judgedAt = last + 1500;
		if (relock && matchMedia('(pointer: fine)').matches) lock(byClick);
	}

	function leave() {
		if (leaving || !cur) return;
		closeInspect();
		leaving = true;
		target = null;
		prompt.classList.remove('on');
		cur.it.leave?.();
		host.classList.add('leaving');
		if (document.pointerLockElement) document.exitPointerLock();
		if (opts.reduced) { opts.onExit(cur.id); return; }
		// The wheel turns, the door slides open, then the view fades out to the ship
		openT = 0;
		yawGoal = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2; // square on to the hatch
	}

	function render() {
		composer?.render();
	}

	function setResolution(next: number) {
		pr = next;
		renderer?.setPixelRatio(pr);
		composer?.setPixelRatio(pr);
		resize();
	}

	function frame(now: number) {
		// While a display is open the scene holds still behind it; only that display keeps updating
		if (inspecting) {
			const time = (now - openedAt) / 1000;
			if (inspecting.slot && time >= inspecting.next) {
				inspecting.next = time + inspecting.slot.every;
				inspecting.slot.live.draw(time);
				copyInspect();
			}
			raf = requestAnimationFrame(frame);
			return;
		}
		const ms = now - last;
		const dt = Math.min(ms / 1000, 0.05);
		last = now;
		// Long frames (hidden tabs aside) step the resolution down
		if (ms < 100) frameMs += (ms - frameMs) * 0.05;
		if (now - judgedAt > 1500) {
			judgedAt = now;
			if (frameMs > 22 && pr > 0.75) setResolution(Math.max(0.75, pr - 0.25));
		}
		step(dt);
		render();
		raf = requestAnimationFrame(frame);
	}

	function resize() {
		if (!renderer || !composer || !bloom) return;
		const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
		renderer.setSize(w, h, false);
		composer.setSize(w, h);
		camera.aspect = w / h;
		camera.fov = w / h < 0.8 ? 82 : 70;
		camera.updateProjectionMatrix();
	}
	new ResizeObserver(resize).observe(host);

	// ---------- Input: keys, a captured mouse (or touch drag) to look, the touch pad ----------
	const keyMap: Record<string, string> = { KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r', ShiftLeft: 'run', ShiftRight: 'run' };
	const act = () => {
		if (target === HATCH) leave();
		else target?.run();
	};
	addEventListener('keydown', (e) => {
		if (!isOpen) return;
		if (inspecting) { if (e.code !== 'Escape') e.preventDefault(); return; }
		if (e.code === 'KeyF' && target) { if (!e.repeat) act(); e.preventDefault(); return; }
		if (leaving || !(e.code in keyMap)) return;
		keys.add(keyMap[e.code]);
		e.preventDefault();
	});
	addEventListener('keyup', (e) => { if (e.code in keyMap) keys.delete(keyMap[e.code]); });
	addEventListener('blur', () => keys.clear());
	const look = (dx: number, dy: number, k: number) => {
		yawGoal -= dx * k;
		pitchGoal = THREE.MathUtils.clamp(pitchGoal - dy * k, -1.35, 1.35);
	};
	// The mouse is captured (pointer lock): the cursor is hidden and the view turns as far as the mouse moves.
	// Browsers only capture it on a click, so entering through a module's button captures it at once;
	// otherwise, and after Escape frees it, a click on the view captures it again.
	// `byClick` says whether the request answers the pilot's own click, which is what browsers require.
	const lock = (byClick = false) => {
		if (!isOpen || leaving || noLock || document.pointerLockElement === view) return;
		askedByClick = byClick;
		try { (view.requestPointerLock() as unknown as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* not allowed here */ }
	};
	// A refusal is usually passing: the request came without a click (opening from a link, a reload) or just after
	// Escape freed the mouse, when browsers wait a moment. Then the card asks for a click and the next one captures it.
	// Only a browser that refuses a click twice, well clear of an Escape, cannot capture at all (an embedded preview,
	// say), and falls back to dragging to look.
	let noLock = false, askedByClick = false, clickRefusals = 0;
	document.addEventListener('pointerlockerror', () => {
		if (!isOpen || !askedByClick || performance.now() - lockReleasedAt < 1500) return;
		if (++clickRefusals < 2) return;
		noLock = true;
		host.classList.add('no-lock');
	});
	document.addEventListener('pointerlockchange', () => {
		const locked = document.pointerLockElement === view;
		host.classList.toggle('locked', locked);
		if (locked) clickRefusals = 0;
		else lockReleasedAt = performance.now();
	});
	// Some browsers report an occasional huge jump while the mouse is captured; those are clipped
	const clip = (v: number) => THREE.MathUtils.clamp(v, -120, 120);
	document.addEventListener('mousemove', (e) => { if (isOpen && !inspecting && document.pointerLockElement === view) look(clip(e.movementX), clip(e.movementY), 0.0022); });
	inspectEl.addEventListener('click', () => closeInspect(true, true));
	prompt.addEventListener('click', act);
	host.querySelector('.cabin-capture')?.addEventListener('click', () => lock(true));
	let drag: { x: number; y: number } | null = null;
	// A press that barely moves is a tap: without a captured mouse, it opens the display under the pointer
	let tap: { t: number; moved: number } | null = null;
	view.addEventListener('pointermove', (e) => {
		if (tap) tap.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
		if (e.pointerType === 'mouse') {
			if (noLock && e.buttons & 1) look(e.movementX, e.movementY, 0.0035);
			return;
		}
		if (!drag) return;
		look(e.clientX - drag.x, e.clientY - drag.y, 0.004);
		drag = { x: e.clientX, y: e.clientY };
	});
	view.addEventListener('pointerdown', (e) => {
		// With the mouse captured, a left click opens the display under the reticle, and the next closes it again
		if (e.pointerType === 'mouse' && document.pointerLockElement === view) {
			if (e.button !== 0) return;
			if (inspecting) closeInspect();
			else if (aimed) openInspect(aimed);
			return;
		}
		tap = noLock || e.pointerType !== 'mouse' ? { t: performance.now(), moved: 0 } : null;
		if (e.pointerType === 'mouse') { lock(true); return; }
		drag = { x: e.clientX, y: e.clientY };
		try { view.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
	});
	view.addEventListener('pointerup', (e) => {
		if (tap && tap.moved < 8 && performance.now() - tap.t < 400) {
			const r = view.getBoundingClientRect();
			const sc = aimAt(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1));
			if (sc) openInspect(sc);
		}
		tap = null;
	});
	for (const ev of ['pointerup', 'pointercancel']) view.addEventListener(ev, () => { drag = null; });
	host.querySelectorAll<HTMLButtonElement>('.cabin-pad button').forEach((b) => {
		const k = b.dataset.key!;
		b.addEventListener('pointerdown', (e) => { e.preventDefault(); keys.add(k); b.setPointerCapture(e.pointerId); });
		for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => keys.delete(k));
	});

	const api: Interiors = {
		open(id) {
			if (isOpen && cur?.id === id) return;
			if (isOpen) api.close();
			if (!renderer) setup();
			// Only one interior is kept on the graphics card: entering another frees the last one first
			for (const other of [...loaded.values()]) if (other.id !== id) unload(other);
			let l = loaded.get(id);
			if (!l) { l = load(id); loaded.set(id, l); }
			cur = l;
			const { it } = l;
			pass!.scene = l.scene;
			renderer!.toneMappingExposure = it.exposure;
			title.replaceChildren(Object.assign(document.createElement('b'), { textContent: it.code }), ` ${it.name}`);
			isOpen = true;
			openedAt = performance.now();
			pos.copy(it.spawn);
			vel.set(0, 0, 0);
			groundY = it.ground ? it.ground(pos) : 0;
			yaw = yawGoal = it.spawnYaw;
			pitch = pitchGoal = -0.04;
			leaving = false;
			target = null;
			openT = -1;
			it.hatch.door.position.setX(0);
			it.hatch.wheel.rotation.set(0, 0, 0);
			// Each visit the wall displays boot again as they are approached
			for (const sc of l.screens) if (!sc.booted && !opts.reduced) { sc.on = false; sc.reveal = 0; }
			l.slots.forEach((sl, i) => { sl.next = i * 0.02; });
			frameMs = 16.7;
			judgedAt = performance.now() + 1500; // let it settle in first
			keys.clear();
			host.hidden = false;
			host.classList.remove('fading', 'leaving');
			void host.offsetWidth;
			host.classList.add('open');
			resize();
			last = performance.now();
			step(0);
			render();
			raf = requestAnimationFrame(frame);
			if (matchMedia('(pointer: fine)').matches) lock();
		},
		close() {
			if (!isOpen) return;
			closeInspect();
			isOpen = false;
			cancelAnimationFrame(raf);
			raf = 0;
			keys.clear();
			if (document.pointerLockElement) document.exitPointerLock();
			host.classList.remove('open', 'fading', 'locked', 'leaving');
			host.hidden = true;
			prompt.classList.remove('on');
			target = null;
			cur?.it.leave?.();
		},
		get isOpen() { return isOpen; },
		get current() { return cur?.id ?? ''; },
		get lockReleasedAt() { return lockReleasedAt; },
		get inspecting() { return !!inspecting; },
		closeInspect: () => closeInspect(true),
	};
	return api;
}
