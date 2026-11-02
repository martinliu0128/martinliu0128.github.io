// The vessel's third habitat bay: a concert hall inside a cylinder twenty-six metres across and forty long.
// A foyer by the hatch opens through an arch onto rows of velvet seats; balconies run along both walls with the
// pilot's piano story on displays beneath them, and at the far end a concert grand stands on a curved stage
// before a pipe organ, whose screen plays a recording of the pilot at the piano when F is pressed near the stage.
// Units are metres: +Z runs from the entrance hatch to the stage, +Y is up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
	ICE, COND, DISPLAY, FONT,
	rng, canvas, tex, storyScreen, shell, pushOut,
	type Panel, type Kit, type Interior,
} from './interior';

export type HallContent = {
	name: string; // the pilot's, for the foyer poster
	panels: Panel[]; // the wall displays, in reading order
	photo: string; // the foyer poster's photo
	film: { src: string; poster: string; title: string; caption: string };
};

const RH = 13; // hall radius
const FL = -6; // floor height; the hall's axis is y = 0
const HW = Math.sqrt(RH * RH - FL * FL); // half the floor's width
const Z0 = -20, Z1 = 20; // entrance and far bulkheads
const EYE = FL + 1.62;
const HATCH_Y = FL + 0.85;
const WALL = 11.2; // the panelled walls under the balconies
const BAL = FL + 4.6; // balcony floor
const BZ0 = -9.6, BZ1 = 7.6; // the balconies' extent
const ST = FL + 1.1; // stage floor
const stageFront = (x: number) => 8.8 + 0.012 * x * x; // the stage's front edge bows out toward the seats
const PZ = 13.5, PX = 1.7, PIANO_K = 1.25; // the piano: its straight side, its keyboard, and how much larger than life
const SCREEN = { y: FL + 6.75, z: 19.0, w: 10, h: 5.625 };
const GOLD = '#c9a24a', WINE = '#7a1626', VIOLET = '#7b5cff';

// ---------- Surfaces ----------

// The floor: walnut boards under the seats, wine carpet down the aisles, and an inlaid ring of piano keys in the
// foyer. Canvas x follows world x; canvas y runs from the entrance (top) to the stage.
function floorSheet() {
	const L = Z1 - Z0, W = 2048, H = Math.round((W * L) / (2 * HW));
	const { cv, g } = canvas(W, H);
	const s = W / (2 * HW);
	const X = (x: number) => (x + HW) * s, Z = (z: number) => (z - Z0) * s;
	const rand = rng(17);
	// Boards along the hall, their joints staggered
	const plank = 0.12 * s;
	for (let x = 0; x < W; x += plank) {
		let y = -rand() * 2 * s;
		while (y < H) {
			const len = (1.4 + rand() * 1.8) * s, k = (rand() - 0.5) * 14;
			g.fillStyle = `rgb(${74 + k},${46 + k * 0.7},${30 + k * 0.5})`;
			g.fillRect(x, y, plank - 1, len - 1.5);
			y += len;
		}
	}
	for (let n = 0; n < 14000; n++) {
		g.fillStyle = `rgba(20,10,4,${0.05 + rand() * 0.08})`;
		g.fillRect(rand() * W, rand() * H, 1, 4 + rand() * 20);
	}
	// Carpet runners: a gold border, then a faint diamond weave
	const runner = (x0: number, x1: number, z0: number, z1: number) => {
		g.fillStyle = '#4a0f19';
		g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
		g.fillStyle = 'rgba(255,255,255,0.025)';
		const d = 0.3 * s;
		for (let y = Z(z0); y < Z(z1); y += d) for (let x = X(x0) + ((y / d) % 2) * (d / 2); x < X(x1); x += d) g.fillRect(x, y, d / 2, d / 2);
		g.strokeStyle = GOLD;
		g.lineWidth = 3;
		g.strokeRect(X(x0) + 6, Z(z0) + 6, X(x1) - X(x0) - 12, Z(z1) - Z(z0) - 12);
	};
	runner(-1.25, 1.25, -10.9, 8.6);
	for (const e of [-1, 1]) runner(e > 0 ? 7.8 : -HW, e > 0 ? HW : -7.8, -10.9, 10.6);
	runner(-HW, HW, 5.6, 9.6);
	// The foyer's inlay: a ring of eighty-eight keys around the bay's name
	const cx = X(0), cy = Z(-15.2), r0 = 2.4 * s, r1 = 3.4 * s, rb = 2.95 * s;
	g.fillStyle = '#16100c';
	g.beginPath(); g.arc(cx, cy, r1 + 0.25 * s, 0, Math.PI * 2); g.fill();
	const whites = 52, step = (Math.PI * 2) / whites;
	for (let i = 0; i < whites; i++) {
		g.fillStyle = '#e9e3d4';
		g.beginPath(); g.arc(cx, cy, r1, i * step + 0.004, (i + 1) * step - 0.004); g.arc(cx, cy, r0, (i + 1) * step - 0.004, i * step + 0.004, true); g.closePath(); g.fill();
	}
	for (let i = 0; i < whites - 1; i++) {
		if (!'ACDFG'.includes('ABCDEFG'[i % 7])) continue;
		const a = (i + 1) * step;
		g.fillStyle = '#0d0b0a';
		g.beginPath(); g.arc(cx, cy, r1, a - step * 0.3, a + step * 0.3); g.arc(cx, cy, rb, a + step * 0.3, a - step * 0.3, true); g.closePath(); g.fill();
	}
	g.strokeStyle = GOLD;
	g.lineWidth = 6;
	for (const r of [r0 - 0.06 * s, r1 + 0.12 * s]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
	g.save();
	g.translate(cx, cy);
	g.rotate(Math.PI); // reads the right way up walking in from the hatch
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillStyle = GOLD;
	g.font = `400 ${Math.round(0.5 * s)}px ${DISPLAY}`;
	g.fillText('ML-1', 0, -0.55 * s);
	g.fillStyle = '#e9e3d4';
	g.font = `600 ${Math.round(0.36 * s)}px ${COND}`;
	g.fillText('THE CONCERT HALL', 0, 0.2 * s);
	g.fillStyle = 'rgba(201,162,74,0.85)';
	g.font = `600 ${Math.round(0.24 * s)}px ${COND}`;
	g.fillText('HABITAT BAY 3', 0, 0.75 * s);
	g.restore();
	return tex(cv);
}

// The hull above the balconies: warm wooden diffuser blocks low down, then a deep indigo vault with a gold
// meridian and faint painted stars. u runs around from +X through +Y, v from the entrance to the stage.
function vaultSheet() {
	const W = 4096, H = 1024;
	const { cv, g } = canvas(W, H);
	const rand = rng(29);
	const sky = g.createLinearGradient(0, 0, W, 0);
	sky.addColorStop(0, '#0d0b24'); sky.addColorStop(0.25, '#151236'); sky.addColorStop(0.5, '#0d0b24');
	g.fillStyle = sky;
	g.fillRect(0, 0, W, H);
	for (let n = 0; n < 2400; n++) {
		g.fillStyle = `rgba(255,${220 + rand() * 30},${170 + rand() * 60},${0.15 + rand() * 0.4})`;
		g.fillRect(rand() * W, rand() * H, 2, 2);
	}
	// Diffusers on each side, between the balconies and a third of the way up
	const U = (a: number) => ((((a / (Math.PI * 2)) % 1) + 1) % 1) * W;
	const low = Math.asin((BAL - 0.6) / RH), high = Math.asin(7.4 / RH);
	for (const [a0, a1] of [[low, high], [Math.PI - high, Math.PI - low]]) {
		const u0 = U(a0), u1 = U(a1), cols = 40, rows = 26, cw = (u1 - u0) / rows, ch = H / cols;
		for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
			const k = Math.floor(rand() * 5) * 9;
			g.fillStyle = `rgb(${92 + k},${58 + k * 0.7},${34 + k * 0.4})`;
			g.fillRect(u0 + i * cw + 1, j * ch + 1, cw - 2, ch - 2);
		}
		g.fillStyle = GOLD;
		for (const u of [u0, u1]) g.fillRect(u - 3, 0, 6, H);
	}
	// The meridian along the crown
	g.fillStyle = 'rgba(201,162,74,0.7)';
	g.fillRect(U(Math.PI / 2) - 4, 0, 8, H);
	return tex(cv);
}

