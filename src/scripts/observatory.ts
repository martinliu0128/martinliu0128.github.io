// The vessel's second habitat bay: an observatory inside a cylinder twenty-five metres across and thirty-eight long,
// kept dark for the eyes. The hatch opens into a tunnel of baffle rings, like the inside of a telescope's tube, and out
// onto the observatory floor. A great reflector stands on a stepped dais to the left, tracking the sky through a slit
// in the hull, with a catwalk ring around its tube; a gallery of instruments runs along the right wall above a
// spectrum frieze; an orrery turns in the floor; and the far bulkhead is one great screen, facing the tunnel, that
// tells the pilot's astronomy story a page at a time, with telemetry and a target list either side of it.
// Units are metres: +Z runs from the entrance hatch to the screen, +Y is up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
	AMBER, ICE, DIM, CYAN, GREEN, FONT, COND, DISPLAY,
	rng, canvas, tex, wrap, storyScreen, liveCanvas, displayFrame, pushOut, Quads, M,
	type Panel, type Live, type Kit, type Interior,
} from './interior';

export type ObservatoryContent = {
	panels: Panel[]; // the main screen's pages, in the order F turns through them
	targets: { name: string; kind: string; note: string }[];
};

const RH = 12.5; // hull radius
const FL = -6; // floor height; the hull's axis is y = 0
const HW = Math.sqrt(RH * RH - FL * FL); // half the floor's width
const Z0 = -19, Z1 = 19; // entrance and far bulkheads
const EYE = 1.62; // above whichever floor the pilot stands on
const HATCH_Y = FL + 0.85;
// The entrance tunnel: an arch of this radius about a centre this high, out to its mouth
const TUN = { r: 2.8, cy: FL + 1.6, z1: -13 };
const TA = Math.asin((FL - TUN.cy) / TUN.r); // where the arch meets the floor
const TW = Math.sqrt(TUN.r * TUN.r - (FL - TUN.cy) ** 2); // half the tunnel floor's width
// The instrument gallery along the -X wall, and the stair up to it: a landing, then a flight down toward +Z
const MEZ = { x: -6.6, y: FL + 3.4, z0: -12, z1: 5 };
const STAIR = { x0: -6.6, x1: -5.0, z0: -11.6, zt: -10, zb: -4 };
// The telescope's dais (three steps), its pier, and how the tube sits over it
const TEL = { x: 6.4, z: -1, steps: [4.5, 4.0, 3.5], rise: 0.35, pier: 2.5 };
const DAIS = FL + TEL.rise * TEL.steps.length;
const ALT_H = 4.8; // the altitude axis above the dais
const AZ0 = -0.35, ALT0 = 1.35; // where it points: outboard and a little forward, close to the zenith
// The catwalk ringing the tube, centred where the tube passes through its height, and the ladder up to it
const CW = (() => {
	const y = FL + 8, h = (y - DAIS - ALT_H) / Math.tan(ALT0);
	return { x: TEL.x + Math.cos(AZ0) * h, y, z: TEL.z - Math.sin(AZ0) * h };
})();
const LADDER = { x: CW.x, z: CW.z + 2.65 };
const ORR = { z: 6.2, r: 3.0 }; // the orrery in the floor
const CONS = { z: 13.2 }; // the console bank before the screen
const SCREEN = { w: 19.2, h: 12, y: FL + 1.5 + 6, z: Z1 - 0.36 }; // as large as the bulkhead holds
const SIDE = { x: 10.0, z: 15.2 }; // the tall displays on the walls either side of it
const VIOLET = '#8a7dff', NIGHT = '#ff3b2f';
const UP = new THREE.Vector3(0, 1, 0);

// The telescope tracks its target: a slow drift in azimuth and altitude
const pointing = (time: number) => ({ az: AZ0 + 0.035 * Math.sin(time * 0.021), alt: ALT0 + 0.02 * Math.sin(time * 0.017 + 1.3) });

// Where the telescope's line of sight leaves the hull: the slit is cut around it
const SLIT = (() => {
	const c = new THREE.Vector3(TEL.x, DAIS + ALT_H, TEL.z);
	const d = new THREE.Vector3(Math.cos(ALT0) * Math.cos(AZ0), Math.sin(ALT0), -Math.cos(ALT0) * Math.sin(AZ0));
	const a = d.x * d.x + d.y * d.y, b = 2 * (c.x * d.x + c.y * d.y), k = c.x * c.x + c.y * c.y - RH * RH;
	const t = (-b + Math.sqrt(b * b - 4 * a * k)) / (2 * a);
	const hit = c.clone().addScaledVector(d, t);
	const at = Math.atan2(hit.y, hit.x);
	return { at, a0: at - 0.19, a1: at + 0.19, z0: hit.z - 5, z1: hit.z + 5, hit, dir: d, axis: c };
})();