// The walls under the balconies: vertical walnut slats over a dado, a gold reveal along the top. One tile is
// eight metres of wall, repeated down the hall.
function wallSheet() {
	const W = 1024, H = 560;
	const { cv, g } = canvas(W, H);
	const rand = rng(41);
	g.fillStyle = '#1d110a';
	g.fillRect(0, 0, W, H);
	for (let x = 0; x < W; x += 16) {
		const k = (rand() - 0.5) * 16;
		g.fillStyle = `rgb(${70 + k},${42 + k * 0.7},${26 + k * 0.4})`;
		g.fillRect(x + 2, 24, 12, H - 160);
	}
	g.fillStyle = '#2a1810';
	g.fillRect(0, H - 136, W, 136);
	g.fillStyle = GOLD;
	g.fillRect(0, 10, W, 6);
	g.fillRect(0, H - 140, W, 5);
	g.fillStyle = 'rgba(201,162,74,0.35)';
	g.fillRect(0, H - 24, W, 3);
	const t = tex(cv);
	t.wrapS = THREE.RepeatWrapping;
	t.repeat.set((Z1 - Z0) / 8, 1);
	return t;
}

function stageSheet() {
	const { cv, g } = canvas(1024, 1024);
	const rand = rng(53);
	for (let y = 0; y < 1024; y += 24) {
		let x = -rand() * 300;
		while (x < 1024) {
			const len = 180 + rand() * 260, k = (rand() - 0.5) * 10;
			g.fillStyle = `rgb(${38 + k},${26 + k * 0.6},${20 + k * 0.4})`;
			g.fillRect(x, y, len - 2, 22);
			x += len;
		}
	}
	const t = tex(cv);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.repeat.set(0.25, 0.25); // four metres a tile, in the stage's own metres
	return t;
}

// Two pages of music on the piano's desk
function musicSheet() {
	const { cv, g } = canvas(1024, 360);
	const rand = rng(61);
	for (const x0 of [0, 516]) {
		g.fillStyle = '#efe6cf';
		g.fillRect(x0, 0, 508, 360);
		for (let sys = 0; sys < 6; sys++) {
			const y0 = 34 + sys * 54;
			g.fillStyle = 'rgba(30,24,18,0.7)';
			for (let l = 0; l < 5; l++) g.fillRect(x0 + 24, y0 + l * 6, 460, 1.5);
			for (let x = x0 + 50; x < x0 + 470; x += 14 + rand() * 18) {
				const y = y0 - 6 + Math.floor(rand() * 8) * 4;
				g.beginPath(); g.ellipse(x, y, 4, 3, -0.4, 0, Math.PI * 2); g.fill();
				g.fillRect(x + 3, y - 18, 1.5, 18);
			}
		}
	}
	return tex(cv);
}

// The bay's name in gold, painted on a wall, or on a dark panel where it hangs in front of other things
function goldSign(text: string, sub: string, panel = false) {
	const { cv, g } = canvas(2048, 512);
	if (panel) {
		g.fillStyle = 'rgba(14,9,6,0.92)';
		g.beginPath(); g.roundRect(8, 8, 2032, 496, 24); g.fill();
		g.strokeStyle = GOLD;
		g.lineWidth = 8;
		g.stroke();
	}
	g.textAlign = 'center';
	g.fillStyle = '#e8d29a';
	let size = 190;
	do g.font = `400 ${size -= 6}px ${DISPLAY}`; while (g.measureText(text).width > 1900);
	g.fillText(text, 1024, 250);
	g.fillStyle = GOLD;
	g.fillRect(744, 298, 560, 8);
	g.fillStyle = 'rgba(232,210,154,0.85)';
	g.font = `600 80px ${COND}`;
	g.fillText(sub, 1024, 420);
	return tex(cv);
}

// A lightbox poster in the foyer: a photo with lines of type under it
function posterSheet(src: string, lines: [string, string, string], onChange: () => void) {
	const W = 1024, H = 1536;
	const { cv, g } = canvas(W, H);
	const t = tex(cv);
	let img: HTMLImageElement | null = null;
	const draw = () => {
		g.fillStyle = '#0b0918';
		g.fillRect(0, 0, W, H);
		if (img) {
			// Cover the top two thirds
			const bh = 980, k = Math.max(W / img.width, bh / img.height), w = img.width * k, h = img.height * k;
			g.save(); g.beginPath(); g.rect(0, 0, W, bh); g.clip();
			g.drawImage(img, (W - w) / 2, (bh - h) / 2, w, h);
			g.restore();
			const fade = g.createLinearGradient(0, bh - 260, 0, bh);
			fade.addColorStop(0, 'rgba(11,9,24,0)'); fade.addColorStop(1, 'rgba(11,9,24,1)');
			g.fillStyle = fade;
			g.fillRect(0, bh - 260, W, 260);
		}
		g.textAlign = 'center';
		g.fillStyle = GOLD;
		g.font = `600 44px ${COND}`;
		g.fillText(lines[0].toUpperCase(), W / 2, 1060);
		g.fillStyle = '#ffffff';
		g.font = `400 84px ${DISPLAY}`;
		g.fillText(lines[1].toUpperCase(), W / 2, 1190);
		g.fillStyle = GOLD;
		g.fillRect(W / 2 - 120, 1232, 240, 5);
		g.fillStyle = ICE;
		g.font = `400 40px ${FONT}`;
		const words = lines[2].split(' ');
		let line = '', y = 1310;
		for (const w of words) {
			const test = line ? `${line} ${w}` : w;
			if (g.measureText(test).width > W - 160 && line) { g.fillText(line, W / 2, y); line = w; y += 56; } else line = test;
		}
		g.fillText(line, W / 2, y);
		g.strokeStyle = 'rgba(201,162,74,0.6)';
		g.lineWidth = 4;
		g.strokeRect(24, 24, W - 48, H - 48);
		t.needsUpdate = true;
	};
	const im = new Image();
	im.onload = () => { img = im; draw(); onChange(); };
	im.src = src;
	draw();
	return t;
}

// The stage screen before (and after) the recording plays: its opening frame, dimmed, with the title and a play mark
function filmPoster(film: HallContent['film'], onChange: () => void) {
	const W = 1920, H = 1080;
	const { cv, g } = canvas(W, H);
	const t = tex(cv);
	let img: HTMLImageElement | null = null, state: 'idle' | 'loading' | 'ended' = 'idle';
	const draw = () => {
		g.fillStyle = '#06050f';
		g.fillRect(0, 0, W, H);
		if (img) {
			g.drawImage(img, 0, 0, W, H);
			g.fillStyle = 'rgba(6,5,18,0.55)';
			g.fillRect(0, 0, W, H);
		}
		const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
		vg.addColorStop(0, 'rgba(6,5,18,0)'); vg.addColorStop(1, 'rgba(6,5,18,0.75)');
		g.fillStyle = vg;
		g.fillRect(0, 0, W, H);
		// The play mark
		g.strokeStyle = 'rgba(255,255,255,0.9)';
		g.lineWidth = 8;
		g.beginPath(); g.arc(W / 2, H / 2 - 60, 110, 0, Math.PI * 2); g.stroke();
		g.fillStyle = '#ffffff';
		if (state === 'loading') {
			for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(W / 2 - 44 + i * 44, H / 2 - 60, 12, 0, Math.PI * 2); g.fill(); }
		} else {
			g.beginPath(); g.moveTo(W / 2 - 34, H / 2 - 120); g.lineTo(W / 2 + 62, H / 2 - 60); g.lineTo(W / 2 - 34, H / 2); g.closePath(); g.fill();
		}
		g.textAlign = 'center';
		g.font = `400 96px ${DISPLAY}`;
		g.fillText(film.title.toUpperCase(), W / 2, H / 2 + 170);
		g.fillStyle = 'rgba(228,236,247,0.85)';
		g.font = `400 46px ${FONT}`;
		g.fillText(film.caption, W / 2, H / 2 + 245);
		g.fillStyle = GOLD;
		g.font = `600 44px ${COND}`;
		g.fillText(state === 'loading' ? 'LOADING' : state === 'ended' ? 'PRESS  F  TO PLAY AGAIN' : 'PRESS  F  TO PLAY', W / 2, H - 90);
		t.needsUpdate = true;
	};
	const im = new Image();
	im.onload = () => { img = im; draw(); onChange(); };
	im.src = film.poster;
	draw();
	return { tex: t, set(s: typeof state) { state = s; draw(); } };
}

// A soft cone of light, brightest toward its source and its axis, for the stage spot
function beamMaterial(color: string) {
	return new THREE.ShaderMaterial({
		uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: 1 } },
		vertexShader: /* glsl */ `varying vec2 vUv; varying float vFace;
			void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal);
			vFace = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
		fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uK; varying vec2 vUv; varying float vFace;
			void main() { float a = pow(vFace, 2.0) * mix(0.015, 0.11, vUv.y) * uK; gl_FragColor = vec4(uColor * a, 1.0); }`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
}

// ---------- The concert grand ----------

// The case seen from above, as a shape in (-u, v): u runs from the keyboard back to the tail, v across from the
// straight bass side to the curved treble side. Rotated flat, it lies with its keyboard at x = 0, its tail toward -X
// and its curved side toward -Z.
function pianoOutline() {
	const s = new THREE.Shape();
	s.moveTo(0, 0);
	s.lineTo(-2.42, 0);
	s.quadraticCurveTo(-2.74, 0, -2.72, 0.3);
	s.bezierCurveTo(-2.7, 0.55, -2.55, 0.68, -2.35, 0.7);
	s.bezierCurveTo(-1.55, 0.78, -1.0, 1.57, -0.5, 1.57);
	s.lineTo(0, 1.57);
	s.closePath();
	return s;
}

function grandPiano(kit: Kit, m: { lacquer: THREE.Material; gold: THREE.Material; brass: THREE.Material }) {
	const { put, std } = kit;
	const piano = new THREE.Group();
	const flat = (g: THREE.BufferGeometry) => g.rotateX(-Math.PI / 2);
	const outline = pianoOutline();
	const pts = outline.getPoints(24);
	const c = pts.reduce((a, p) => a.add(p), new THREE.Vector2()).multiplyScalar(1 / pts.length);
	const scaled = (k: number) => pts.map((p) => p.clone().sub(c).multiplyScalar(k).add(c));
	// The rim, hollow, on a solid bottom
	const rim = new THREE.Shape(pts);
	rim.holes.push(new THREE.Path(scaled(0.94)));
	put(new THREE.Mesh(flat(new THREE.ExtrudeGeometry(rim, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 12 })), m.lacquer), piano, 0, 0.64, 0);
	put(new THREE.Mesh(flat(new THREE.ExtrudeGeometry(outline, { depth: 0.05, bevelEnabled: false, curveSegments: 24 })), m.lacquer), piano, 0, 0.6, 0);
	// Inside: the soundboard, the gold plate with its cut-outs, the strings
	put(new THREE.Mesh(flat(new THREE.ShapeGeometry(new THREE.Shape(scaled(0.95)))), std({ color: '#c49a62', roughness: 0.6 })), piano, 0, 0.7, 0);
	const plate = new THREE.Shape(scaled(0.86));
	for (const [u, v, r] of [[0.9, 0.45, 0.13], [1.35, 0.42, 0.11], [1.8, 0.4, 0.09], [0.9, 0.95, 0.12], [1.35, 0.78, 0.09]]) plate.holes.push(new THREE.Path().absarc(-u, v, r, 0, Math.PI * 2, true));
	put(new THREE.Mesh(flat(new THREE.ExtrudeGeometry(plate, { depth: 0.02, bevelEnabled: false, curveSegments: 16 })), m.gold), piano, 0, 0.78, 0);
	// Each string runs from the pin block to near the rim, so the bass strings are the long ones
	const poly = scaled(0.9);
	const reach = (v: number) => {
		let best = 0;
		for (let i = 0; i < poly.length; i++) {
			const a = poly[i], b = poly[(i + 1) % poly.length];
			if ((a.y - v) * (b.y - v) > 0 || a.y === b.y) continue;
			best = Math.max(best, -(a.x + ((v - a.y) / (b.y - a.y)) * (b.x - a.x)));
		}
		return best;
	};
	const strings: THREE.Vector3[] = [];
	for (let v = 0.12; v < 1.44; v += 0.0065) {
		const u1 = reach(v) - 0.06;
		if (u1 > 0.4) strings.push(new THREE.Vector3(-0.3, 0.825, -v), new THREE.Vector3(-u1, 0.825, -v));
	}
	put(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(strings), new THREE.LineBasicMaterial({ color: '#b9b6ad' })), piano);
	put(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 1.4), std({ color: '#3a2a1c', roughness: 0.6 })), piano, -0.18, 0.8, -0.78);
	// The lid, hinged along the straight side and propped open toward the hall
	const lid = put(new THREE.Group(), piano, 0, 0.955, 0);
	lid.rotation.x = 0.66;
	put(new THREE.Mesh(flat(new THREE.ExtrudeGeometry(outline, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 1, curveSegments: 24 })), m.lacquer), lid);
	// Its prop stick, from the rim up to the lid's underside
	const propFoot = new THREE.Vector3(-1.45, 0.955, -0.85);
	const propTop = new THREE.Vector3(-1.45, 0, -0.8).applyAxisAngle(new THREE.Vector3(1, 0, 0), lid.rotation.x).add(lid.position);
	const prop = put(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, propTop.distanceTo(propFoot), 8), m.lacquer), piano);
	prop.position.copy(propTop).add(propFoot).multiplyScalar(0.5);
	prop.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), propTop.clone().sub(propFoot).normalize());
	// The keyboard: its bed and cheek blocks, eighty-eight keys from A0 at the bass end, the fallboard behind
	const KW = 1.23 / 52, K0 = 0.17;
	put(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 1.53), m.lacquer), piano, 0.1, 0.665, -0.785);
	for (const z of [-0.09, -1.48]) put(kit.rbox(0.22, 0.17, 0.15, m.lacquer, 0.02), piano, 0.1, 0.71, z);
	const whites = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.022, KW - 0.0014), std({ color: '#f2efe6', roughness: 0.35 }), 52);
	const blacks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.095, 0.022, 0.0125), std({ color: '#0e0e10', roughness: 0.3 }), 36);
	const m4 = new THREE.Matrix4();
	let nb = 0;
	for (let i = 0; i < 52; i++) {
		whites.setMatrixAt(i, m4.makeTranslation(0.09, 0.726, -(K0 + (i + 0.5) * KW)));
		if (i < 51 && 'ACDFG'.includes('ABCDEFG'[i % 7])) blacks.setMatrixAt(nb++, m4.makeTranslation(0.055, 0.742, -(K0 + (i + 1) * KW)));
	}
	piano.add(whites, blacks);
	put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 1.26), m.lacquer), piano, -0.005, 0.81, -0.785);
	const logo = (() => {
		const { cv, g } = canvas(512, 64);
		g.fillStyle = GOLD;
		g.textAlign = 'center';
		g.font = `400 40px ${DISPLAY}`;
		g.fillText('ML-1', 256, 48);
		return tex(cv);
	})();
	const name = put(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.025), new THREE.MeshBasicMaterial({ map: logo, transparent: true, depthWrite: false })), piano, 0.0105, 0.84, -0.785);
	name.rotation.y = Math.PI / 2;
	// The music desk with two pages open on it
	const desk = put(new THREE.Group(), piano, -0.2, 1.1, -0.785);
	desk.rotation.z = 0.24;
	put(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.34, 0.92), m.lacquer), desk);
	put(new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.29), std({ map: musicSheet(), roughness: 0.9 })), desk, 0.011, 0.01, 0).rotation.y = Math.PI / 2;
	put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.92), m.lacquer), desk, 0.03, -0.17, 0);
	// Three legs on brass casters, and the lyre with its three pedals
	for (const [x, z] of [[-0.25, -0.13], [-0.25, -1.44], [-2.45, -0.32]]) {
		put(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.56, 14), m.lacquer), piano, x, 0.33, z);
		put(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 14), m.brass), piano, x, 0.07, z);
		put(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), m.brass), piano, x, 0.035, z);
		put(kit.rbox(0.2, 0.06, 0.2, m.lacquer, 0.02), piano, x, 0.6, z);
	}
	for (const z of [-0.7, -0.87]) put(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.52, 8), m.lacquer), piano, -0.38, 0.35, z);
	put(kit.rbox(0.14, 0.08, 0.32, m.lacquer, 0.02), piano, -0.38, 0.08, -0.785);
	for (const z of [-0.725, -0.785, -0.845]) put(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.035), m.brass), piano, -0.27, 0.075, z);
	return piano;
}