// Constellations painted on the vault: where each sits (its angle around the hull, and z), its stars and its lines
const SKY: { name: string; a: number; z: number; stars: [number, number][]; lines: [number, number][] }[] = [
	{ name: 'Ursa Major', a: 1.72, z: -8, stars: [[0, 0], [0.9, 0.1], [1.7, 0.35], [2.4, 0.5], [2.6, 1.3], [3.6, 1.4], [3.75, 0.55]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
	{ name: 'Orion', a: 1.25, z: 10, stars: [[0, 0], [1.6, 0.2], [0.6, 1.4], [0.85, 1.5], [1.1, 1.6], [0.3, 2.9], [1.8, 2.8], [0.8, -0.6]], lines: [[0, 7], [7, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
	{ name: 'Cassiopeia', a: 2.05, z: 5, stars: [[0, 0], [0.6, 0.7], [1.2, 0.2], [1.8, 0.8], [2.5, 0.3]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
	{ name: 'Cygnus', a: 2.35, z: -4, stars: [[0, 0], [0.9, 0.9], [2.2, 2.2], [1.8, 0.1], [0.1, 1.8]], lines: [[0, 1], [1, 2], [3, 1], [1, 4]] },
	{ name: 'Lyra', a: 2.6, z: 12, stars: [[0, 0], [0.4, 0.5], [0.9, 0.6], [1.0, 1.2], [0.5, 1.1]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 1]] },
	{ name: 'Scorpius', a: 0.5, z: 11, stars: [[-0.3, -0.2], [0, 0], [0.3, 0.5], [0.5, 1.0], [0.7, 1.5], [0.8, 2.0], [1.2, 2.5], [1.7, 2.6], [2.0, 2.3], [1.9, 1.9], [0.4, -0.3]], lines: [[0, 1], [10, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]] },
	{ name: 'Leo', a: 1.55, z: 1.5, stars: [[0, 0], [0, -0.7], [0.3, -1.2], [0.8, -1.3], [1.0, -0.9], [1.6, -0.5], [2.6, -0.3], [1.6, 0.15]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7], [7, 0]] },
];

// ---------- Surfaces ----------

// The hull's inner skin, as one sheet that is also its glow: near-black plating, a faint coordinate grid, painted
// stars and the constellations. u runs around from +X through +Y, v from the entrance to the screen.
function vaultSheet() {
	const W = 4096, H = 2048;
	const { cv, g } = canvas(W, H);
	const rand = rng(23);
	g.fillStyle = '#04060b';
	g.fillRect(0, 0, W, H);
	// Plating seams, a metre or two apart
	const cols = 96, rows = 19;
	for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
		const k = rand() * 5;
		g.fillStyle = `rgb(${6 + k},${8 + k},${14 + k})`;
		g.fillRect((i * W) / cols + 2, (j * H) / rows + 2, W / cols - 4, H / rows - 4);
	}
	// Hour circles and declination lines
	g.fillStyle = 'rgba(111,214,255,0.07)';
	for (let i = 0; i < 48; i++) g.fillRect((i * W) / 48, 0, 2, H);
	for (let j = 1; j < 12; j++) g.fillRect(0, (j * H) / 12, W, 2);
	// Painted stars
	for (let n = 0; n < 5200; n++) {
		const b = rand();
		g.fillStyle = `rgba(${200 + rand() * 55},${210 + rand() * 45},255,${0.08 + b * b * 0.5})`;
		const s = b > 0.96 ? 3 : 2;
		g.fillRect(rand() * W, rand() * H, s, s);
	}
	// The constellations, about a metre and a half to a unit. The sheet's rows run toward the entrance as seen from
	// inside, so the figures and their names are drawn flipped top to bottom to read the right way round.
	const unit = 84;
	for (const c of SKY) {
		const ox = (c.a / (Math.PI * 2)) * W, oy = H - ((c.z - Z0) / (Z1 - Z0)) * H;
		const P = ([x, y]: [number, number]) => [ox + x * unit, oy - y * unit];
		g.strokeStyle = 'rgba(111,214,255,0.32)';
		g.lineWidth = 2.5;
		for (const [a, b] of c.lines) {
			const [x0, y0] = P(c.stars[a]), [x1, y1] = P(c.stars[b]);
			g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
		}
		for (const s of c.stars) {
			const [x, y] = P(s);
			const gr = g.createRadialGradient(x, y, 0, x, y, 14);
			gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(210,225,255,0.45)'); gr.addColorStop(1, 'rgba(210,225,255,0)');
			g.fillStyle = gr;
			g.fillRect(x - 14, y - 14, 28, 28);
		}
		const [lx, ly] = P(c.stars[0]);
		g.save();
		g.translate(lx + 18, ly + 22);
		g.scale(1, -1);
		g.font = `600 30px ${COND}`;
		g.fillStyle = 'rgba(147,163,192,0.55)';
		g.fillText(c.name.toUpperCase(), 0, 0);
		g.restore();
	}
	const t = tex(cv);
	t.wrapS = THREE.RepeatWrapping;
	return t;
}

// The floor, which is also its own glow: graphite tiles, a grating down the tunnel, red guide lines along the
// walkways, a compass rose around the dais and a scale around the orrery. Canvas x follows world x; canvas y runs from
// the entrance (top) to the screen.
function floorSheet() {
	const L = Z1 - Z0, W = 2048, H = Math.round((W * L) / (2 * HW));
	const { cv, g } = canvas(W, H);
	const s = W / (2 * HW);
	const X = (x: number) => (x + HW) * s, Z = (z: number) => (z - Z0) * s;
	const rand = rng(31);
	g.fillStyle = '#07090d';
	g.fillRect(0, 0, W, H);
	const tile = 1.2 * s;
	for (let x = 0; x < W; x += tile) for (let y = 0; y < H; y += tile) {
		const k = rand() * 6;
		g.fillStyle = `rgb(${12 + k},${14 + k},${19 + k})`;
		g.fillRect(x + 2, y + 2, tile - 4, tile - 4);
	}
	// The tunnel's grating
	g.fillStyle = '#0d1016';
	g.fillRect(X(-TW), 0, X(TW) - X(-TW), Z(TUN.z1));
	g.fillStyle = 'rgba(0,0,0,0.55)';
	for (let y = 0; y < Z(TUN.z1); y += 0.08 * s) g.fillRect(X(-TW), y, X(TW) - X(-TW), 0.03 * s);
	// Red guide lines: the tunnel, then the runner up the middle to the orrery, then out to the consoles
	const red = (x0: number, z0: number, x1: number, z1: number, dash = 0) => {
		g.strokeStyle = 'rgba(255,59,47,0.85)';
		g.lineWidth = 0.05 * s;
		g.setLineDash(dash ? [dash * s, dash * 0.6 * s] : []);
		g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke();
	};
	for (const e of [-1, 1]) {
		red(e * (TW - 0.18), Z0, e * (TW - 0.18), TUN.z1);
		red(e * 1.2, TUN.z1, e * 1.2, ORR.z - ORR.r - 0.7, 0.4);
		red(e * 1.2, ORR.z + ORR.r + 0.7, e * 1.2, CONS.z - 1.6, 0.4);
	}
	g.setLineDash([]);
	// The compass rose around the dais: a tick every five degrees, the cardinal points lettered
	const cx = X(TEL.x), cy = Z(TEL.z), r0 = (TEL.steps[0] + 0.15) * s;
	g.strokeStyle = 'rgba(242,177,59,0.5)';
	g.lineWidth = 3;
	g.beginPath(); g.arc(cx, cy, r0 + 0.55 * s, 0, Math.PI * 2); g.stroke();
	for (let i = 0; i < 72; i++) {
		const a = (i / 72) * Math.PI * 2, len = (i % 6 ? 0.18 : 0.4) * s;
		g.strokeStyle = i % 18 ? 'rgba(242,177,59,0.45)' : 'rgba(255,59,47,0.9)';
		g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len)); g.stroke();
	}
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.font = `600 ${Math.round(0.36 * s)}px ${COND}`;
	g.fillStyle = 'rgba(255,59,47,0.9)';
	for (const [label, a] of [['N', -Math.PI / 2], ['E', 0], ['S', Math.PI / 2], ['W', Math.PI]] as const) {
		const r = r0 + 0.9 * s;
		g.fillText(label, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
	}
	// The orrery's scale: a ring of the zodiac's twelve divisions
	const ox = X(0), oy = Z(ORR.z), ro = (ORR.r + 0.45) * s;
	g.strokeStyle = 'rgba(138,125,255,0.55)';
	g.lineWidth = 3;
	for (const r of [ro, ro + 0.4 * s]) { g.beginPath(); g.arc(ox, oy, r, 0, Math.PI * 2); g.stroke(); }
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * Math.PI * 2;
		g.beginPath(); g.moveTo(ox + Math.cos(a) * ro, oy + Math.sin(a) * ro); g.lineTo(ox + Math.cos(a) * (ro + 0.4 * s), oy + Math.sin(a) * (ro + 0.4 * s)); g.stroke();
	}
	// The bay's name, reading the right way up walking in from the tunnel
	g.save();
	g.translate(X(0), Z(-11.2));
	g.rotate(Math.PI);
	g.fillStyle = 'rgba(228,236,247,0.75)';
	g.font = `400 ${Math.round(0.42 * s)}px ${DISPLAY}`;
	g.fillText('THE OBSERVATORY', 0, 0);
	g.fillStyle = 'rgba(255,59,47,0.75)';
	g.font = `600 ${Math.round(0.26 * s)}px ${COND}`;
	g.fillText('HABITAT BAY 2  ·  ML-1  ·  KEEP LIGHTS LOW', 0, 0.5 * s);
	g.restore();
	return tex(cv);
}

// A star's spectrum: the rainbow from violet to deep red, crossed by dark absorption lines
const LINES: { name: string; nm: number; depth: number }[] = [
	{ name: 'Ca K', nm: 393.4, depth: 0.55 }, { name: 'Ca H', nm: 396.8, depth: 0.5 }, { name: 'Hδ', nm: 410.2, depth: 0.35 },
	{ name: 'Hγ', nm: 434.0, depth: 0.4 }, { name: 'Hβ', nm: 486.1, depth: 0.5 }, { name: 'Mg b', nm: 517.3, depth: 0.3 },
	{ name: 'Na D', nm: 589.3, depth: 0.45 }, { name: 'Hα', nm: 656.3, depth: 0.6 },
];
const NM0 = 380, NM1 = 720;
function spectrumBand(w: number, h: number) {
	const { cv, g } = canvas(w, h);
	for (let x = 0; x < w; x++) {
		const nm = NM0 + (x / w) * (NM1 - NM0);
		const hue = 270 - ((nm - NM0) / (NM1 - NM0)) * 270;
		const edge = Math.min(1, (nm - NM0) / 30, (NM1 - nm) / 40);
		g.fillStyle = `hsl(${hue},100%,${Math.round(18 + 40 * edge)}%)`;
		g.fillRect(x, 0, 1, h);
	}
	for (const l of LINES) {
		const x = ((l.nm - NM0) / (NM1 - NM0)) * w;
		g.fillStyle = `rgba(0,0,0,${0.5 + l.depth * 0.5})`;
		g.fillRect(x - w / 900, 0, Math.max(2, w / 450), h);
	}
	return cv;
}

// A rack's face: panels of indicator lamps, some lit, which is also its glow
function rackSheet() {
	const { cv, g } = canvas(256, 512);
	const rand = rng(43);
	g.fillStyle = '#0b0d11';
	g.fillRect(0, 0, 256, 512);
	for (let y = 12; y < 500; y += 46) {
		g.fillStyle = '#14171d';
		g.fillRect(10, y, 236, 38);
		for (let x = 22; x < 236; x += 16) {
			const r = rand();
			g.fillStyle = r > 0.8 ? GREEN : r > 0.72 ? AMBER : r > 0.68 ? NIGHT : '#1c2129';
			g.fillRect(x, y + 14, 7, 7);
		}
	}
	return tex(cv);
}

// The bay's name, painted on a dark wall
function nameSign(text: string, sub: string) {
	const { cv, g } = canvas(2048, 512);
	g.textAlign = 'center';
	g.fillStyle = '#dfe4ff';
	g.font = `400 190px ${DISPLAY}`;
	g.fillText(text, 1024, 250);
	g.fillStyle = VIOLET;
	g.fillRect(744, 298, 560, 8);
	g.fillStyle = 'rgba(223,228,255,0.8)';
	g.font = `600 80px ${COND}`;
	g.fillText(sub, 1024, 420);
	return tex(cv);
}

// A soft glow for sprites: the orrery's sun, the lamps
function glowDot(inner: string, outer: string) {
	const { cv, g } = canvas(128, 128);
	const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	gr.addColorStop(0, inner); gr.addColorStop(0.25, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
	g.fillStyle = gr;
	g.fillRect(0, 0, 128, 128);
	return tex(cv);
}

// ---------- Displays ----------

// The strip under the main screen: the four pages as tabs, the open one lit
function pageStrip(panels: Panel[]) {
	const W = 2048, H = 112;
	const { cv, g } = canvas(W, H);
	const t = tex(cv);
	const set = (page: number) => {
		g.fillStyle = '#04070d';
		g.fillRect(0, 0, W, H);
		g.textBaseline = 'middle';
		g.font = `600 40px ${COND}`;
		g.fillStyle = AMBER;
		g.fillText(`PAGE ${page + 1} / ${panels.length}`, 28, H / 2);
		g.fillStyle = DIM;
		g.font = `600 28px ${COND}`;
		g.fillText('F  TURNS THE PAGE', 28, H / 2 + 34);
		const x0 = 330, tw = (W - x0 - 20) / panels.length;
		panels.forEach((p, i) => {
			const x = x0 + i * tw, on = i === page;
			g.fillStyle = on ? 'rgba(242,177,59,0.16)' : 'rgba(111,214,255,0.05)';
			g.fillRect(x + 6, 10, tw - 12, H - 20);
			g.fillStyle = on ? AMBER : 'rgba(111,214,255,0.35)';
			g.fillRect(x + 6, H - 14, tw - 12, 4);
			let size = 36;
			const label = `${p.tag}  ${p.title.toUpperCase()}`;
			do g.font = `600 ${size -= 2}px ${COND}`; while (g.measureText(label).width > tw - 40 && size > 18);
			g.fillStyle = on ? '#ffffff' : DIM;
			g.fillText(label, x + 22, H / 2 - 2);
		});
		t.needsUpdate = true;
	};
	set(0);
	return { tex: t, set };
}

// Degrees, minutes and seconds, or hours, minutes and seconds
const sexa = (v: number, unit: string[]) => {
	const sign = v < 0 ? '-' : '';
	v = Math.abs(v);
	const a = Math.floor(v), b = Math.floor((v - a) * 60), c = ((v - a) * 60 - b) * 60;
	return `${sign}${String(a).padStart(2, '0')}${unit[0]} ${String(b).padStart(2, '0')}${unit[1]} ${c.toFixed(1).padStart(4, '0')}${unit[2]}`;
};

// A tall display's header: the name, a tag, a rule under them
function tallHeader(g: CanvasRenderingContext2D, W: number, title: string, tag: string) {
	const bg = g.createLinearGradient(0, 0, 0, 2000);
	bg.addColorStop(0, '#0c1828'); bg.addColorStop(1, '#03080f');
	g.fillStyle = bg;
	g.fillRect(0, 0, W, 2000);
	g.fillStyle = 'rgba(110,170,240,0.045)';
	for (let y = 50; y < 2000; y += 50) g.fillRect(0, y, W, 1);
	g.fillStyle = 'rgba(111,214,255,0.09)';
	g.fillRect(0, 0, W, 150);
	g.fillStyle = 'rgba(111,214,255,0.55)';
	g.fillRect(0, 150, W, 2);
	g.textBaseline = 'alphabetic';
	g.textAlign = 'left';
	g.font = `400 40px ${DISPLAY}`;
	g.fillStyle = ICE;
	g.fillText(title.toUpperCase(), 34, 78);
	g.font = `600 30px ${COND}`;
	g.fillStyle = DIM;
	g.fillText(tag.toUpperCase(), 34, 122);
}

// Beside the screen: what the telescope is doing. Its pointing follows the telescope itself, and the guide camera holds
// the target star on its crosshair.
function telemetryScreen(): Live {
	const W = 520, H = 2000;
	const { g, t, begin } = liveCanvas(W, H, 0.6);
	const draw = (time: number) => {
		begin();
		tallHeader(g, W, 'Telescope', 'ML-1  ·  2.8 m reflector');
		const { az, alt } = pointing(time);
		let y = 230;
		const row = (label: string, value: string, color = ICE, size = 70) => {
			g.font = `600 30px ${COND}`;
			g.fillStyle = DIM;
			g.fillText(label, 34, y);
			g.font = `600 ${size}px ${COND}`;
			g.fillStyle = color;
			g.fillText(value, 34, y + size * 0.95);
			y += size + 70;
		};
		row('TARGET', 'M61  ·  NGC 4303', AMBER, 62);
		row('AZIMUTH', `${((((90 - (az * 180) / Math.PI) % 360) + 360) % 360).toFixed(2).padStart(6, '0')}°`);
		row('ALTITUDE', `${((alt * 180) / Math.PI).toFixed(2)}°`);
		row('RIGHT ASCENSION', sexa(12.36525, ['h', 'm', 's']), ICE, 56);
		row('DECLINATION', sexa(4.4736, ['°', '′', '″']), ICE, 56);
		row('SIDEREAL TIME', sexa(((14.2 + time / 3590) % 24), ['h', 'm', 's']), ICE, 56);
		// Tracking, with a pulsing lamp
		g.fillStyle = `rgba(95,210,138,${0.55 + 0.45 * Math.sin(time * 3)})`;
		g.beginPath(); g.arc(50, y - 14, 12, 0, Math.PI * 2); g.fill();
		g.font = `600 40px ${COND}`;
		g.fillStyle = GREEN;
		g.fillText('TRACKING  ·  SIDEREAL', 76, y);
		y += 50;
		// The guide camera: the star trembles on the crosshair as the seeing shifts
		const bx = 34, by = y, bw = W - 68;
		g.fillStyle = '#020407';
		g.fillRect(bx, by, bw, bw);
		const jx = Math.sin(time * 2.3) * 6 + Math.sin(time * 5.1) * 3, jy = Math.cos(time * 1.9) * 5 + Math.sin(time * 4.4) * 3;
		const gx = bx + bw / 2 + jx, gy = by + bw / 2 + jy;
		const gr = g.createRadialGradient(gx, gy, 0, gx, gy, 46);
		gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(200,220,255,0.6)'); gr.addColorStop(1, 'rgba(200,220,255,0)');
		g.fillStyle = gr;
		g.fillRect(gx - 46, gy - 46, 92, 92);
		g.strokeStyle = 'rgba(255,59,47,0.85)';
		g.lineWidth = 2;
		g.beginPath(); g.moveTo(bx + bw / 2, by + 20); g.lineTo(bx + bw / 2, by + bw - 20); g.moveTo(bx + 20, by + bw / 2); g.lineTo(bx + bw - 20, by + bw / 2); g.stroke();
		g.strokeRect(bx + bw / 2 - 60, by + bw / 2 - 60, 120, 120);
		g.strokeStyle = 'rgba(111,214,255,0.4)';
		g.strokeRect(bx, by, bw, bw);
		g.font = `600 28px ${COND}`;
		g.fillStyle = DIM;
		g.fillText(`GUIDE STAR  ·  RMS ${(0.28 + 0.06 * Math.sin(time * 0.7)).toFixed(2)}″`, bx, by + bw + 44);
		y = by + bw + 110;
		// Conditions, as bars
		for (const [label, v, color] of [['SEEING', 0.62 + 0.08 * Math.sin(time * 0.4), CYAN], ['HUMIDITY', 0.31, CYAN], ['MIRROR ΔT', 0.18 + 0.03 * Math.sin(time * 0.2), AMBER], ['SLIT', 1, GREEN]] as const) {
			g.font = `600 28px ${COND}`;
			g.fillStyle = DIM;
			g.fillText(label, 34, y);
			g.fillStyle = 'rgba(111,214,255,0.12)';
			g.fillRect(34, y + 14, W - 68, 16);
			g.fillStyle = color;
			g.fillRect(34, y + 14, (W - 68) * v, 16);
			y += 76;
		}
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// Beside the screen on the other side: the pilot's target list, one target acquired after another
function catalogueScreen(targets: ObservatoryContent['targets']): Live {
	const W = 520, H = 2000;
	const { g, t, begin } = liveCanvas(W, H, 0.6);
	const draw = (time: number) => {
		begin();
		tallHeader(g, W, 'Target list', `${targets.length} objects  ·  personal catalogue`);
		const cur = Math.floor(time / 6) % targets.length, k = (time % 6) / 6;
		let y = 200;
		targets.forEach((tg, i) => {
			const on = i === cur, h = 290;
			g.fillStyle = on ? 'rgba(242,177,59,0.1)' : 'rgba(111,214,255,0.035)';
			g.fillRect(24, y, W - 48, h - 24);
			g.fillStyle = on ? AMBER : 'rgba(111,214,255,0.3)';
			g.fillRect(24, y, 6, h - 24);
			g.font = `600 28px ${COND}`;
			g.fillStyle = on ? AMBER : DIM;
			g.fillText(`OBJ ${String(i + 1).padStart(2, '0')}  ·  ${tg.kind.toUpperCase()}`, 52, y + 46);
			g.font = `400 44px ${DISPLAY}`;
			g.fillStyle = on ? '#ffffff' : ICE;
			g.fillText(tg.name.toUpperCase(), 52, y + 110);
			g.font = `400 30px ${FONT}`;
			g.fillStyle = '#c3cfdf';
			wrap(g, tg.note, 52, y + 160, W - 110, 40);
			if (on) {
				g.fillStyle = 'rgba(242,177,59,0.25)';
				g.fillRect(52, y + h - 52, W - 120, 8);
				g.fillStyle = AMBER;
				g.fillRect(52, y + h - 52, (W - 120) * Math.min(1, k * 1.6), 8);
			}
			y += h;
		});
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// The gallery's all-sky chart: the sky turning overhead, drawn once and turned, with the horizon, the altitude rings
// and the target marked
function skyChartScreen(): Live {
	const W = 1600, H = 1000;
	const { g, t, begin } = liveCanvas(W, H, 0.6);
	const R = 370, D = R * 2;
	const field = canvas(D, D);
	const rand = rng(59);
	for (let n = 0; n < 900; n++) {
		const r = Math.sqrt(rand()) * R, a = rand() * Math.PI * 2, b = rand();
		field.g.fillStyle = `rgba(230,238,255,${0.25 + b * b * 0.75})`;
		const s = b > 0.95 ? 4 : b > 0.7 ? 2.5 : 1.6;
		field.g.beginPath(); field.g.arc(R + Math.cos(a) * r, R + Math.sin(a) * r, s, 0, Math.PI * 2); field.g.fill();
	}
	SKY.forEach((c, i) => {
		const a = (i / SKY.length) * Math.PI * 2, r = 140 + (i % 3) * 80;
		const ox = R + Math.cos(a) * r - 60, oy = R + Math.sin(a) * r - 40;
		field.g.strokeStyle = 'rgba(111,214,255,0.5)';
		field.g.lineWidth = 2;
		for (const [p, q] of c.lines) {
			field.g.beginPath(); field.g.moveTo(ox + c.stars[p][0] * 34, oy + c.stars[p][1] * 34); field.g.lineTo(ox + c.stars[q][0] * 34, oy + c.stars[q][1] * 34); field.g.stroke();
		}
		field.g.fillStyle = '#ffffff';
		for (const [x, y] of c.stars) { field.g.beginPath(); field.g.arc(ox + x * 34, oy + y * 34, 3.5, 0, Math.PI * 2); field.g.fill(); }
	});
	const cx = 540, cy = 575;
	const draw = (time: number) => {
		begin();
		const { pad, top } = displayFrame(g, W, H, 'All-sky chart', 'Live  ·  zenith up', GREEN);
		const turn = time * 0.012;
		g.save();
		g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
		g.fillStyle = '#01030a';
		g.fillRect(cx - R, cy - R, D, D);
		g.translate(cx, cy);
		g.rotate(turn);
		g.drawImage(field.cv, -R, -R);
		g.restore();
		// Altitude rings and the horizon
		g.strokeStyle = 'rgba(111,214,255,0.25)';
		g.lineWidth = 2;
		g.setLineDash([8, 10]);
		for (const r of [R / 3, (R * 2) / 3]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
		g.setLineDash([]);
		g.strokeStyle = 'rgba(228,236,247,0.7)';
		g.lineWidth = 3;
		g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
		g.textAlign = 'center';
		g.textBaseline = 'middle';
		g.font = `600 34px ${COND}`;
		g.fillStyle = NIGHT;
		for (const [l, a] of [['N', -Math.PI / 2], ['E', Math.PI], ['S', Math.PI / 2], ['W', 0]] as const) g.fillText(l, cx + Math.cos(a) * (R + 28), cy + Math.sin(a) * (R + 28));
		// The target, carried round with the sky
		const ta = 0.9 + turn, tr = R * 0.18;
		const tx = cx + Math.cos(ta) * tr, ty = cy + Math.sin(ta) * tr;
		g.strokeStyle = AMBER;
		g.lineWidth = 3;
		g.strokeRect(tx - 22, ty - 22, 44, 44);
		g.beginPath(); g.moveTo(tx - 36, ty); g.lineTo(tx - 22, ty); g.moveTo(tx + 22, ty); g.lineTo(tx + 36, ty); g.stroke();
		g.font = `600 28px ${COND}`;
		g.fillStyle = AMBER;
		g.fillText('M61', tx, ty - 44);
		// The facts beside it
		g.textAlign = 'left';
		g.textBaseline = 'alphabetic';
		let y = top + 40;
		const x = 1040;
		for (const [label, value] of [['FIELD', 'Full sky, fisheye'], ['TARGET', 'M61 in Virgo'], ['AIRMASS', (1.03 + 0.01 * Math.sin(time * 0.1)).toFixed(3)], ['MOON', 'Waxing crescent, 34%'], ['SKY', 'Mag 21.6 per arcsec²']]) {
			g.font = `600 30px ${COND}`;
			g.fillStyle = DIM;
			g.fillText(label, x, y);
			g.font = `400 46px ${FONT}`;
			g.fillStyle = ICE;
			g.fillText(value, x, y + 54);
			y += 140;
		}
		g.fillStyle = 'rgba(111,214,255,0.25)';
		g.fillRect(pad, H - pad - 4, W - pad * 2, 2);
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// The gallery's spectrograph: the target's spectrum building up, its absorption lines named
function spectrographScreen(): Live {
	const W = 1600, H = 1000;
	const { g, t, begin } = liveCanvas(W, H, 0.6);
	const band = spectrumBand(1200, 60);
	const draw = (time: number) => {
		begin();
		const { pad, top } = displayFrame(g, W, H, 'Spectrograph', 'Slit 1.2″  ·  R 2000', AMBER);
		const x0 = pad + 60, x1 = W - pad - 20, y0 = top + 120, y1 = H - pad - 110;
		g.drawImage(band, x0, top + 20, x1 - x0, 60);
		g.strokeStyle = 'rgba(111,214,255,0.15)';
		g.lineWidth = 1;
		for (let i = 0; i <= 4; i++) { const y = y0 + ((y1 - y0) * i) / 4; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
		// Continuum, the lines cut into it, and noise that settles as the exposure runs on
		const exp = (time % 120) / 120, noise = 0.05 * (1 - exp) + 0.008;
		const seed = Math.floor(time * 4);
		g.beginPath();
		for (let i = 0; i <= 360; i++) {
			const nm = NM0 + (i / 360) * (NM1 - NM0);
			let f = 0.18 + 0.72 * Math.exp(-(((nm - 520) / 190) ** 2));
			for (const l of LINES) f *= 1 - l.depth * Math.exp(-(((nm - l.nm) / 2.4) ** 2));
			const n = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
			f += (n - Math.floor(n) - 0.5) * noise;
			const x = x0 + (i / 360) * (x1 - x0), y = y1 - f * (y1 - y0);
			if (i) g.lineTo(x, y); else g.moveTo(x, y);
		}
		g.strokeStyle = CYAN;
		g.lineWidth = 3;
		g.stroke();
		g.font = `600 26px ${COND}`;
		g.textAlign = 'center';
		for (const l of LINES) {
			const x = x0 + ((l.nm - NM0) / (NM1 - NM0)) * (x1 - x0);
			g.fillStyle = 'rgba(242,177,59,0.35)';
			g.fillRect(x - 1, y0, 2, y1 - y0);
			g.fillStyle = AMBER;
			g.fillText(l.name, x, y0 - 12);
		}
		g.textAlign = 'left';
		g.font = `600 30px ${COND}`;
		g.fillStyle = DIM;
		g.fillText(`${NM0} NM`, x0, y1 + 44);
		g.textAlign = 'right';
		g.fillText(`${NM1} NM`, x1, y1 + 44);
		g.textAlign = 'left';
		g.fillStyle = ICE;
		g.fillText(`EXPOSURE  ${String(Math.floor(exp * 120)).padStart(3, '0')} / 120 S   ·   M61 NUCLEUS   ·   z = 0.00522`, x0 + 260, y1 + 44);
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// The console bank's small screens, six on one sheet: guide camera, histogram, weather, log, focus and slit
const CELL = { w: 512, h: 320, cols: 3, rows: 2 };
function consoleSheet(): Live {
	const W = CELL.w * CELL.cols, H = CELL.h * CELL.rows;
	const { g, t, begin } = liveCanvas(W, H, 0.75);
	const log = ['Dome slit open', 'Mirror cover retracted', 'Slewing to M61', 'Acquired guide star', 'Focus +0.12 mm', 'Exposure started', 'Flat field queued', 'Seeing 0.9″', 'Filter: Hα', 'Autoguider locked'];
	const draw = (time: number) => {
		begin();
		const cell = (i: number, title: string, tag: string, body: (top: number) => void) => {
			g.save();
			g.translate((i % CELL.cols) * CELL.w, Math.floor(i / CELL.cols) * CELL.h);
			const { top } = displayFrame(g, CELL.w, CELL.h, title, tag);
			body(top);
			g.restore();
		};
		cell(0, 'Guide', 'CAM 1', (top) => {
			const cx = 256 + Math.sin(time * 2) * 4, cy = (top + 300) / 2 + Math.cos(time * 1.7) * 4;
			const gr = g.createRadialGradient(cx, cy, 0, cx, cy, 30);
			gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, 'rgba(200,220,255,0)');
			g.fillStyle = gr;
			g.fillRect(cx - 30, cy - 30, 60, 60);
			g.strokeStyle = NIGHT;
			g.lineWidth = 2;
			g.strokeRect(216, (top + 300) / 2 - 40, 80, 80);
		});
		cell(1, 'Histogram', 'CCD', (top) => {
			for (let i = 0; i < 40; i++) {
				const h = 180 * Math.exp(-(((i - 9) / 5) ** 2)) * (0.9 + 0.1 * Math.sin(time * 3 + i));
				g.fillStyle = i < 20 ? CYAN : 'rgba(111,214,255,0.4)';
				g.fillRect(40 + i * 11, 290 - h, 8, h);
			}
			g.fillStyle = AMBER;
			g.fillRect(40, top, 2, 290 - top);
		});
		cell(2, 'Weather', 'MAST', (top) => {
			g.font = `600 30px ${COND}`;
			let y = top + 40;
			for (const [l, v] of [['WIND', `${(3.1 + Math.sin(time * 0.3)).toFixed(1)} m/s`], ['CLOUD', '0 %'], ['SEEING', `${(0.88 + 0.05 * Math.sin(time * 0.5)).toFixed(2)}″`], ['DEW', '-4.2 °C']]) {
				g.fillStyle = DIM; g.fillText(l, 36, y);
				g.fillStyle = ICE; g.fillText(v, 220, y);
				y += 52;
			}
		});
		cell(3, 'Log', 'OBS', (top) => {
			g.font = `400 28px ${FONT}`;
			const first = Math.floor(time / 2.5);
			for (let k = 0; k < 5; k++) {
				g.fillStyle = k === 4 ? AMBER : '#c3cfdf';
				g.fillText(`${String((first + k) % 60).padStart(2, '0')}:${String((first * 7 + k * 13) % 60).padStart(2, '0')}  ${log[(first + k) % log.length]}`, 30, top + 40 + k * 46);
			}
		});
		cell(4, 'Focus', 'V-CURVE', (top) => {
			g.strokeStyle = 'rgba(111,214,255,0.7)';
			g.lineWidth = 3;
			g.beginPath();
			for (let i = 0; i <= 40; i++) { const x = 40 + i * 11, y = top + 20 + Math.abs(i - 20) * 9; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
			g.stroke();
			const i = 20 + Math.sin(time * 0.8) * 3;
			g.fillStyle = AMBER;
			g.beginPath(); g.arc(40 + i * 11, top + 20 + Math.abs(i - 20) * 9, 9, 0, Math.PI * 2); g.fill();
		});
		cell(5, 'Slit', 'HULL', (top) => {
			const cx = 256, cy = top + 150, r = 110;
			g.strokeStyle = ICE;
			g.lineWidth = 4;
			g.beginPath(); g.arc(cx, cy, r, Math.PI, Math.PI * 2); g.stroke();
			g.strokeStyle = GREEN;
			g.lineWidth = 10;
			g.beginPath(); g.arc(cx, cy, r, Math.PI * 1.72, Math.PI * 1.84); g.stroke();
			g.font = `600 30px ${COND}`;
			g.fillStyle = GREEN;
			g.fillText('OPEN', 36, top + 40);
		});
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// A soft shaft of light, brightest toward its source and its axis
function beamMaterial(color: string, k: number) {
	return new THREE.ShaderMaterial({
		uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: k } },
		vertexShader: /* glsl */ `varying vec2 vUv; varying float vFace;
			void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vec3 n = normalize(normalMatrix * normal);
			vFace = abs(dot(n, normalize(-mv.xyz))); gl_Position = projectionMatrix * mv; }`,
		fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uK; varying vec2 vUv; varying float vFace;
			void main() { float a = pow(vFace, 2.0) * mix(0.0, 0.1, vUv.y * vUv.y) * uK; gl_FragColor = vec4(uColor * a, 1.0); }`,
		transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
	});
}

// ---------- Geometry ----------

// An open arc of a cylinder about the axis (cx, cy), from angle a0 to a1 and z0 to z1, seen from inside.
// u follows the angle around a whole turn, v the hull's length, so pieces of one hull share one sheet.
function arc(r: number, a0: number, a1: number, z0: number, z1: number, seg: number, cx = 0, cy = 0) {
	const pos: number[] = [], uv: number[] = [], idx: number[] = [];
	for (let i = 0; i <= seg; i++) {
		const a = a0 + ((a1 - a0) * i) / seg;
		for (const z of [z0, z1]) {
			pos.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
			uv.push(a / (Math.PI * 2), (z - Z0) / (Z1 - Z0));
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

// A cylinder between two points, in whatever group it is put in
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, seg = 8) {
	const d = b.clone().sub(a);
	const g = new THREE.CylinderGeometry(r, r, d.length(), seg);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
	g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
	return new THREE.Mesh(g, m);
}

// The parts of something that moves as one become one mesh per material, so the telescope draws in a handful of
// calls however many parts it has. Only the group's own meshes merge; groups inside it keep moving on their own.
function mergeChildren(group: THREE.Object3D) {
	const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
	for (const o of [...group.children]) {
		if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || Array.isArray(o.material)) continue;
		o.updateMatrix();
		let g = o.geometry.clone().applyMatrix4(o.matrix);
		if (g.index) g = g.toNonIndexed();
		for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
		g.clearGroups();
		const list = byMaterial.get(o.material);
		if (list) list.push(g); else byMaterial.set(o.material, [g]);
		o.geometry.dispose();
		group.remove(o);
	}
	for (const [m, list] of byMaterial) {
		const g = mergeGeometries(list, false);
		if (g) group.add(new THREE.Mesh(g, m));
	}
}

// ---------- The great telescope ----------

// An open-truss reflector on a fork mount. The mount turns in azimuth on the pier; the tube tilts in altitude between
// the fork's arms. In the tube's own frame the optical axis is +X and the altitude axis is Z.
function greatTelescope(kit: Kit, m: { white: THREE.Material; whiteIn: THREE.Material; blue: THREE.Material; steel: THREE.Material; dark: THREE.Material; black: THREE.Material; mirror: THREE.Material; violet: THREE.Material; red: THREE.Material; green: THREE.Material }) {
	const { put, rbox } = kit;
	const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
	const alongX = (g: THREE.BufferGeometry) => g.rotateZ(Math.PI / 2);
	const alongZ = (g: THREE.BufferGeometry) => g.rotateX(Math.PI / 2);
	const mount = new THREE.Group();
	mount.userData.keep = true;
	// The turntable, the yoke across it, and the two arms of the fork
	put(new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.3, 64), m.blue), mount, 0, 0.7, 0);
	put(new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.04, 8, 96).rotateX(Math.PI / 2), m.steel), mount, 0, 0.85, 0);
	put(rbox(1.7, 0.45, 4.5, m.blue, 0.06), mount, 0, 1.07, 0);
	for (const s of [-1, 1]) {
		put(rbox(1.5, 2.0, 0.62, m.blue, 0.05), mount, 0, 1.85, s * 1.95);
		put(rbox(1.0, ALT_H + 0.7 - 2.85, 0.5, m.blue, 0.05), mount, 0, (2.85 + ALT_H + 0.7) / 2, s * 1.95);
		// The altitude bearings: a housing through the arm, a disc outside it with a lit ring
		put(new THREE.Mesh(alongZ(new THREE.CylinderGeometry(0.72, 0.72, 0.72, 40)), m.steel), mount, 0, ALT_H, s * 1.95);
		put(new THREE.Mesh(alongZ(new THREE.CylinderGeometry(1.05, 1.05, 0.08, 64)), m.dark), mount, 0, ALT_H, s * 2.32);
		put(new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.018, 6, 64), m.violet), mount, 0, ALT_H, s * 2.37);
		for (let k = 0; k < 10; k++) {
			const a = (k / 10) * Math.PI * 2;
			put(new THREE.Mesh(alongZ(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 8)), m.steel), mount, Math.cos(a) * 0.86, ALT_H + Math.sin(a) * 0.86, s * 2.38);
		}
		// Drive motors at the arm's foot, a cable wrap up its side
		put(rbox(0.5, 0.4, 0.4, m.dark, 0.04), mount, 0.9, 1.45, s * 1.95);
		put(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), m.green), mount, 1.16, 1.5, s * 1.95);
		const cable = new THREE.CatmullRomCurve3([V(0.6, 1.3, s * 1.55), V(0.75, 2.4, s * 1.6), V(0.62, 3.4, s * 1.62), V(0.4, ALT_H - 0.8, s * 1.6)]);
		put(new THREE.Mesh(new THREE.TubeGeometry(cable, 24, 0.06, 8, false), m.black), mount, 0, 0, 0);
	}

	const tube = put(new THREE.Group(), mount, 0, ALT_H, 0);
	// The centre section with its trunnions, and the mirror cell below it with the primary looking up the tube
	put(new THREE.Mesh(alongX(new THREE.CylinderGeometry(1.55, 1.55, 1.2, 64)), m.white), tube, 0, 0, 0);
	for (const s of [-1, 1]) put(new THREE.Mesh(alongZ(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 24)), m.steel), tube, 0, 0, s * 1.66);
	put(new THREE.Mesh(alongX(new THREE.CylinderGeometry(1.5, 1.5, 2.0, 64)), m.dark), tube, -1.6, 0, 0);
	for (const x of [-0.65, -2.55]) put(new THREE.Mesh(alongX(new THREE.TorusGeometry(1.5, 0.05, 8, 64).rotateX(Math.PI / 2)), m.steel), tube, x, 0, 0);
	put(new THREE.Mesh(new THREE.CircleGeometry(1.5, 64).rotateY(-Math.PI / 2), m.dark), tube, -2.6, 0, 0);
	put(new THREE.Mesh(new THREE.CircleGeometry(1.32, 64).rotateY(Math.PI / 2), m.mirror), tube, -0.58, 0, 0);
	put(new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.32, 0.32, 2.0, 24)), m.black), tube, 0.4, 0, 0);
	// The camera hung under the cell, its lamp lit
	put(rbox(0.8, 0.8, 0.8, m.dark, 0.05), tube, -2.95, 0, 0);
	put(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), m.green), tube, -2.95, 0.41, 0.25);
	// Counterweights on the cell, clear of the fork's arms
	for (const s of [-1, 1]) put(rbox(1.4, 0.3, 0.9, m.steel, 0.04), tube, -1.7, s * 1.62, 0);
	// The Serrurier truss: four V's of struts from the centre section to the top ring, and a ring halfway up
	const node = (x: number, r: number, a: number) => V(x, Math.cos(a) * r, Math.sin(a) * r);
	for (let i = 0; i < 4; i++) {
		const b = (i * Math.PI) / 2 + Math.PI / 4;
		for (const d of [-Math.PI / 4, Math.PI / 4]) put(strut(node(0.6, 1.42, b), node(6.0, 1.28, b + d), 0.055, m.white), tube);
	}
	put(new THREE.Mesh(alongX(new THREE.TorusGeometry(1.35, 0.05, 8, 64).rotateX(Math.PI / 2)), m.white), tube, 3.3, 0, 0);
	// The top ring, the spider across it and the secondary mirror's housing at its centre
	put(new THREE.Mesh(alongX(new THREE.CylinderGeometry(1.32, 1.32, 0.75, 64, 1, true)), m.whiteIn), tube, 6.35, 0, 0);
	for (const x of [5.98, 6.72]) put(new THREE.Mesh(alongX(new THREE.TorusGeometry(1.32, 0.05, 8, 64).rotateX(Math.PI / 2)), m.white), tube, x, 0, 0);
	for (let k = 0; k < 2; k++) {
		const vane = put(new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.6, 0.02), m.black), tube, 6.35, 0, 0);
		vane.rotation.x = (k * Math.PI) / 2;
	}
	put(new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.38, 0.38, 0.9, 24)), m.dark), tube, 6.1, 0, 0);
	put(new THREE.Mesh(new THREE.CircleGeometry(0.06, 12).rotateY(Math.PI / 2), m.red), tube, 6.56, 0.2, 0);
	// The finder, riding on the centre section
	put(new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 20)), m.white), tube, 1.6, 1.78, 0);
	put(new THREE.Mesh(alongX(new THREE.CylinderGeometry(0.19, 0.19, 0.4, 20)), m.black), tube, 2.75, 1.78, 0);
	for (const x of [0.9, 2.2]) put(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.12), m.steel), tube, x, 1.55, 0);
	mergeChildren(tube);
	mergeChildren(mount);
	return { mount, tube };
}

// ---------- The bay ----------

export function observatoryBay(content: ObservatoryContent) {
	return (kit: Kit): Interior => {
		const { world, mat, std, glow, add, put, box, rbox, rod, face } = kit;
		const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
		const steel = std({ color: '#4a515c', roughness: 0.4, metalness: 0.8 });
		const darkSteel = std({ color: '#1a1e25', roughness: 0.55, metalness: 0.6 });
		const panel = std({ color: '#0f1218', roughness: 0.75, metalness: 0.25 });
		const blue = std({ color: '#223e78', roughness: 0.45, metalness: 0.45 });
		const white = std({ color: '#d5d9df', roughness: 0.42, metalness: 0.2 });
		const whiteIn = std({ color: '#d5d9df', roughness: 0.42, metalness: 0.2, side: THREE.DoubleSide });
		const mirror = std({ color: '#c8d3e6', roughness: 0.04, metalness: 1, envMapIntensity: 1.6 });
		const red = glow(NIGHT, 1.5), redSoft = glow(NIGHT, 0.8), violet = glow(VIOLET, 1.5), violetSoft = glow(VIOLET, 0.7);
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();

		// ---------- Hull: the vault with its slit, ribs every four metres, the floor ----------
		const vault = vaultSheet();
		const hullMat = std({ map: vault, emissiveMap: vault, emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.85, metalness: 0.1, side: THREE.BackSide });
		add(arc(RH, SLIT.a1, SLIT.a0 + Math.PI * 2, Z0, Z1, 150), hullMat);
		add(arc(RH, SLIT.a0, SLIT.a1, Z0, SLIT.z0, 8), hullMat);
		add(arc(RH, SLIT.a0, SLIT.a1, SLIT.z1, Z1, 8), hullMat);
		for (let z = -11; z <= 17; z += 4) {
			const cut = z > SLIT.z0 - 0.2 && z < SLIT.z1 + 0.2;
			const rib = cut
				? new THREE.TorusGeometry(RH - 0.14, 0.15, 8, 110, Math.PI * 2 - (SLIT.a1 - SLIT.a0) - 0.04).rotateZ(SLIT.a1 + 0.02)
				: new THREE.TorusGeometry(RH - 0.14, 0.15, 8, 120);
			add(rib, darkSteel, 0, 0, z);
		}
		const floorTex = floorSheet();
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, Z1 - Z0), std({ map: floorTex, emissiveMap: floorTex, emissive: '#ffffff', emissiveIntensity: 0.7, roughness: 0.48, metalness: 0.3 }));
		floor.rotation.x = -Math.PI / 2;
		floor.position.set(0, FL, (Z0 + Z1) / 2);
		world.add(floor);

		// ---------- The slit: its frame, the shutters drawn back either side, a shaft of starlight through it ----------
		const rIn = RH - 0.06;
		for (const a of [SLIT.a0, SLIT.a1]) rod(V(Math.cos(a) * rIn, Math.sin(a) * rIn, SLIT.z0), V(Math.cos(a) * rIn, Math.sin(a) * rIn, SLIT.z1), 0.12, steel);
		for (const z of [SLIT.z0, SLIT.z1]) add(new THREE.TorusGeometry(rIn, 0.12, 8, 16, SLIT.a1 - SLIT.a0).rotateZ(SLIT.a0), steel, 0, 0, z);
		const shutterMat = std({ color: '#1d222b', roughness: 0.6, metalness: 0.5, side: THREE.BackSide });
		for (const [a0, a1] of [[SLIT.a0 - 0.4, SLIT.a0 - 0.02], [SLIT.a1 + 0.02, SLIT.a1 + 0.4]]) {
			add(arc(RH - 0.35, a0, a1, SLIT.z0 - 0.3, SLIT.z1 + 0.3, 16), shutterMat);
			for (let k = 0; k <= 4; k++) {
				const a = a0 + ((a1 - a0) * k) / 4;
				rod(V(Math.cos(a) * (RH - 0.4), Math.sin(a) * (RH - 0.4), SLIT.z0 - 0.3), V(Math.cos(a) * (RH - 0.4), Math.sin(a) * (RH - 0.4), SLIT.z1 + 0.3), 0.05, steel);
			}
		}
		// Red lamps along the slit's edges
		for (const a of [SLIT.a0, SLIT.a1]) for (let z = SLIT.z0 + 0.5; z < SLIT.z1; z += 1.5) add(new THREE.SphereGeometry(0.05, 8, 6), red, Math.cos(a) * (RH - 0.2), Math.sin(a) * (RH - 0.2), z);
		// Down through the open truss onto the primary mirror
		const shaftTop = SLIT.hit.clone().addScaledVector(SLIT.dir, -0.3), shaftFoot = SLIT.axis.clone().addScaledVector(SLIT.dir, -0.5);
		const shaftLen = shaftTop.distanceTo(shaftFoot);
		const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.25, shaftLen, 32, 1, true), beamMaterial('#9fb8ff', 0.9));
		shaft.position.copy(shaftTop).add(shaftFoot).multiplyScalar(0.5);
		shaft.quaternion.setFromUnitVectors(UP, SLIT.dir);
		world.add(shaft);

		// Stars across the vault that twinkle: points on the hull whose size breathes, each at its own pace
		const starPos: number[] = [], phase: number[] = [], speed: number[] = [], size: number[] = [], starCol: number[] = [];
		const srand = rng(97);
		for (let i = 0; i < 1400; i++) {
			const a = 0.12 + srand() * (Math.PI - 0.24), z = -12.5 + srand() * 31;
			if (a > SLIT.a0 - 0.45 && a < SLIT.a1 + 0.45 && z > SLIT.z0 - 0.5 && z < SLIT.z1 + 0.5) continue;
			const r = RH - 0.08;
			starPos.push(Math.cos(a) * r, Math.sin(a) * r, z);
			phase.push(srand() * Math.PI * 2);
			speed.push(0.6 + srand() * 2.2);
			size.push(0.5 + srand() * srand() * 1.6);
			col.set(srand() > 0.8 ? '#ffd9a8' : srand() > 0.6 ? '#bcd2ff' : '#ffffff');
			starCol.push(col.r, col.g, col.b);
		}
		const starGeo = new THREE.BufferGeometry();
		starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
		starGeo.setAttribute('color', new THREE.Float32BufferAttribute(starCol, 3));
		starGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
		starGeo.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speed, 1));
		starGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
		const twinkle = { value: 0 };
		const starMat = new THREE.PointsMaterial({ map: glowDot('rgba(255,255,255,1)', 'rgba(220,230,255,0.5)'), size: 0.16, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
		starMat.color.setScalar(1.7);
		starMat.onBeforeCompile = (shader) => {
			shader.uniforms.uTime = twinkle;
			shader.vertexShader = 'uniform float uTime;\nattribute float aPhase;\nattribute float aSpeed;\nattribute float aSize;\n' +
				shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size * aSize * (0.55 + 0.45 * sin(uTime * aSpeed + aPhase));');
		};
		world.add(new THREE.Points(starGeo, starMat));

		// ---------- The entrance: the hatch at the end of a tunnel of baffle rings, lit red for dark-adapted eyes ----------
		const bulkMat = std({ color: '#0d1015', roughness: 0.8, metalness: 0.2 });
		const { door, wheel } = kit.hatch({ z: Z0, y: HATCH_Y, radius: RH, material: bulkMat });
		add(arc(TUN.r + 0.02, TA, Math.PI - TA, Z0, TUN.z1, 48, 0, TUN.cy), std({ color: '#12151b', roughness: 0.7, metalness: 0.3, side: THREE.BackSide }));
		const baffle = std({ color: '#0b0d11', roughness: 0.6, metalness: 0.4, side: THREE.DoubleSide });
		let n = 0;
		for (let z = Z0 + 0.9; z < TUN.z1 - 0.2; z += 0.8, n++) {
			add(new THREE.RingGeometry(TUN.r - 0.42, TUN.r, 48, 1, TA, Math.PI - 2 * TA), baffle, 0, TUN.cy, z);
			add(new THREE.TorusGeometry(TUN.r - 0.42, 0.014, 6, 48, Math.PI - 2 * TA).rotateZ(TA), n % 2 ? violetSoft : redSoft, 0, TUN.cy, z);
		}
		for (const e of [-1, 1]) box(0.05, 0.03, TUN.z1 - Z0, red, e * (TW - 0.18), FL + 0.02, (Z0 + TUN.z1) / 2);
		// The mouth: a wall across the hull with the arch through it, its frame lit, the bay's name over it
		const mouth = new THREE.Shape().absarc(0, 0, RH, 0, Math.PI * 2, false);
		const hole = new THREE.Path();
		for (let i = 0; i <= 48; i++) {
			const a = TA + (i / 48) * (Math.PI - 2 * TA), x = Math.cos(a) * TUN.r, y = TUN.cy + Math.sin(a) * TUN.r;
			if (i) hole.lineTo(x, y); else hole.moveTo(x, y);
		}
		hole.closePath();
		mouth.holes.push(hole);
		add(new THREE.ShapeGeometry(mouth, 96), bulkMat, 0, 0, TUN.z1);
		add(new THREE.TorusGeometry(TUN.r + 0.14, 0.14, 10, 64, Math.PI - 2 * TA).rotateZ(TA), steel, 0, TUN.cy, TUN.z1 + 0.05);
		add(new THREE.TorusGeometry(TUN.r + 0.32, 0.025, 6, 64, Math.PI - 2 * TA).rotateZ(TA), violet, 0, TUN.cy, TUN.z1 + 0.04);
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: nameSign('THE OBSERVATORY', 'HABITAT BAY 2  ·  ML-1'), transparent: true, depthWrite: false }));
		sign.position.set(0, FL + 6.4, TUN.z1 + 0.03);
		world.add(sign);
		for (const e of [-1, 1]) add(new THREE.SphereGeometry(0.06, 10, 8), red, e * 3.6, FL + 2.6, TUN.z1 + 0.06);

		// ---------- The great telescope on its dais ----------
		TEL.steps.forEach((r, k) => {
			const top = FL + TEL.rise * (k + 1);
			add(new THREE.CylinderGeometry(r, r, top - FL, 96), k % 2 ? darkSteel : panel, TEL.x, (top + FL) / 2, TEL.z);
			add(new THREE.TorusGeometry(r - 0.04, 0.018, 6, 128).rotateX(Math.PI / 2), redSoft, TEL.x, top + 0.004, TEL.z);
		});
		add(new THREE.CylinderGeometry(TEL.pier, TEL.pier + 0.1, 0.55, 64), darkSteel, TEL.x, DAIS + 0.275, TEL.z);
		add(new THREE.TorusGeometry(TEL.pier, 0.05, 8, 96).rotateX(Math.PI / 2), steel, TEL.x, DAIS + 0.55, TEL.z);
		for (let k = 0; k < 28; k++) {
			const a = (k / 28) * Math.PI * 2;
			add(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), steel, TEL.x + Math.cos(a) * (TEL.pier - 0.15), DAIS + 0.58, TEL.z + Math.sin(a) * (TEL.pier - 0.15));
		}
		const scope = greatTelescope(kit, { white, whiteIn, blue, steel, dark: darkSteel, black: mat.plastic, mirror, violet, red, green: mat.green });
		scope.mount.position.set(TEL.x, DAIS, TEL.z);
		world.add(scope.mount);
		// A cool spot from high on the hull picks it out of the dark
		const spot = new THREE.SpotLight('#cfdcff', 150, 0, 0.42, 0.7, 2);
		spot.position.set(1.5, 10.5, -1.5);
		spot.target.position.set(TEL.x, DAIS + 3.4, TEL.z);
		world.add(spot, spot.target);
		// The maintenance catwalk ringing the tube, hung from the hull, a ladder down to the dais
		const cwY = CW.y, cw = CW;
		add(new THREE.RingGeometry(2.3, 3.0, 64).rotateX(-Math.PI / 2), std({ color: '#1b1f26', roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide }), cw.x, cwY, cw.z);
		for (const [r, y, t] of [[3.0, 1.05, 0.035], [3.0, 0.55, 0.02], [2.3, 1.05, 0.035], [3.0, 0.02, 0.05], [2.3, 0.02, 0.05]] as const) add(new THREE.TorusGeometry(r, t, 6, 96).rotateX(Math.PI / 2), steel, cw.x, cwY + y, cw.z);
		add(new THREE.TorusGeometry(3.02, 0.015, 6, 96).rotateX(Math.PI / 2), red, cw.x, cwY - 0.04, cw.z);
		for (let k = 0; k < 16; k++) {
			const a = (k / 16) * Math.PI * 2;
			for (const r of [2.3, 3.0]) rod(V(cw.x + Math.cos(a) * r, cwY, cw.z + Math.sin(a) * r), V(cw.x + Math.cos(a) * r, cwY + 1.05, cw.z + Math.sin(a) * r), 0.02, steel);
		}
		// Hung straight up to the hull
		for (let k = 0; k < 6; k++) {
			const a = (k / 6) * Math.PI * 2 + 0.3, x = cw.x + Math.cos(a) * 3.0, z = cw.z + Math.sin(a) * 3.0;
			rod(V(x, cwY + 1.05, z), V(x, Math.sqrt(RH * RH - x * x) - 0.1, z), 0.03, steel);
		}
		for (const dx of [-0.25, 0.25]) rod(V(LADDER.x + dx, DAIS, LADDER.z), V(LADDER.x + dx, cwY + 1.05, LADDER.z), 0.03, steel);
		for (let y = DAIS + 0.3; y < cwY; y += 0.3) rod(V(LADDER.x - 0.25, y, LADDER.z), V(LADDER.x + 0.25, y, LADDER.z), 0.015, steel);

		// ---------- The instrument gallery along the -X wall, its stair, and the spectrum frieze beneath ----------
		const mz = (MEZ.z0 + MEZ.z1) / 2, ml = MEZ.z1 - MEZ.z0, mx0 = -12.3;
		box(MEZ.x - mx0, MEZ.y - FL, ml, panel, (MEZ.x + mx0) / 2, (MEZ.y + FL) / 2, mz);
		const grating = (() => {
			const { cv, g } = canvas(128, 128);
			g.fillStyle = '#20252d'; g.fillRect(0, 0, 128, 128);
			g.fillStyle = '#0a0c10';
			for (let i = 4; i < 128; i += 16) for (let j = 4; j < 128; j += 16) g.fillRect(i, j, 10, 10);
			const t = tex(cv);
			t.wrapS = t.wrapT = THREE.RepeatWrapping;
			t.repeat.set(ml / 0.5, (MEZ.x - mx0) / 0.5);
			return t;
		})();
		box(MEZ.x - mx0, 0.04, ml, std({ map: grating, roughness: 0.5, metalness: 0.7 }), (MEZ.x + mx0) / 2, MEZ.y + 0.02, mz);
		box(0.03, 0.05, ml, red, MEZ.x + 0.02, MEZ.y - 0.16, mz);
		const frieze = new THREE.Mesh(new THREE.PlaneGeometry(ml - 1.2, 0.5), new THREE.MeshBasicMaterial({ map: tex(spectrumBand(4096, 128)), color: new THREE.Color(0.7, 0.7, 0.7) }));
		frieze.position.set(MEZ.x + 0.012, FL + 1.55, mz);
		frieze.rotation.y = Math.PI / 2;
		world.add(frieze);
		for (const y of [FL + 1.26, FL + 1.84]) box(0.04, 0.04, ml - 1.0, steel, MEZ.x + 0.02, y, mz);
		// The landing and the flight down toward the hall
		box(STAIR.x1 - STAIR.x0, MEZ.y - FL, STAIR.zt - STAIR.z0, panel, (STAIR.x0 + STAIR.x1) / 2, (MEZ.y + FL) / 2, (STAIR.z0 + STAIR.zt) / 2);
		const steps = 16, run = (STAIR.zb - STAIR.zt) / steps;
		for (let i = 0; i < steps; i++) {
			const top = MEZ.y - ((i + 1) * (MEZ.y - FL)) / (steps + 1), z = STAIR.zt + (i + 0.5) * run;
			box(STAIR.x1 - STAIR.x0, top - FL, run, i % 2 ? panel : darkSteel, (STAIR.x0 + STAIR.x1) / 2, (top + FL) / 2, z);
			box(STAIR.x1 - STAIR.x0 - 0.1, 0.02, 0.03, redSoft, (STAIR.x0 + STAIR.x1) / 2, top + 0.01, z + run / 2 - 0.03);
		}
		// Railings: along the gallery's edge (open at the landing), across its ends, and down the stair's open side
		const railTop = 1.05;
		const railRun = (a: THREE.Vector3, b: THREE.Vector3, every = 1.4) => {
			rod(a.clone().setY(a.y + railTop), b.clone().setY(b.y + railTop), 0.03, steel);
			rod(a.clone().setY(a.y + 0.55), b.clone().setY(b.y + 0.55), 0.018, steel);
			const n = Math.max(1, Math.round(a.distanceTo(b) / every));
			for (let k = 0; k <= n; k++) {
				const p = a.clone().lerp(b, k / n);
				rod(p, p.clone().setY(p.y + railTop), 0.025, steel);
			}
		};
		railRun(V(MEZ.x, MEZ.y, MEZ.z0), V(MEZ.x, MEZ.y, STAIR.z0));
		railRun(V(MEZ.x, MEZ.y, STAIR.zt), V(MEZ.x, MEZ.y, MEZ.z1));
		railRun(V(MEZ.x, MEZ.y, MEZ.z1), V(-11.6, MEZ.y, MEZ.z1));
		railRun(V(MEZ.x, MEZ.y, MEZ.z0), V(-11.6, MEZ.y, MEZ.z0));
		railRun(V(STAIR.x0, MEZ.y, STAIR.z0), V(STAIR.x1, MEZ.y, STAIR.z0));
		railRun(V(STAIR.x1, MEZ.y, STAIR.z0), V(STAIR.x1, MEZ.y, STAIR.zt));
		railRun(V(STAIR.x1, MEZ.y, STAIR.zt), V(STAIR.x1, FL, STAIR.zb), 1.2);
		// Racks of instruments, two displays on the wall, a desk and a stool between them
		const rackTex = rackSheet();
		const rackFace = std({ map: rackTex, emissiveMap: rackTex, emissive: '#ffffff', emissiveIntensity: 1.2, roughness: 0.5 });
		for (const z of [-11.2, -10.2, 3.2, 4.2]) {
			put(rbox(0.9, 2.1, 0.9, darkSteel, 0.03), world, -10.8, MEZ.y + 1.05, z);
			const f = add(new THREE.PlaneGeometry(0.8, 2.0), rackFace, -10.34, MEZ.y + 1.05, z);
			f.rotation.y = Math.PI / 2;
		}
		const sky = skyChartScreen(), spectro = spectrographScreen();
		for (const [l, z] of [[sky, -6.2], [spectro, -1.2]] as const) {
			const g = new THREE.Group();
			g.position.set(-11.15, MEZ.y + 1.95, z);
			g.rotation.y = Math.PI / 2;
			put(rbox(3.6, 2.4, 0.14, darkSteel, 0.04), g, 0, 0, -0.08);
			put(face(l.tex, 3.36, 2.1, true), g, 0, 0, 0.004);
			put(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.025, 0.025), violet), g, 0, -1.28, 0.02);
			world.add(g);
			kit.live(l, g, 1 / 8, 30, 2);
			put(rbox(0.8, 0.06, 1.6, darkSteel, 0.02), world, -10.3, MEZ.y + 0.76, z);
			box(0.6, 0.72, 0.08, steel, -10.3, MEZ.y + 0.37, z);
			add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20), mat.seat, -9.4, MEZ.y + 0.55, z);
			add(new THREE.CylinderGeometry(0.03, 0.03, 0.52, 8), steel, -9.4, MEZ.y + 0.26, z);
		}
		const galleryLight = new THREE.PointLight('#8fb0ff', 7, 11, 2);
		galleryLight.position.set(-8.6, MEZ.y + 2.8, -3.6);
		world.add(galleryLight);

		// ---------- The orrery: the planets on their orbits in a black disc in the floor ----------
		add(new THREE.CylinderGeometry(ORR.r + 0.25, ORR.r + 0.3, 0.3, 96), darkSteel, 0, FL + 0.15, ORR.z);
		add(new THREE.CircleGeometry(ORR.r + 0.1, 96).rotateX(-Math.PI / 2), std({ color: '#030409', roughness: 0.12, metalness: 0.6 }), 0, FL + 0.305, ORR.z);
		add(new THREE.TorusGeometry(ORR.r + 0.26, 0.03, 6, 128).rotateX(Math.PI / 2), violet, 0, FL + 0.3, ORR.z);
		const planets = [
			{ a: 0.7, r: 0.05, c: '#a79c8e' }, { a: 0.95, r: 0.08, c: '#e3c78f' }, { a: 1.22, r: 0.085, c: '#5f8fe0' }, { a: 1.5, r: 0.065, c: '#c9653b' },
			{ a: 1.95, r: 0.2, c: '#d8b48a' }, { a: 2.35, r: 0.17, c: '#e2cd96' }, { a: 2.65, r: 0.12, c: '#9fd8e6' }, { a: 2.9, r: 0.115, c: '#5a7de0' },
		].map((p, i) => ({ ...p, w: 0.5 * Math.pow(p.a, -1.5), off: i * 2.1 }));
		for (const p of planets) add(new THREE.TorusGeometry(p.a, 0.008, 4, 128).rotateX(Math.PI / 2), violetSoft, 0, FL + 0.31, ORR.z);
		const orbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffffff' }), planets.length);
		orbs.frustumCulled = false; // its bounds would be taken from where the planets first stood
		planets.forEach((p, i) => orbs.setColorAt(i, col.set(p.c).multiplyScalar(1.1)));
		world.add(orbs);
		const ringed = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.36, 40).rotateX(-Math.PI / 2 + 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color('#d9c18f').multiplyScalar(0.9), side: THREE.DoubleSide }));
		ringed.userData.keep = true;
		world.add(ringed);
		add(new THREE.SphereGeometry(0.3, 32, 20), glow('#ffcf7a', 2.4), 0, FL + 0.62, ORR.z);
		const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowDot('rgba(255,236,190,1)', 'rgba(255,190,90,0.35)'), blending: THREE.AdditiveBlending, depthWrite: false }));
		halo.position.set(0, FL + 0.62, ORR.z);
		halo.scale.setScalar(2.2);
		world.add(halo);
		const sunLight = new THREE.PointLight('#ffc27a', 9, 7, 2);
		sunLight.position.set(0, FL + 1.0, ORR.z);
		world.add(sunLight);

		// ---------- The console bank before the screen ----------
		const consoles = consoleSheet();
		const cq = new Quads();
		const deskSpots: { x: number; z: number; r: number }[] = [];
		for (const x of [-5.2, -2.6, 0, 2.6, 5.2]) {
			const z = CONS.z - 0.025 * x * x, r = -x * 0.035;
			deskSpots.push({ x, z, r });
			const desk = new THREE.Group();
			desk.position.set(x, FL, z);
			desk.rotation.y = r;
			world.add(desk);
			put(rbox(2.3, 0.07, 0.85, darkSteel, 0.02), desk, 0, 0.76, 0);
			put(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 0.55), panel), desk, 0, 0.36, 0.1);
			put(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.02, 0.02), red), desk, 0, 0.8, -0.43);
			// The screens' panel leans back, away from whoever sits at the desk
			// Kept low enough to see the foot of the main screen over
			const back = put(rbox(2.25, 0.42, 0.06, darkSteel, 0.02), desk, 0, 0.95, 0.36);
			back.rotation.x = 0.5;
			const deskM = M(x, FL, z, r);
			for (const [sx, cellI] of [[-0.55, deskSpots.length % 6], [0.55, (deskSpots.length + 2) % 6]] as const) {
				const c = cellI % CELL.cols, rr = Math.floor(cellI / CELL.cols);
				cq.add(deskM.clone().multiply(M(sx, 0.95, 0.3, Math.PI, -0.5)), 0.92, 0.33, [c / CELL.cols, 1 - (rr + 1) / CELL.rows, (c + 1) / CELL.cols, 1 - rr / CELL.rows]);
			}
		}
		world.add(cq.mesh(new THREE.MeshBasicMaterial({ map: consoles.tex, color: new THREE.Color(0.95, 0.95, 0.95) })));
		const consoleAt = put(new THREE.Object3D(), world, 0, FL + 1, CONS.z);
		kit.live(consoles, consoleAt, 1 / 4, 14, 6);
		// Chairs at the desks, facing the screen
		const chairGeo = mergeGeometries([
			new RoundedBoxGeometry(0.5, 0.08, 0.48, 2, 0.03).translate(0, 0.5, 0),
			new RoundedBoxGeometry(0.48, 0.55, 0.06, 2, 0.03).rotateX(0.12).translate(0, 0.82, -0.24),
			new THREE.CylinderGeometry(0.035, 0.035, 0.45, 8).translate(0, 0.25, 0),
			new THREE.CylinderGeometry(0.3, 0.3, 0.04, 5).translate(0, 0.03, 0),
		].map((g) => (g.index ? g.toNonIndexed() : g)));
		const chairs = new THREE.InstancedMesh(chairGeo, mat.seat, deskSpots.length);
		deskSpots.forEach((d, i) => chairs.setMatrixAt(i, m4.compose(V(d.x - Math.sin(d.r) * 0.95, FL, d.z - Math.cos(d.r) * 0.95), q.setFromAxisAngle(UP, d.r), one)));
		world.add(chairs);

		// ---------- The far bulkhead: the main screen, telemetry and the target list either side, all facing the tunnel ----------
		const far = add(new THREE.ShapeGeometry(new THREE.Shape().absarc(0, 0, RH, 0, Math.PI * 2, false), 96), bulkMat, 0, 0, Z1);
		far.rotation.y = Math.PI;
		// The story, one page at a time. Each page is drawn once onto its own texture and the screen shows one of them;
		// turning the page is a swap, not a redraw. The screen's own canvas holds a copy of the open page for reading
		// up close.
		const place = { code: 'VSL-03', name: 'The observatory' };
		let page = 0;
		const W = 2560, H = 1600;
		const shown = canvas(W, H);
		const copyPage = () => { shown.g.drawImage(pages[page].image as HTMLCanvasElement, 0, 0); };
		const pages: THREE.CanvasTexture[] = content.panels.map((p, i) => storyScreen(p, i, content.panels.length, i % 2 === 0, () => { if (i === page) copyPage(); kit.redraw(); }, place));
		copyPage();
		const screen = face(tex(shown.cv), SCREEN.w, SCREEN.h, false);
		const screenMat = screen.material as THREE.ShaderMaterial;
		screenMat.uniforms.uMap.value = pages[0];
		screen.position.set(0, SCREEN.y, SCREEN.z);
		screen.rotation.y = Math.PI;
		world.add(screen);
		// Every page is drawn on a speck hidden in the frame, so all of them are on the graphics card before the first turn
		for (const t of pages) add(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ map: t }), 0, SCREEN.y, Z1 - 0.12).rotation.y = Math.PI;
		put(rbox(SCREEN.w + 0.7, SCREEN.h + 0.7, 0.3, darkSteel, 0.08), world, 0, SCREEN.y, Z1 - 0.18);
		for (const [w, h, x, y] of [[SCREEN.w + 0.3, 0.05, 0, SCREEN.h / 2 + 0.16], [SCREEN.w + 0.3, 0.05, 0, -SCREEN.h / 2 - 0.16], [0.05, SCREEN.h + 0.3, SCREEN.w / 2 + 0.16, 0], [0.05, SCREEN.h + 0.3, -SCREEN.w / 2 - 0.16, 0]] as const) {
			box(w, h, 0.04, violet, x, SCREEN.y + y, SCREEN.z - 0.02);
		}
		// The bright line that sweeps down the glass as a page turns
		const sweepMat = new THREE.ShaderMaterial({
			uniforms: { uT: { value: 1 } },
			vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: /* glsl */ `uniform float uT; varying vec2 vUv;
				void main() { float edge = 1.0 - uT * 1.1; float line = exp(-abs(vUv.y - edge) * 140.0);
				float wake = smoothstep(edge, edge + 0.18, vUv.y) * (1.0 - smoothstep(edge + 0.18, edge + 0.4, vUv.y));
				vec3 c = vec3(0.55, 0.75, 1.0) * (line * 1.3 + wake * 0.08) * (1.0 - smoothstep(0.85, 1.0, uT));
				gl_FragColor = vec4(c, 1.0); }`,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
		});
		const sweep = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h), sweepMat);
		sweep.position.set(0, SCREEN.y, SCREEN.z - 0.02);
		sweep.rotation.y = Math.PI;
		sweep.visible = false;
		world.add(sweep);
		let sweepT = 1;
		const strip = pageStrip(content.panels);
		const stripMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 9 * (112 / 2048)), new THREE.MeshBasicMaterial({ map: strip.tex, color: new THREE.Color(0.95, 0.95, 0.95) }));
		stripMesh.position.set(0, SCREEN.y - SCREEN.h / 2 - 0.5, Z1 - 0.1);
		stripMesh.rotation.y = Math.PI;
		stripMesh.userData.keep = true;
		world.add(stripMesh);
		put(rbox(9.3, 0.7, 0.12, darkSteel, 0.03), world, 0, SCREEN.y - SCREEN.h / 2 - 0.5, Z1 - 0.02);
		function turn() {
			page = (page + 1) % pages.length;
			screenMat.uniforms.uMap.value = pages[page];
			copyPage();
			strip.set(page);
			sweepT = 0;
			sweep.visible = true;
		}
		// Telemetry and the target list in tall displays on the walls either side, turned toward the hall, on stands
		const tele = telemetryScreen(), cat = catalogueScreen(content.targets);
		for (const [l, e] of [[tele, 1], [cat, -1]] as const) {
			const g = new THREE.Group();
			g.position.set(e * SIDE.x, FL + 5.5, SIDE.z);
			g.rotation.y = Math.atan2(-e * 0.6, -0.8);
			put(rbox(2.1, 7.3, 0.2, darkSteel, 0.05), g, 0, 0, -0.1);
			put(face(l.tex, 1.8, 6.92, true), g, 0, 0, 0.004);
			for (const s of [-1, 1]) put(new THREE.Mesh(new THREE.BoxGeometry(0.025, 6.9, 0.025), violet), g, s * 1.0, 0, 0.02);
			put(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.9, 0.3), darkSteel), g, 0, -4.6, -0.1);
			put(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.8), steel), g, 0, -5.47, -0.1);
			world.add(g);
			kit.live(l, g, 1 / 6, 45, 3.6);
		}
		// A skirting along the foot of the bulkhead, lit along its top
		box(20, 0.45, 0.4, darkSteel, 0, FL + 0.225, Z1 - 0.2);
		box(19.6, 0.03, 0.03, red, 0, FL + 0.46, Z1 - 0.4);

		// ---------- Lights: dim and cool, the screen the brightest thing in the room ----------
		world.add(new THREE.HemisphereLight('#7f93c9', '#120d0a', 0.32));
		const screenLight = new THREE.PointLight('#a8c4ff', 70, 34, 2);
		screenLight.position.set(0, SCREEN.y - 1, Z1 - 3.5);
		world.add(screenLight);
		const tunnelLight = new THREE.PointLight('#ff3b2f', 5, 9, 2);
		tunnelLight.position.set(0, FL + 3.2, -16);
		world.add(tunnelLight);
		const mouthLight = new THREE.PointLight('#9a8cff', 6, 10, 2);
		mouthLight.position.set(0, FL + 4.5, TUN.z1 + 1.5);
		world.add(mouthLight);

		function update(dt: number, time: number) {
			const p = pointing(time);
			scope.mount.rotation.y = p.az;
			scope.tube.rotation.z = p.alt;
			twinkle.value = time;
			planets.forEach((pl, i) => {
				const a = pl.off + time * pl.w, x = Math.cos(a) * pl.a, z = ORR.z + Math.sin(a) * pl.a;
				orbs.setMatrixAt(i, m4.compose(V(x, FL + 0.31 + pl.r, z), q.identity(), V(pl.r, pl.r, pl.r)));
				if (i === 5) ringed.position.set(x, FL + 0.31 + pl.r, z);
			});
			orbs.instanceMatrix.needsUpdate = true;
			if (sweepT < 1) {
				sweepT = Math.min(1, sweepT + dt / 0.7);
				sweepMat.uniforms.uT.value = sweepT;
				if (sweepT >= 1) sweep.visible = false;
			}
		}
		update(0, 0);

		return {
			code: 'VSL-03',
			name: 'The observatory, habitat bay 2',
			scale: 1,
			eye: EYE,
			ground,
			spawn: V(0, 0, Z0 + 1.4),
			spawnYaw: Math.PI,
			collide,
			hatch: { z: Z0, y: HATCH_Y, door, wheel },
			revealAt: 40, // the main screen boots as soon as the pilot steps in
			exposure: 1.0,
			environment: 0.08,
			actions: [{
				x: 0, z: 3, reach: 17, look: V(0, SCREEN.y, SCREEN.z),
				label: () => (page < pages.length - 1 ? 'turn to the next page' : 'go back to the first page'),
				run: turn,
			}],
			update,
		};
	};
}

// ---------- Walking ----------

// The hall's floor, the gallery up its stair, and the dais's three steps
function ground(p: THREE.Vector3) {
	if (p.x < MEZ.x && p.z > MEZ.z0 && p.z < MEZ.z1) return MEZ.y;
	if (p.x >= STAIR.x0 && p.x <= STAIR.x1) {
		if (p.z >= STAIR.z0 && p.z <= STAIR.zt) return MEZ.y;
		if (p.z > STAIR.zt && p.z < STAIR.zb) return THREE.MathUtils.lerp(MEZ.y, FL, (p.z - STAIR.zt) / (STAIR.zb - STAIR.zt));
	}
	const d = Math.hypot(p.x - TEL.x, p.z - TEL.z);
	for (let k = TEL.steps.length - 1; k >= 0; k--) if (d < TEL.steps[k]) return FL + TEL.rise * (k + 1);
	return FL;
}

// The tunnel's walls and the wall across its mouth; the gallery's railings, open at the landing; the stair's side;
// the gallery's racks and desks; the consoles. The pier and the orrery are round.
const blocks = [
	{ x0: TW, x1: 13, z0: TUN.z1 - 0.15, z1: TUN.z1 + 0.15 },
	{ x0: -13, x1: -TW, z0: TUN.z1 - 0.15, z1: TUN.z1 + 0.15 },
	{ x0: MEZ.x - 0.06, x1: MEZ.x + 0.06, z0: MEZ.z0, z1: STAIR.z0 },
	{ x0: MEZ.x - 0.06, x1: MEZ.x + 0.06, z0: STAIR.zt, z1: MEZ.z1 },
	{ x0: -13, x1: MEZ.x, z0: MEZ.z0 - 0.06, z1: MEZ.z0 + 0.06 },
	{ x0: -13, x1: MEZ.x, z0: MEZ.z1 - 0.06, z1: MEZ.z1 + 0.06 },
	{ x0: STAIR.x1 - 0.06, x1: STAIR.x1 + 0.06, z0: STAIR.z0, z1: STAIR.zb },
	{ x0: STAIR.x0, x1: STAIR.x1, z0: STAIR.z0 - 0.06, z1: STAIR.z0 + 0.06 },
	{ x0: -13, x1: -10.3, z0: -11.7, z1: -9.7 },
	{ x0: -13, x1: -10.3, z0: 2.7, z1: 4.7 },
	...[-6.2, -1.2].map((z) => ({ x0: -13, x1: -9.8, z0: z - 0.85, z1: z + 0.85 })),
	{ x0: LADDER.x - 0.32, x1: LADDER.x + 0.32, z0: LADDER.z - 0.06, z1: LADDER.z + 0.06 },
	...[-1, 1].map((e) => ({ x0: e * SIDE.x - 0.6, x1: e * SIDE.x + 0.6, z0: SIDE.z - 0.5, z1: SIDE.z + 0.5 })),
	...[-5.2, -2.6, 0, 2.6, 5.2].map((x) => ({ x0: x - 1.2, x1: x + 1.2, z0: CONS.z - 0.025 * x * x - 0.45, z1: CONS.z - 0.025 * x * x + 0.55 })),
];
function collide(p: THREE.Vector3, radius: number) {
	p.z = THREE.MathUtils.clamp(p.z, Z0 + 0.3, Z1 - 0.9);
	const lim = p.z < TUN.z1 ? TW - 0.4 : HW - 0.5;
	p.x = THREE.MathUtils.clamp(p.x, -lim, lim);
	for (const c of [{ x: TEL.x, z: TEL.z, r: TEL.pier + 0.1 }, { x: 0, z: ORR.z, r: ORR.r + 0.3 }]) {
		const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), r = c.r + radius;
		if (d < r && d > 1e-4) { p.x = c.x + (dx / d) * r; p.z = c.z + (dz / d) * r; }
	}
	pushOut(p, blocks, radius);
}