// ---------- The bay ----------

export function concertHall(content: HallContent) {
	return (kit: Kit): Interior => {
		const { world, mat, std, glow, add, put, box, rbox, rod, face } = kit;
		const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
		const walnut = std({ color: '#3b2416', roughness: 0.55, metalness: 0.05 });
		const walnutDark = std({ color: '#21130b', roughness: 0.6, metalness: 0.05 });
		const maple = std({ color: '#a77a4c', roughness: 0.5, metalness: 0.02 });
		const gold = std({ color: GOLD, roughness: 0.32, metalness: 0.95 });
		const tin = std({ color: '#d4d6da', roughness: 0.22, metalness: 1 });
		const lacquer = new THREE.MeshPhysicalMaterial({ color: '#050507', roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 });
		const warm = glow('#ffd9a0', 1.6), violet = glow(VIOLET, 1.5), screenEdge = glow(VIOLET, 1.2);
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
		const up = new THREE.Vector3(0, 1, 0);

		// ---------- Hall: the vault, ribs every four metres, the floor, the walls under the balconies ----------
		add(shell(RH, RH, Z0, Z1, 160), std({ map: vaultSheet(), roughness: 0.8, metalness: 0.05, side: THREE.BackSide }));
		for (let z = -18; z <= 18; z += 4) add(new THREE.TorusGeometry(RH - 0.14, 0.15, 10, 120), walnutDark, 0, 0, z);
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, Z1 - Z0), std({ map: floorSheet(), roughness: 0.62, metalness: 0 }));
		floor.rotation.x = -Math.PI / 2;
		floor.position.set(0, FL, (Z0 + Z1) / 2);
		world.add(floor);
		const wallMat = std({ map: wallSheet(), roughness: 0.6, metalness: 0.05 });
		for (const e of [-1, 1]) {
			const wall = add(new THREE.PlaneGeometry(Z1 - Z0, BAL - 0.3 - FL), wallMat, e * WALL, (FL + BAL - 0.3) / 2, (Z0 + Z1) / 2);
			wall.rotation.y = -e * Math.PI / 2;
			// The strip of floor between the wall and the hull, and the ledge over it
			box(HW - WALL, 0.02, Z1 - Z0, walnutDark, e * (WALL + HW) / 2, FL + 0.01, 0);
		}
		// Twinkling stars across the vault: points on the hull, bright enough to bloom a little
		const starPos: number[] = [];
		const srand = rng(97);
		for (let i = 0; i < 900; i++) {
			const a = 0.75 + srand() * (Math.PI - 1.5), r = RH - 0.06;
			starPos.push(Math.cos(a) * r, Math.sin(a) * r, Z0 + 1 + srand() * (Z1 - Z0 - 2));
		}
		const dot = (() => {
			const { cv, g } = canvas(64, 64);
			const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
			gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,236,200,0.6)'); gr.addColorStop(1, 'rgba(255,236,200,0)');
			g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
			return tex(cv);
		})();
		const starMat = new THREE.PointsMaterial({ map: dot, size: 0.16, color: new THREE.Color('#ffe7c2').multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
		world.add(new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)), starMat));

		// ---------- The hatch end: bulkhead, the bay's name over the hatch ----------
		const bulkMat = std({ color: '#1e130c', roughness: 0.75, metalness: 0.1 });
		const { door, wheel } = kit.hatch({ z: Z0, y: HATCH_Y, radius: RH, material: bulkMat });
		const hatchSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: goldSign('THE CONCERT HALL', 'HABITAT BAY 3  ·  ML-1'), transparent: true, depthWrite: false }));
		hatchSign.position.set(0, FL + 7.6, Z0 + 0.03);
		world.add(hatchSign);
		const far = add(new THREE.ShapeGeometry(new THREE.Shape().absarc(0, 0, RH, 0, Math.PI * 2, false), 96), bulkMat, 0, 0, Z1);
		far.rotation.y = Math.PI;

		// ---------- Two great arches: one between the foyer and the seats, one framing the stage ----------
		const archR = 12.35, a0 = Math.asin(FL / archR);
		for (const z of [-10.5, 8.4]) {
			add(new THREE.TorusGeometry(archR, 0.42, 14, 120, Math.PI - 2 * a0).rotateZ(a0), walnut, 0, 0, z);
			add(new THREE.TorusGeometry(archR - 0.42, 0.06, 8, 120, Math.PI - 2 * a0).rotateZ(a0), gold, 0, 0, z - 0.2);
			add(new THREE.TorusGeometry(archR - 0.42, 0.06, 8, 120, Math.PI - 2 * a0).rotateZ(a0), gold, 0, 0, z + 0.2);
			add(new THREE.TorusGeometry(archR - 0.5, 0.03, 6, 120, Math.PI - 2 * a0).rotateZ(a0), warm, 0, 0, z);
			// Coffers along the arch's soffit
			for (let i = 1; i < 24; i++) {
				const a = a0 + (i / 24) * (Math.PI - 2 * a0);
				const coffer = box(0.5, 0.08, 0.5, gold, Math.cos(a) * (archR - 0.44), Math.sin(a) * (archR - 0.44), z);
				coffer.rotation.z = a + Math.PI / 2;
			}
		}
		const archSign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: goldSign('THE CONCERT HALL', 'VSL-04  ·  HABITAT BAY 3', true), transparent: true, depthWrite: false }));
		archSign.position.set(0, FL + 6.2, -10.95);
		for (const s of [-2.6, 2.6]) rod(V(s, FL + 7.05, -10.95), V(s, Math.sqrt((archR - 0.42) ** 2 - s * s), -10.95), 0.015, gold);
		archSign.rotation.y = Math.PI;
		world.add(archSign);

		// ---------- Balconies along both walls, their fronts lit, two rows of seats on each ----------
		const seatGeo = mergeGeometries([
			new RoundedBoxGeometry(0.48, 0.1, 0.46, 1, 0.03).translate(0, 0.45, 0.02),
			new RoundedBoxGeometry(0.48, 0.56, 0.08, 1, 0.03).rotateX(-0.12).translate(0, 0.78, -0.22),
		]);
		const armGeo = mergeGeometries([new THREE.BoxGeometry(0.05, 0.05, 0.5).translate(0, 0.66, -0.02), new THREE.BoxGeometry(0.04, 0.64, 0.06).translate(0, 0.32, -0.12)]);
		const seatSpots: [number, number, number, number][] = [], armSpots: [number, number, number, number][] = [];
		for (const e of [-1, 1]) {
			const len = BZ1 - BZ0, zc = (BZ0 + BZ1) / 2;
			box(RH - 9, 0.3, len, walnut, e * (9 + (RH - 9) / 2), BAL - 0.15, zc);
			box(1.0, 0.3, len, walnut, e * 11.1, BAL + 0.15, zc); // the back row's step
			// Front: a panel with a gold rail, lamps along it, brackets beneath
			box(0.12, 1.1, len, walnutDark, e * 9.0, BAL + 0.25, zc);
			for (const y of [BAL - 0.22, BAL + 0.55]) box(0.14, 0.04, len, gold, e * 9.0, y, zc);
			add(new THREE.CylinderGeometry(0.045, 0.045, len, 10).rotateX(Math.PI / 2), gold, e * 9.0, BAL + 0.84, zc);
			for (let z = BZ0 + 0.8; z < BZ1; z += 2.4) {
				add(new THREE.SphereGeometry(0.08, 14, 10), warm, e * 8.9, BAL + 0.25, z);
				box(0.06, 0.24, 0.04, gold, e * 8.93, BAL + 0.25, z);
				const bracket = box(0.16, 0.8, 0.16, walnutDark, e * 9.5, BAL - 0.7, z);
				bracket.rotation.z = e * 0.6;
				// Downlights in the balcony's underside, over the side aisle
				add(new THREE.CircleGeometry(0.09, 16).rotateX(Math.PI / 2), warm, e * 10.2, BAL - 0.31, z + 1.2);
			}
			for (const z of [BZ0, BZ1]) box(RH - 9, 1.1, 0.12, walnutDark, e * (9 + (RH - 9) / 2), BAL + 0.25, z);
			for (let z = BZ0 + 0.5; z < BZ1 - 0.2; z += 0.56) {
				seatSpots.push([e * 9.9, BAL, z, -e * Math.PI / 2], [e * 10.85, BAL + 0.3, z, -e * Math.PI / 2]);
				armSpots.push([e * 9.9, BAL, z - 0.28, -e * Math.PI / 2], [e * 10.85, BAL + 0.3, z - 0.28, -e * Math.PI / 2]);
			}
		}

		// ---------- The stalls: fifteen rows each side of the center aisle ----------
		for (const e of [-1, 1]) for (let r = 0; r < 15; r++) {
			const z = -9 + r;
			for (let k = 0; k < 11; k++) seatSpots.push([e * (1.68 + k * 0.56), FL, z, 0]);
			for (let k = 0; k <= 11; k++) armSpots.push([e * (1.4 + k * 0.56), FL, z, 0]);
			// Aisle lights at the row ends
			add(new THREE.BoxGeometry(0.06, 0.03, 0.12), warm, e * 1.36, FL + 0.18, z - 0.05);
			add(new THREE.BoxGeometry(0.06, 0.03, 0.12), warm, e * 7.64, FL + 0.18, z - 0.05);
		}
		const seats = new THREE.InstancedMesh(seatGeo, std({ color: '#ffffff', roughness: 0.92, metalness: 0 }), seatSpots.length);
		const crand = rng(7);
		seatSpots.forEach(([x, y, z, r], i) => {
			seats.setMatrixAt(i, m4.compose(V(x, y, z), q.setFromAxisAngle(up, r), one));
			seats.setColorAt(i, col.set(WINE).multiplyScalar(0.9 + crand() * 0.2));
		});
		const arms = new THREE.InstancedMesh(armGeo, walnut, armSpots.length);
		armSpots.forEach(([x, y, z, r], i) => arms.setMatrixAt(i, m4.compose(V(x, y, z), q.setFromAxisAngle(up, r), one)));
		world.add(seats, arms);

		// ---------- The piano story on displays along the walls under the balconies ----------
		// Up the left aisle (+X) toward the stage, then back down the right
		const SW = 4.2, SH = 2.625, sy = FL + 2.25;
		const place = { code: 'VSL-04', name: 'The concert hall' };
		content.panels.slice(0, 6).forEach((p, i) => {
			const e = i < 3 ? 1 : -1, z = i < 3 ? -6.5 + i * 6.5 : 6.5 - (i - 3) * 6.5;
			const group = new THREE.Group();
			group.position.set(e * (WALL - 0.14), sy, z);
			group.rotation.y = -e * Math.PI / 2;
			put(rbox(SW + 0.32, SH + 0.32, 0.14, walnutDark, 0.04), group, 0, 0, -0.08);
			for (const [w, h, x, y] of [[SW + 0.12, 0.03, 0, SH / 2 + 0.06], [SW + 0.12, 0.03, 0, -SH / 2 - 0.06], [0.03, SH + 0.12, SW / 2 + 0.06, 0], [0.03, SH + 0.12, -SW / 2 - 0.06, 0]] as const) {
				put(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), gold), group, x, y, 0);
			}
			put(face(storyScreen(p, i, content.panels.length, i % 2 === 0, kit.redraw, place), SW, SH, false), group, 0, 0, 0.004);
			put(new THREE.Mesh(new THREE.BoxGeometry(SW - 0.6, 0.025, 0.025), violet), group, 0, -SH / 2 - 0.2, 0.02);
			world.add(group);
		});
		// Pilasters between the displays, gold at the base and the capital
		for (const e of [-1, 1]) for (const z of [-9.6, -3.25, 3.25, 9.6]) {
			add(new THREE.CylinderGeometry(0.2, 0.22, BAL - 0.3 - FL - 0.5, 16), walnut, e * 11.0, (FL + 0.25 + BAL - 0.55) / 2 + 0.12, z);
			box(0.56, 0.25, 0.56, gold, e * 11.0, FL + 0.125, z);
			box(0.6, 0.3, 0.6, gold, e * 11.0, BAL - 0.45, z);
			for (let k = 0; k < 8; k++) {
				const a = (k / 8) * Math.PI * 2;
				add(new THREE.BoxGeometry(0.02, BAL - FL - 1.1, 0.02), walnutDark, e * 11.0 + Math.cos(a) * 0.205, (FL + BAL) / 2 - 0.1, z + Math.sin(a) * 0.205);
			}
		}

		// ---------- The foyer: posters on stands, torchères, benches along the walls ----------
		const posterTexL = posterSheet(content.photo, ['The concert hall', content.name, 'Seventeen years at the piano. Walk the aisles to read the story.'], kit.redraw);
		const posterTexR = posterSheet(content.film.poster, ['On the stage screen', content.film.title, 'Walk up to the stage and press F to play the recording.'], kit.redraw);
		for (const e of [1, -1]) {
			const stand = new THREE.Group();
			// Turned toward the hatch, so they greet the pilot coming in
			stand.position.set(e * 3.3, FL, -13.2);
			stand.rotation.y = Math.atan2(-e * 3.3, Z0 + 1.4 + 13.2);
			world.add(stand);
			put(rbox(1.36, 2.0, 0.1, walnutDark, 0.03), stand, 0, 1.55, -0.02);
			put(new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), new THREE.MeshBasicMaterial({ map: e > 0 ? posterTexL : posterTexR, color: new THREE.Color(0.92, 0.92, 0.92) })), stand, 0, 1.55, 0.035);
			for (const s of [-0.5, 0.5]) put(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8), gold), stand, s, 0.3, 0);
			put(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.4), gold), stand, 0, 0.02, 0);
		}
		for (const e of [-1, 1]) for (const z of [-17.5, -12.5]) {
			add(new THREE.CylinderGeometry(0.035, 0.05, 2.2, 10), gold, e * 7.4, FL + 1.1, z);
			add(new THREE.CylinderGeometry(0.28, 0.1, 0.22, 20, 1, true), gold, e * 7.4, FL + 2.3, z);
			add(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), warm, e * 7.4, FL + 2.3, z);
			add(new THREE.CylinderGeometry(0.25, 0.3, 0.06, 20), gold, e * 7.4, FL + 0.03, z);
		}
		for (const e of [-1, 1]) {
			put(rbox(0.6, 0.14, 4.4, std({ color: WINE, roughness: 0.9 }), 0.05), world, e * 10.4, FL + 0.46, -16);
			box(0.5, 0.38, 4.2, walnutDark, e * 10.4, FL + 0.19, -16);
		}

		// ---------- The stage: a curved front with footlights, steps at its corners ----------
		const stageShape = new THREE.Shape();
		for (let i = 0; i <= 48; i++) {
			const x = -WALL + (i / 48) * WALL * 2;
			if (i === 0) stageShape.moveTo(x, -stageFront(x)); else stageShape.lineTo(x, -stageFront(x));
		}
		stageShape.lineTo(WALL, -Z1);
		stageShape.lineTo(-WALL, -Z1);
		add(new THREE.ShapeGeometry(stageShape).rotateX(-Math.PI / 2), std({ map: stageSheet(), roughness: 0.5, metalness: 0.05 }), 0, ST, 0);
		// The front: a vertical band following the curve, its footlight strip along the top edge
		const band = (y0: number, y1: number, inset: number, m: THREE.Material) => {
			const p: number[] = [], uv: number[] = [], idx: number[] = [];
			for (let i = 0; i <= 48; i++) {
				const x = -WALL + (i / 48) * WALL * 2, z = stageFront(x) - inset;
				p.push(x, y0, z, x, y1, z);
				uv.push(i / 48, 0, i / 48, 1);
				if (i) idx.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, (i - 1) * 2 + 1, i * 2 + 1, i * 2); // facing the seats
			}
			const g = new THREE.BufferGeometry();
			g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
			g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
			g.setIndex(idx);
			g.computeVertexNormals();
			return add(g, m);
		};
		band(FL, ST, 0, walnutDark);
		band(ST - 0.07, ST - 0.03, 0.012, glow('#ffd9a0', 1.3));
		band(FL + 0.2, FL + 0.24, 0.012, gold);
		// Three steps up at each corner, each shallower than the one below
		for (const e of [-1, 1]) for (let k = 0; k < 3; k++) {
			const h = (k + 1) * (ST - FL) / 3, d = 0.9 - k * 0.3;
			box(1.3, h, d + 0.3, walnutDark, e * 9.9, FL + h / 2, stageFront(9.25) - d / 2 + 0.15);
		}

		// ---------- The concert grand, its bench, and the spot that lights it ----------
		// A touch larger than life, so it holds the stage from the back rows
		const piano = grandPiano(kit, { lacquer, gold, brass: gold });
		piano.position.set(PX, ST, PZ);
		piano.scale.setScalar(PIANO_K);
		world.add(piano);
		const bench = put(new THREE.Group(), world, PX + 0.68 * PIANO_K, ST, PZ - 0.785 * PIANO_K);
		bench.scale.setScalar(PIANO_K);
		put(rbox(0.4, 0.1, 0.82, std({ color: '#141416', roughness: 0.55 }), 0.04), bench, 0, 0.5, 0);
		put(rbox(0.36, 0.1, 0.78, lacquer, 0.02), bench, 0, 0.42, 0);
		for (const [x, z] of [[-0.15, -0.34], [0.15, -0.34], [-0.15, 0.34], [0.15, 0.34]]) put(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.38, 8), lacquer), bench, x, 0.19, z);

		// ---------- The acoustic shell: maple panels in a curve each side, lit between, a canopy of reflectors overhead ----------
		for (const e of [-1, 1]) for (let k = 0; k < 6; k++) {
			const t = k / 5, x = e * (10.5 - 2.6 * t * t), z = 10.6 + 7.4 * t;
			const panel = new THREE.Group();
			panel.position.set(x, ST + 3.7, z);
			panel.rotation.y = Math.atan2(-x, 14.5 - z);
			panel.rotation.x = -0.05;
			world.add(panel);
			put(rbox(1.5, 7.2, 0.14, maple, 0.03), panel);
			for (let s = -3; s <= 3; s++) put(new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.08, 0.06), walnut), panel, 0, s * 0.95, 0.09);
			put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 6.8, 0.03), violet), panel, 0.8, 0, 0.02);
		}
		const hex = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.85, 0.85, 0.05, 6), std({ color: '#d9e0ea', roughness: 0.18, metalness: 0.25 }), 22);
		const cables: THREE.Vector3[] = [];
		const hrand = rng(13);
		for (let i = 0; i < 22; i++) {
			const x = -7 + (i % 6) * 2.8 + (Math.floor(i / 6) % 2) * 1.4, z = 11.6 + Math.floor(i / 6) * 2.1, y = FL + 12 + hrand() * 1.6;
			hex.setMatrixAt(i, m4.compose(V(x, y, z), q.setFromEuler(new THREE.Euler(-0.25 + hrand() * 0.2, hrand() * Math.PI, (hrand() - 0.5) * 0.3)), one));
			cables.push(V(x, y, z), V(x, Math.sqrt(RH * RH - x * x) - 0.1, z));
		}
		world.add(hex);
		const cableMat = new THREE.LineBasicMaterial({ color: '#6a6f78' });
		world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cables), cableMat));

		// ---------- The organ: its case across the back of the stage, pipe towers each side of the screen ----------
		box(WALL * 2, 2.6, 1.3, walnut, 0, ST + 1.3, Z1 - 0.65);
		for (let x = -10; x <= 10; x += 1.25) box(0.9, 1.8, 0.04, walnutDark, x, ST + 1.3, Z1 - 1.32);
		box(WALL * 2, 0.1, 1.4, gold, 0, ST + 2.62, Z1 - 0.7);
		const pipeGeo = mergeGeometries([
			new THREE.CylinderGeometry(1, 1, 1, 14, 1, true).translate(0, 0.5, 0),
			new THREE.ConeGeometry(1, 0.12, 14, 1, true).rotateX(Math.PI).translate(0, -0.06, 0),
		].map((g) => g.toNonIndexed()));
		const pipeSpots: [number, number, number, number][] = [];
		for (const e of [-1, 1]) {
			for (let k = 0; k < 15; k++) {
				const x = e * (5.75 + k * 0.32), h = 7.6 - Math.abs(k - 7) * 0.12 - k * 0.22;
				pipeSpots.push([x, ST + 2.8, Z1 - 0.95, h], [x + e * 0.16, ST + 2.8, Z1 - 0.55, h * 0.72]);
			}
		}
		for (let k = 0; k < 33; k++) {
			const x = -5.12 + k * 0.32, h = 0.9 + Math.cos((x / 5.3) * (Math.PI / 2)) * 1.7;
			pipeSpots.push([x, SCREEN.y + SCREEN.h / 2 + 0.55, Z1 - 0.8, h]);
		}
		const pipes = new THREE.InstancedMesh(pipeGeo, tin, pipeSpots.length);
		const mouths = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat.plastic, pipeSpots.length);
		pipeSpots.forEach(([x, y, z, h], i) => {
			const r = Math.min(0.13, 0.05 + h * 0.012);
			pipes.setMatrixAt(i, m4.compose(V(x, y + 0.12, z), q.identity(), V(r, h, r)));
			mouths.setMatrixAt(i, m4.compose(V(x, y + 0.12 + Math.min(0.5, h * 0.12), z - r - 0.002), q.setFromAxisAngle(up, Math.PI), V(r * 1.1, r * 0.9, 1)));
		});
		world.add(pipes, mouths);
		box(10.8, 0.12, 1.2, gold, 0, SCREEN.y + SCREEN.h / 2 + 0.5, Z1 - 0.8);
		for (const e of [-1, 1]) box(4.8, 0.14, 1.3, gold, e * 8.0, ST + 2.78, Z1 - 0.75);

		// ---------- The screen ----------
		const poster = filmPoster(content.film, kit.redraw);
		const screenMat = new THREE.MeshBasicMaterial({ map: poster.tex, toneMapped: false, color: new THREE.Color(0.88, 0.88, 0.88) });
		const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), screenMat);
		screen.position.set(0, SCREEN.y, SCREEN.z);
		screen.rotation.y = Math.PI;
		world.add(screen);
		put(rbox(SCREEN.w + 0.4, SCREEN.h + 0.4, 0.2, mat.dark, 0.06), world, 0, SCREEN.y, SCREEN.z + 0.12);
		for (const [w, h, x, y] of [[SCREEN.w + 0.2, 0.04, 0, SCREEN.h / 2 + 0.1], [SCREEN.w + 0.2, 0.04, 0, -SCREEN.h / 2 - 0.1], [0.04, SCREEN.h + 0.2, SCREEN.w / 2 + 0.1, 0], [0.04, SCREEN.h + 0.2, -SCREEN.w / 2 - 0.1, 0]] as const) {
			box(w, h, 0.04, screenEdge, x, SCREEN.y + y, SCREEN.z - 0.02);
		}
		// How far the recording has run, a gold line under the screen
		box(SCREEN.w, 0.035, 0.02, mat.dark, 0, SCREEN.y - SCREEN.h / 2 - 0.3, SCREEN.z - 0.03);
		const bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 0.02).translate(0.5, 0, 0), glow(GOLD, 1.4));
		bar.position.set(SCREEN.w / 2, SCREEN.y - SCREEN.h / 2 - 0.3, SCREEN.z - 0.045);
		bar.rotation.y = Math.PI;
		bar.scale.x = 0.0001;
		bar.userData.keep = true;
		world.add(bar);

		// ---------- Lighting bridge over the stage with its spots, and the beam on the piano ----------
		const bz = 10.0, by = FL + 12.2;
		for (const y of [by, by - 0.8]) for (const z of [bz - 0.4, bz + 0.4]) rod(V(-10.4, y, z), V(10.4, y, z), 0.06, mat.gunmetal);
		for (let x = -10.4; x < 10.4; x += 0.8) for (const z of [bz - 0.4, bz + 0.4]) rod(V(x, by, z), V(x + 0.8, by - 0.8, z), 0.03, mat.gunmetal);
		for (const x of [-9.6, -4, 4, 9.6]) rod(V(x, by, bz), V(x, Math.sqrt(RH * RH - x * x) - 0.1, bz), 0.04, mat.gunmetal);
		const aim = V(PX - 1.5 * PIANO_K, ST + 0.9, PZ - 0.9 * PIANO_K);
		for (const x of [-7.5, -4.5, -1.6, 1.6, 4.5, 7.5]) {
			const can = new THREE.Group();
			can.position.set(x, by - 1.15, bz);
			can.lookAt(x * 0.3, ST, 13.5);
			world.add(can);
			put(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 14).rotateX(Math.PI / 2), mat.dark), can);
			put(new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), Math.abs(x) < 2 ? warm : violet), can, 0, 0, 0.28);
			rod(V(x, by - 0.85, bz), V(x, by - 0.95, bz), 0.02, mat.gunmetal);
		}
		const spotAt = V(-1.6, by - 1.15, bz);
		const spot = new THREE.SpotLight('#fff0d8', 85, 0, 0.21, 0.65, 2);
		spot.position.copy(spotAt);
		spot.target.position.copy(aim);
		world.add(spot, spot.target);
		const beamLen = spotAt.distanceTo(aim);
		const beamMat = beamMaterial('#ffe6c4');
		const beam = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(0.19) * beamLen, beamLen, 40, 1, true), beamMat);
		beam.position.copy(spotAt).add(aim).multiplyScalar(0.5);
		beam.quaternion.setFromUnitVectors(up, spotAt.clone().sub(aim).normalize());
		world.add(beam);

		// ---------- Ring chandeliers over the seats ----------
		const crystal = std({ color: '#fff6e6', roughness: 0.05, metalness: 0.2, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0.6 });
		const chandeliers: THREE.Group[] = [];
		for (const z of [-5.5, 2]) {
			const ch = new THREE.Group();
			ch.position.set(0, FL + 12.6, z);
			ch.userData.keep = true;
			world.add(ch);
			chandeliers.push(ch);
			for (const [r, t, m] of [[2.4, 0.07, gold], [2.25, 0.035, warm], [1.5, 0.05, gold], [1.4, 0.03, warm]] as const) put(new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 96).rotateX(Math.PI / 2), m), ch);
			for (let k = 0; k < 8; k++) {
				const a = (k / 8) * Math.PI * 2;
				put(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6).rotateZ(Math.PI / 2), gold), ch, Math.cos(a) * 1.95, 0, Math.sin(a) * 1.95).rotation.y = -a;
			}
			const drops = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.07, 0), crystal, 48);
			for (let k = 0; k < 48; k++) {
				const a = (k / 48) * Math.PI * 2, r = k % 2 ? 2.4 : 1.5;
				drops.setMatrixAt(k, m4.compose(V(Math.cos(a) * r, -0.25 - (k % 3) * 0.12, Math.sin(a) * r), q.identity(), V(1, 1.8, 1)));
			}
			ch.add(drops);
			const lines: THREE.Vector3[] = [];
			for (let k = 0; k < 6; k++) {
				const a = (k / 6) * Math.PI * 2;
				lines.push(V(Math.cos(a) * 2.4, 0, Math.sin(a) * 2.4), V(Math.cos(a) * 0.3, RH - (FL + 12.6) - 0.1, Math.sin(a) * 0.3));
			}
			ch.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), cableMat));
		}

		// ---------- Lights: the chandeliers, the foyer, the stage spot, a violet wash from the organ ----------
		const hemi = new THREE.HemisphereLight('#ffe9cf', '#3a2418', 0.85);
		world.add(hemi);
		const lamps = [
			{ l: new THREE.PointLight('#ffdcb0', 62, 34, 2), at: V(0, FL + 11.8, -5.5), k: 62 },
			{ l: new THREE.PointLight('#ffdcb0', 62, 34, 2), at: V(0, FL + 11.8, 2), k: 62 },
			{ l: new THREE.PointLight('#ffd9a8', 30, 22, 2), at: V(0, FL + 6, -15.5), k: 30 },
		];
		for (const { l, at } of lamps) { l.position.copy(at); world.add(l); }
		const wash = new THREE.PointLight(VIOLET, 34, 30, 2);
		wash.position.set(0, FL + 6.2, 15.6);
		world.add(wash);

		// ---------- The recording: loaded on the first F, played on the screen; the hall dims while it runs ----------
		let video: HTMLVideoElement | null = null, videoTex: THREE.VideoTexture | null = null;
		let state: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' = 'idle';
		let dim = 0, sampleAt = 0;
		const sampler = canvas(8, 8);
		const shot = new THREE.Color(VIOLET), washBase = new THREE.Color(VIOLET);
		const glows = [warm, violet].map((m) => ({ m, base: m.color.clone() }));
		const showPoster = (s: 'idle' | 'loading' | 'ended') => { poster.set(s); screenMat.map = poster.tex; };
		function play() {
			if (!video) {
				video = document.createElement('video');
				video.src = content.film.src;
				video.playsInline = true;
				video.preload = 'auto';
				videoTex = new THREE.VideoTexture(video);
				videoTex.colorSpace = THREE.SRGBColorSpace;
				video.addEventListener('playing', () => { state = 'playing'; screenMat.map = videoTex; });
				video.addEventListener('waiting', () => { if (state === 'playing') state = 'loading'; });
				video.addEventListener('ended', () => { state = 'ended'; showPoster('ended'); });
			}
			if (state === 'idle' || state === 'ended') { showPoster('loading'); video.currentTime = 0; }
			state = state === 'paused' ? 'playing' : 'loading';
			video.play().catch(() => { state = 'idle'; showPoster('idle'); });
		}
		function pause() {
			if (!video) return;
			video.pause();
			if (state === 'loading' && screenMat.map === poster.tex) { state = 'idle'; showPoster('idle'); } else state = 'paused';
		}
		const running = () => state === 'playing' || state === 'loading';
		const applyLights = () => {
			const k = 1 - 0.82 * dim;
			for (const lamp of lamps) lamp.l.intensity = lamp.k * k;
			hemi.intensity = 0.85 * (1 - 0.7 * dim);
			spot.intensity = 85 * (1 - 0.5 * dim);
			beamMat.uniforms.uK.value = 1 - 0.6 * dim;
			for (const { m, base } of glows) m.color.copy(base).multiplyScalar(1 - 0.75 * dim);
			starMat.opacity = 1 - 0.4 * dim;
			wash.color.copy(washBase).lerp(shot, dim);
			wash.intensity = 34 + 26 * dim;
		};

		function update(dt: number, time: number) {
			for (const [i, ch] of chandeliers.entries()) ch.rotation.y = time * (i ? -0.03 : 0.03);
			const goal = running() ? 1 : 0;
			if (dim !== goal) {
				dim += Math.sign(goal - dim) * Math.min(Math.abs(goal - dim), dt / 1.6);
				applyLights();
			}
			if (video && video.duration) bar.scale.x = Math.max(0.0001, (video.currentTime / video.duration) * SCREEN.w);
			// The screen's light on the stage follows the picture, read from a tiny copy a few times a second
			if (video && state === 'playing' && time > sampleAt) {
				sampleAt = time + 0.2;
				sampler.g.drawImage(video, 0, 0, 8, 8);
				const d = sampler.g.getImageData(0, 0, 8, 8).data;
				let r = 0, g = 0, b = 0;
				for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
				const n = (d.length / 4) * 255;
				shot.setRGB(r / n, g / n, b / n, THREE.SRGBColorSpace).multiplyScalar(1.6);
				applyLights();
			}
		}

		return {
			code: 'VSL-04',
			name: 'The concert hall, habitat bay 3',
			scale: 1,
			eye: EYE,
			spawn: V(0, EYE, Z0 + 1.4),
			spawnYaw: Math.PI,
			collide,
			hatch: { z: Z0, y: HATCH_Y, door, wheel },
			revealAt: 9,
			exposure: 1.0,
			actions: [{
				x: 0, z: 6.5, reach: 10, look: V(0, SCREEN.y, SCREEN.z),
				label: () => (running() ? 'pause the video' : state === 'paused' ? 'resume the video' : state === 'ended' ? 'play the video again' : 'play the video'),
				run: () => (running() ? pause() : play()),
			}],
			update,
			leave() {
				if (running()) pause();
				dim = 0;
				applyLights();
			},
		};
	};
}

// ---------- Walking ----------

// The floor up to the stage, around the two banks of seats, the foyer's stands and benches, and the stage steps
const blocks = [
	{ x0: 1.3, x1: 7.75, z0: -9.4, z1: 5.4 },
	{ x0: -7.75, x1: -1.3, z0: -9.4, z1: 5.4 },
	{ x0: 2.65, x1: 3.95, z0: -13.6, z1: -12.8 },
	{ x0: -3.95, x1: -2.65, z0: -13.6, z1: -12.8 },
	{ x0: 9.9, x1: 11, z0: -18.3, z1: -13.7 },
	{ x0: -11, x1: -9.9, z0: -18.3, z1: -13.7 },
	...[-17.5, -12.5].flatMap((z) => [7.4, -7.4].map((x) => ({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2 }))),
	{ x0: 9.2, x1: 11, z0: stageFront(9.25) - 0.9, z1: 12 },
	{ x0: -11, x1: -9.2, z0: stageFront(9.25) - 0.9, z1: 12 },
	// The arches' feet
	...[-10.5, 8.4].flatMap((z) => [{ x0: 10.3, x1: 11.5, z0: z - 0.45, z1: z + 0.45 }, { x0: -11.5, x1: -10.3, z0: z - 0.45, z1: z + 0.45 }]),
];
function collide(p: THREE.Vector3, radius: number) {
	p.x = THREE.MathUtils.clamp(p.x, -10.4, 10.4);
	p.z = THREE.MathUtils.clamp(p.z, Z0 + 0.3, stageFront(p.x) - 0.3);
	pushOut(p, blocks, radius);
}
