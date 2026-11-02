// The vessel's command module: the bridge of a large station, in a hull eighteen metres across. The hatch opens into
// a corridor whose walls carry the pilot's records at eye level; at its end a doorway leads onto the bridge's upper
// deck, and a wide stair runs down into the operations pit, where the captain's chair stands on a dais before a
// holographic table and two banks of consoles, and the pilot's station sits under a vaulted panoramic window.
// Galleries along both sides overlook the pit.
// Units are metres: +Z points to the window, +Y is up, and the hatch is at the corridor's far end, at -Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
	AMBER, ICE, DIM, CYAN, GREEN, RED, FONT, COND, DISPLAY,
	rng, canvas, tex, wrap, hazardSheet, signTexture, displayFrame, cornerTicks, storyScreen, liveCanvas, shell, pushOut, Quads, M,
	type Panel, type Live, type Kit, type Interior,
} from './interior';

export type CabinContent = {
	name: string;
	panels: Panel[]; // the wall displays, in the order they are met walking in
	worlds: { code: string; name: string; look: string; orbit: number }[];
	vesselOrbit: number;
};

const RH = 9; // hull radius; the hull's axis is y = 0
const U = -3.0, L = -4.6; // the upper deck and the floor of the pit
const Z0 = -14, Z_NOSE = 8.5, Z_TIP = 14, R_TIP = 5; // hatch bulkhead, where the window vault begins, its end
const HATCH_Y = U + 0.85;
const EYE = 1.62; // above whichever floor the pilot stands on
const PIT = 5; // half the pit's width; the galleries run outside it
const STAIR = { x: 2, z0: -9, z1: -6 }; // half its width, its top and its foot
const GAL_END = 6; // where the galleries end, over the forward floor
const WALL = 8.3; // the galleries' outer walls
const CAPT = { z: -2.4, r: 1.8 }; // the captain's dais
const HOLO = { z: 2.2, r: 1.4 }; // the holographic table
const CK = { z: 6.9, k: 1.3 }; // the pilot's station, drawn this much larger than its desk was modelled
// The corridor from the hatch to the bridge: half its width, its walls' height, its ceiling and the ceiling's half
// width (the upper corners are chamfered), and where the hatch is
const CORR = { w: 1.9, wall: 2.5, ceil: 3.2, top: 1.2, z0: -26 };
const RECORDS_Z = [-21.2, -17.0]; // the two pairs of records, facing each other across the corridor
const WIN = { a0: -0.32, a1: Math.PI + 0.32, panes: 9 }; // the window vault: the arc it covers, the panes around it

const LOOK_COLOR: Record<string, string> = { eris: '#e9eef2', mars: '#d9774f', saturn: '#e6c88e', neptune: '#5b86ff' };

// ---------- Surfaces ----------

// Wall plating in graphite: one tile of twenty by eight panels, a metre each, with seams, placards, vents and here and
// there a strip of light. The second canvas is its glow.
function wallSheet() {
	const W = 4096, H = 2048;
	const { cv, g } = canvas(W, H);
	const { cv: ecv, g: eg } = canvas(W, H);
	const rand = rng(17);
	g.fillStyle = '#23272e';
	g.fillRect(0, 0, W, H);
	eg.fillStyle = '#000';
	eg.fillRect(0, 0, W, H);
	const cols = 20, rows = 8, pw = W / cols, ph = H / rows;
	const labels = ['STOW A1', 'O2 SUPPLY', 'CO2 SCRUB', 'PANEL C4', 'H2O', 'MED KIT', 'FIRE PORT', 'DATA BUS', 'PWR 28V', 'NO STEP', 'COMM', 'SENSOR 7'];
	for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
		const x = i * pw, y = j * ph, k = (rand() - 0.5) * 10;
		g.fillStyle = `rgb(${54 + k},${59 + k},${68 + k})`;
		g.fillRect(x + 4, y + 4, pw - 8, ph - 8);
		g.strokeStyle = 'rgba(10,12,16,0.9)';
		g.lineWidth = 6;
		g.strokeRect(x + 3, y + 3, pw - 6, ph - 6);
		g.strokeStyle = 'rgba(160,175,195,0.18)';
		g.lineWidth = 2;
		g.strokeRect(x + 9, y + 9, pw - 18, ph - 18);
		g.fillStyle = 'rgba(14,16,20,0.9)';
		for (const [fx, fy] of [[14, 14], [pw - 20, 14], [14, ph - 20], [pw - 20, ph - 20]]) g.fillRect(x + fx, y + fy, 6, 6);
		const f = rand();
		if (f < 0.16) {
			const lx = x + 22, ly = y + 30 + rand() * (ph - 110);
			g.fillStyle = 'rgba(200,210,222,0.85)';
			g.fillRect(lx, ly, 120, 46);
			g.fillStyle = 'rgba(20,24,30,0.9)';
			g.font = `600 18px ${COND}`;
			g.fillText(labels[Math.floor(rand() * labels.length)], lx + 8, ly + 22);
			g.fillRect(lx + 8, ly + 30, 70 + rand() * 30, 3);
		} else if (f < 0.3) {
			for (let s = 0; s < 14; s++) { g.fillStyle = 'rgba(8,10,12,0.85)'; g.fillRect(x + 26, y + 34 + s * 11, pw - 52, 5); }
		} else if (f < 0.42) {
			// A strip of light along the panel
			const vertical = rand() < 0.5;
			eg.fillStyle = rand() < 0.75 ? '#6fd6ff' : '#f2b13b';
			if (vertical) eg.fillRect(x + pw - 26, y + 24, 6, ph - 48); else eg.fillRect(x + 24, y + ph - 26, pw - 48, 6);
		} else if (f < 0.5) {
			for (let n = 0; n < 4; n++) { eg.fillStyle = [GREEN, CYAN, AMBER][Math.floor(rand() * 3)]; eg.fillRect(x + 24 + n * 18, y + 24, 9, 9); }
		}
	}
	// Drawn at full size for the detail, then kept at half: a quarter of the memory for little visible loss
	const half = (src: HTMLCanvasElement) => {
		const { cv: h, g: hg } = canvas(W / 2, H / 2);
		hg.drawImage(src, 0, 0, W / 2, H / 2);
		const t = tex(h);
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		return t;
	};
	return { map: half(cv), glow: half(ecv) };
}

// The window vault's inner skin: graphite panels with the panes cut through, nine around and two deep.
// u runs around from +X through +Y, v from where the vault begins to its end.
function noseSheet() {
	const W = 4096, H = 1024;
	const { cv, g } = canvas(W, H);
	const { cv: acv, g: ag } = canvas(W, H);
	g.fillStyle = '#2c3139';
	g.fillRect(0, 0, W, H);
	ag.fillStyle = '#fff';
	ag.fillRect(0, 0, W, H);
	const span = (WIN.a1 - WIN.a0) / WIN.panes, pad = 0.006;
	for (let i = 0; i < WIN.panes; i++) for (const [v0, v1] of [[0.05, 0.48], [0.52, 0.95]]) {
		const u0 = (WIN.a0 + i * span) / (Math.PI * 2) + pad, u1 = (WIN.a0 + (i + 1) * span) / (Math.PI * 2) - pad;
		for (const off of [-1, 0, 1]) {
			const x0 = (u0 + off) * W, x1 = (u1 + off) * W, y0 = (1 - v1) * H, y1 = (1 - v0) * H;
			g.fillStyle = '#15181d';
			g.fillRect(x0 - 14, y0 - 14, x1 - x0 + 28, y1 - y0 + 28);
			ag.fillStyle = '#000';
			ag.beginPath(); ag.roundRect(x0, y0, x1 - x0, y1 - y0, 16); ag.fill();
		}
	}
	return { map: tex(cv), alpha: tex(acv, false) };
}

function floorSheet() {
	const W = 1024, H = 2048;
	const { cv, g } = canvas(W, H);
	const rand = rng(41);
	g.fillStyle = '#30343a';
	g.fillRect(0, 0, W, H);
	const tw = W / 6, th = H / 14;
	for (let i = 0; i < 6; i++) for (let j = 0; j < 14; j++) {
		const k = (rand() - 0.5) * 10;
		g.fillStyle = `rgb(${50 + k},${54 + k},${60 + k})`;
		g.fillRect(i * tw + 3, j * th + 3, tw - 6, th - 6);
		// Anti-slip tread
		g.fillStyle = 'rgba(90,96,104,0.35)';
		for (let s = 0; s < 220; s++) g.fillRect(i * tw + 6 + rand() * (tw - 12), j * th + 6 + rand() * (th - 12), 2, 2);
		g.fillStyle = 'rgba(24,26,30,0.9)';
		for (const [fx, fy] of [[8, 8], [tw - 12, 8], [8, th - 12], [tw - 12, th - 12]]) g.fillRect(i * tw + fx, j * th + fy, 4, 4);
	}
	const t = tex(cv);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	return t;
}

// The operations consoles' screens: twelve small displays on one sheet, redrawn together. Radar, power bars,
// carrier traces, a traffic plot, telemetry tables and gauges, each in the bridge's display style.
const OPS = { cols: 4, rows: 3, w: 512, h: 320 };
function opsScreens(): Live {
	const W = OPS.cols * OPS.w, H = OPS.rows * OPS.h;
	const { g, t, begin } = liveCanvas(W, H, 0.5);
	const titles = ['Sensors', 'Power', 'Comms', 'Traffic', 'Life support', 'Thermal', 'Structure', 'Docking', 'Guidance', 'Cargo', 'Reactor', 'Telemetry'];
	const rand = rng(7);
	const blips = Array.from({ length: 9 }, () => [rand() * Math.PI * 2, 0.2 + rand() * 0.75]);
	const draw = (time: number) => {
		begin();
		titles.forEach((title, i) => {
			const w = OPS.w, h = OPS.h, kind = i % 6;
			g.save();
			g.translate((i % OPS.cols) * w, Math.floor(i / OPS.cols) * h);
			g.beginPath(); g.rect(0, 0, w, h); g.clip();
			const { pad, top } = displayFrame(g, w, h, title, `CH ${String(i + 1).padStart(2, '0')}`, i % 3 ? CYAN : GREEN);
			const x0 = pad, y0 = top + 6, iw = w - pad * 2, ih = h - top - pad - 6;
			g.lineWidth = 2;
			if (kind === 0) {
				const cx = x0 + iw / 2, cy = y0 + ih / 2, r = ih / 2;
				g.strokeStyle = 'rgba(111,214,255,0.35)';
				for (const k of [1, 0.66, 0.33]) { g.beginPath(); g.arc(cx, cy, r * k, 0, Math.PI * 2); g.stroke(); }
				const a = time * 1.2;
				g.strokeStyle = CYAN;
				g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke();
				for (const [ba, br] of blips) {
					const age = ((a - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
					g.fillStyle = `rgba(242,177,59,${Math.max(0, 1 - age / 4)})`;
					g.fillRect(cx + Math.cos(ba) * br * r - 4, cy + Math.sin(ba) * br * r - 4, 8, 8);
				}
			} else if (kind === 1) {
				const n = 10, bw = iw / n;
				for (let k = 0; k < n; k++) {
					const v = 0.45 + 0.4 * Math.abs(Math.sin(time * (0.6 + k * 0.17) + k + i));
					g.fillStyle = v > 0.8 ? AMBER : i % 3 ? CYAN : GREEN;
					g.fillRect(x0 + k * bw + 4, y0 + ih * (1 - v), bw - 8, ih * v);
				}
			} else if (kind === 2) {
				for (const [k, c] of [[0, CYAN], [1, GREEN], [2, AMBER]] as const) {
					g.strokeStyle = c;
					g.beginPath();
					for (let x = 0; x <= iw; x += 6) {
						const yv = Math.sin(x * 0.04 * (k + 1) + time * (2 + k)) * 0.3 + Math.sin(x * 0.11 - time * 3) * 0.1;
						const py = y0 + ih * (0.2 + k * 0.3) + yv * ih * 0.25;
						if (x) g.lineTo(x0 + x, py); else g.moveTo(x0 + x, py);
					}
					g.stroke();
				}
			} else if (kind === 3) {
				g.strokeStyle = 'rgba(111,214,255,0.15)';
				for (let k = 1; k < 8; k++) { g.beginPath(); g.moveTo(x0 + (iw * k) / 8, y0); g.lineTo(x0 + (iw * k) / 8, y0 + ih); g.stroke(); }
				for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x0, y0 + (ih * k) / 5); g.lineTo(x0 + iw, y0 + (ih * k) / 5); g.stroke(); }
				for (let k = 0; k < 6; k++) {
					const u = ((time * (0.03 + k * 0.01) + k * 0.17) % 1), px = x0 + u * iw, py = y0 + ih * (0.15 + ((k * 0.37) % 0.7));
					g.fillStyle = k === 2 ? AMBER : ICE;
					g.beginPath(); g.moveTo(px + 8, py); g.lineTo(px - 6, py - 6); g.lineTo(px - 6, py + 6); g.closePath(); g.fill();
				}
			} else if (kind === 4) {
				g.font = `600 ${Math.round(ih / 7)}px ${COND}`;
				for (let k = 0; k < 6; k++) {
					const y = y0 + (ih / 6) * (k + 0.75);
					g.fillStyle = DIM;
					g.fillText(['PRESS', 'O2', 'CO2', 'HUMID', 'TEMP', 'FLOW'][k], x0, y);
					g.textAlign = 'right';
					g.fillStyle = k === 2 ? AMBER : ICE;
					g.fillText((100 * (0.4 + 0.5 * Math.abs(Math.sin(k * 1.7 + time * 0.3)))).toFixed(1), x0 + iw, y);
					g.textAlign = 'left';
				}
			} else {
				for (let k = 0; k < 3; k++) {
					const cx = x0 + (iw / 3) * (k + 0.5), cy = y0 + ih * 0.55, r = Math.min(iw / 7, ih * 0.38);
					const v = 0.55 + 0.35 * Math.sin(time * 0.5 + k * 2 + i);
					g.lineWidth = 8;
					g.strokeStyle = 'rgba(147,163,192,0.18)';
					g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
					g.strokeStyle = v > 0.82 ? AMBER : CYAN;
					g.beginPath(); g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * v)); g.stroke();
					g.lineWidth = 2;
				}
			}
			g.restore();
		});
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}
const opsUV = (i: number) => {
	const c = i % OPS.cols, r = Math.floor(i / OPS.cols) % OPS.rows;
	return [c / OPS.cols, 1 - (r + 1) / OPS.rows, (c + 1) / OPS.cols, 1 - r / OPS.rows];
};

// Mission elapsed time, from a launch long before the visit
const met = (time: number) => {
	const s = Math.floor(1_481_000 + time);
	const pad2 = (n: number) => String(n).padStart(2, '0');
	return `T+ ${String(Math.floor(s / 86400)).padStart(3, '0')}:${pad2(Math.floor(s / 3600) % 24)}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`;
};
const targetOf = (time: number, n: number) => Math.floor(time / 4) % n;

// The navigation display: the system in its orbital plane, a sweeping scan, the ship on its inclined orbit,
// a target lock that steps through the worlds, and their ranges and bearings
function navScreen(c: CabinContent): Live {
	const W = 1800, H = 1000;
	const { g, t, begin } = liveCanvas(W, H, 0.8);
	const worlds = [...c.worlds].sort((a, z) => a.orbit - z.orbit);
	const maxOrbit = Math.max(c.vesselOrbit, ...worlds.map((w) => w.orbit));
	const history: number[] = [];
	const draw = (time: number) => {
		begin();
		const { pad, top } = displayFrame(g, W, H, 'Navigation · Survey orbit', met(time), CYAN);
		const split = 1220;
		const cx = 640, cy = top + (H - top - pad) / 2 + 6, K = 0.42, RMAX = 540;
		const sc = (RMAX - 30) / maxOrbit;
		g.save();
		g.beginPath();
		g.rect(pad, top, split - pad - 20, H - top - pad);
		g.clip();
		// Scan sweep in the orbital plane
		const sweep = time * 0.7;
		g.save();
		g.translate(cx, cy);
		g.scale(1, K);
		if ('createConicGradient' in g) {
			const cg = g.createConicGradient(sweep - 0.7, 0, 0);
			cg.addColorStop(0, 'rgba(111,214,255,0)');
			cg.addColorStop(0.7 / (Math.PI * 2), 'rgba(111,214,255,0.3)');
			cg.addColorStop(0.7 / (Math.PI * 2) + 0.001, 'rgba(111,214,255,0)');
			g.fillStyle = cg;
			g.beginPath();
			g.arc(0, 0, RMAX, sweep - 0.7, sweep);
			g.lineTo(0, 0);
			g.fill();
		}
		g.restore();
		const at = (a: number, r: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r * K] as const;
		g.strokeStyle = 'rgba(111,214,255,0.7)';
		g.lineWidth = 2;
		g.beginPath(); g.moveTo(cx, cy); g.lineTo(...at(sweep, RMAX)); g.stroke();
		// Bearing ring with ticks
		g.strokeStyle = 'rgba(111,214,255,0.35)';
		g.beginPath(); g.ellipse(cx, cy, RMAX, RMAX * K, 0, 0, Math.PI * 2); g.stroke();
		g.font = `600 22px ${COND}`;
		g.fillStyle = 'rgba(147,163,192,0.8)';
		g.textAlign = 'center';
		for (let d = 0; d < 360; d += 10) {
			const a = (d * Math.PI) / 180, long = d % 30 === 0;
			const [x0, y0] = at(a, RMAX), [x1, y1] = at(a, RMAX + (long ? 18 : 9));
			g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
			if (long) { const [lx, ly] = at(a, RMAX + 40); g.fillText(String(d).padStart(3, '0'), lx, ly + 8); }
		}
		g.textAlign = 'left';
		// Orbits
		g.setLineDash([]);
		for (const w of worlds) {
			g.strokeStyle = 'rgba(140,190,255,0.28)';
			g.beginPath(); g.ellipse(cx, cy, w.orbit * sc, w.orbit * sc * K, 0, 0, Math.PI * 2); g.stroke();
		}
		// The star
		const sun = g.createRadialGradient(cx, cy, 0, cx, cy, 70);
		sun.addColorStop(0, 'rgba(255,246,226,1)');
		sun.addColorStop(0.18, 'rgba(255,214,150,0.8)');
		sun.addColorStop(1, 'rgba(242,177,59,0)');
		g.fillStyle = sun;
		g.fillRect(cx - 70, cy - 70, 140, 140);
		// Worlds, sized by kind, moving at their own pace
		const sel = targetOf(time, worlds.length);
		const placed = worlds.map((w, i) => {
			const a = 0.7 + i * 1.9 + time * 0.05 * Math.pow(maxOrbit / w.orbit, 1.5) * 0.35;
			const [x, y] = at(a, w.orbit * sc);
			const r = w.look === 'saturn' ? 15 : w.look === 'neptune' ? 13 : w.look === 'mars' ? 9 : 8;
			const col = LOOK_COLOR[w.look] ?? ICE;
			const shade = g.createRadialGradient(x - r * 0.4, y - r * 0.4, 0, x, y, r);
			shade.addColorStop(0, '#ffffff');
			shade.addColorStop(0.35, col);
			shade.addColorStop(1, 'rgba(10,20,40,1)');
			if (w.look === 'saturn') {
				g.strokeStyle = 'rgba(230,200,142,0.8)';
				g.lineWidth = 3;
				g.beginPath(); g.ellipse(x, y, r * 2, r * 0.6, -0.3, 0, Math.PI * 2); g.stroke();
			}
			g.fillStyle = shade;
			g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
			g.font = `600 26px ${COND}`;
			g.fillStyle = i === sel ? AMBER : CYAN;
			g.fillText(w.code, x + r + 12, y - 8);
			g.fillStyle = 'rgba(228,236,247,0.8)';
			g.font = `500 22px ${COND}`;
			g.fillText(w.name.toUpperCase(), x + r + 12, y + 16);
			return { x, y, r, w };
		});
		// The ship on its inclined orbit, with its trail
		const rs = c.vesselOrbit * sc, tilt = -0.32, ks = K * 1.5;
		const shipAt = (a: number) => {
			const ex = Math.cos(a) * rs, ey = Math.sin(a) * rs * ks;
			return [cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), cy + ex * Math.sin(tilt) + ey * Math.cos(tilt)] as const;
		};
		g.setLineDash([10, 10]);
		g.strokeStyle = 'rgba(242,177,59,0.5)';
		g.lineWidth = 2;
		g.beginPath();
		for (let k = 0; k <= 96; k++) { const [x, y] = shipAt((k / 96) * Math.PI * 2); if (k) g.lineTo(x, y); else g.moveTo(x, y); }
		g.stroke();
		g.setLineDash([]);
		const sa = 2.2 + time * 0.12;
		for (let k = 0; k < 40; k++) {
			const [x0, y0] = shipAt(sa - (k + 1) * 0.02), [x1, y1] = shipAt(sa - k * 0.02);
			g.strokeStyle = `rgba(242,177,59,${0.9 * (1 - k / 40)})`;
			g.lineWidth = 5 - k * 0.1;
			g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
		}
		const [sx, sy] = shipAt(sa), [nx, ny] = shipAt(sa + 0.02);
		const head = Math.atan2(ny - sy, nx - sx);
		const pulse = (time * 0.8) % 1;
		g.strokeStyle = `rgba(242,177,59,${1 - pulse})`;
		g.lineWidth = 2;
		g.beginPath(); g.arc(sx, sy, 12 + pulse * 34, 0, Math.PI * 2); g.stroke();
		g.save();
		g.translate(sx, sy);
		g.rotate(head);
		g.fillStyle = AMBER;
		g.beginPath(); g.moveTo(16, 0); g.lineTo(-10, -10); g.lineTo(-5, 0); g.lineTo(-10, 10); g.closePath(); g.fill();
		g.restore();
		g.font = `600 28px ${COND}`;
		g.fillStyle = AMBER;
		g.fillText('ML-1', sx + 22, sy + 34);
		// Target lock: brackets close in on the selected world, a line runs to it from the ship
		const tg = placed[sel];
		const lockIn = Math.min(1, (time % 4) * 2.2);
		const b = tg.r + 34 - lockIn * 18;
		g.setLineDash([6, 8]);
		g.strokeStyle = 'rgba(111,214,255,0.7)';
		g.beginPath(); g.moveTo(sx, sy); g.lineTo(tg.x, tg.y); g.stroke();
		g.setLineDash([]);
		cornerTicks(g, tg.x - b, tg.y - b, b * 2, b * 2, 12, AMBER);
		if (lockIn >= 1 && Math.floor(time * 3) % 2 === 0) {
			g.font = `600 22px ${COND}`;
			g.fillStyle = AMBER;
			g.fillText('TGT LOCK', tg.x - b, tg.y - b - 12);
		}
		g.restore();

		// Right column: the target list, then the ship's own state
		g.fillStyle = 'rgba(111,214,255,0.3)';
		g.fillRect(split, top, 2, H - top - pad);
		const x0 = split + 40, x1 = W - pad;
		let y = top + 30;
		g.font = `600 28px ${COND}`;
		g.fillStyle = DIM;
		g.fillText('TARGETS', x0, y);
		g.textAlign = 'right';
		g.fillText('RNG  /  BRG', x1, y);
		g.textAlign = 'left';
		y += 26;
		placed.forEach((p, i) => {
			const on = i === sel;
			if (on) {
				g.fillStyle = 'rgba(242,177,59,0.13)';
				g.fillRect(x0 - 16, y, x1 - x0 + 16, 84);
				g.fillStyle = AMBER;
				g.fillRect(x0 - 16, y, 5, 84);
			}
			const range = Math.hypot(p.x - sx, (p.y - sy) / K) / sc;
			const brg = ((Math.atan2((p.y - sy) / K, p.x - sx) * 180) / Math.PI + 360) % 360;
			g.font = `600 32px ${COND}`;
			g.fillStyle = on ? AMBER : CYAN;
			g.fillText(p.w.code, x0, y + 38);
			g.fillStyle = ICE;
			g.fillText(p.w.name.toUpperCase(), x0 + 92, y + 38);
			g.font = `500 26px ${COND}`;
			g.fillStyle = DIM;
			g.fillText(`${range.toFixed(2)} AU`, x0, y + 72);
			g.textAlign = 'right';
			g.fillText(`${brg.toFixed(1).padStart(5, '0')}°`, x1, y + 72);
			g.textAlign = 'left';
			y += 96;
		});
		y += 14;
		g.fillStyle = 'rgba(111,214,255,0.3)';
		g.fillRect(x0 - 16, y, x1 - x0 + 16, 2);
		y += 46;
		const vel = 7.42 + Math.sin(time * 0.9) * 0.03 + Math.sin(time * 3.1) * 0.006;
		history.push(vel);
		if (history.length > 60) history.shift();
		for (const [label, value] of [['VELOCITY', `${vel.toFixed(3)} KM/S`], ['ORBIT RADIUS', `${c.vesselOrbit.toFixed(1)} AU`], ['INCLINATION', '17.2°']]) {
			g.font = `600 26px ${COND}`;
			g.fillStyle = DIM;
			g.fillText(label, x0, y);
			g.textAlign = 'right';
			g.font = `600 30px ${COND}`;
			g.fillStyle = ICE;
			g.fillText(value, x1, y);
			g.textAlign = 'left';
			y += 44;
		}
		// Velocity trace
		const gy = y + 6, gh = H - pad - gy - 6;
		if (gh > 30) {
			g.strokeStyle = 'rgba(111,214,255,0.2)';
			g.strokeRect(x0, gy, x1 - x0, gh);
			g.strokeStyle = CYAN;
			g.lineWidth = 3;
			g.beginPath();
			history.forEach((v, i) => {
				const px = x0 + (i / 59) * (x1 - x0), py = gy + gh / 2 - ((v - 7.42) / 0.05) * (gh / 2);
				if (i) g.lineTo(px, py); else g.moveTo(px, py);
			});
			g.stroke();
		}
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// Ship systems: a reactor gauge, segmented status bars, and a live comms carrier trace
function systemsScreen(): Live {
	const W = 1200, H = 820;
	const { g, t, begin } = liveCanvas(W, H, 0.8);
	const rows = [['LIFE SUPPORT', 0.96], ['POWER BUS', 0.88], ['THERMAL', 0.74], ['COMMS', 0.92], ['PROPULSION', 0.61]] as const;
	const draw = (time: number) => {
		begin();
		const { pad, top } = displayFrame(g, W, H, 'Systems', 'All nominal', GREEN);
		// Reactor gauge
		const gx = pad + 170, gy = top + 190, gr = 150;
		const v = 0.972 + Math.sin(time * 1.3) * 0.006;
		g.lineCap = 'round';
		g.lineWidth = 18;
		g.strokeStyle = 'rgba(147,163,192,0.18)';
		g.beginPath(); g.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
		g.strokeStyle = CYAN;
		g.shadowColor = CYAN;
		g.shadowBlur = 18;
		g.beginPath(); g.arc(gx, gy, gr, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * v)); g.stroke();
		g.shadowBlur = 0;
		g.lineCap = 'butt';
		g.textAlign = 'center';
		g.font = `400 54px ${DISPLAY}`;
		g.fillStyle = ICE;
		g.fillText(`${(v * 100).toFixed(1)}`, gx, gy + 18);
		g.font = `600 28px ${COND}`;
		g.fillStyle = DIM;
		g.fillText('REACTOR OUTPUT %', gx, gy + 66);
		g.textAlign = 'left';
		// Status bars
		const bx = gx + gr + 80, bw = W - pad - bx - 90;
		rows.forEach(([name, base], i) => {
			const y = top + 40 + i * 74;
			const val = Math.min(1, base + Math.sin(time * (0.7 + i * 0.4) + i) * 0.015);
			g.font = `600 26px ${COND}`;
			g.fillStyle = DIM;
			g.fillText(name, bx, y);
			const segs = 24, sw = bw / segs;
			for (let s = 0; s < segs; s++) {
				g.fillStyle = s / segs < val ? (val > 0.7 ? GREEN : AMBER) : 'rgba(147,163,192,0.15)';
				g.fillRect(bx + s * sw, y + 10, sw - 4, 18);
			}
			g.font = `600 28px ${COND}`;
			g.fillStyle = ICE;
			g.fillText(`${Math.round(val * 100)}%`, bx + bw + 16, y + 28);
		});
		// Comms carrier
		const wy = top + 420, wh = H - pad - wy;
		g.fillStyle = 'rgba(111,214,255,0.05)';
		g.fillRect(pad, wy, W - pad * 2, wh);
		g.strokeStyle = 'rgba(111,214,255,0.18)';
		g.lineWidth = 1;
		for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(pad, wy + (wh * k) / 4); g.lineTo(W - pad, wy + (wh * k) / 4); g.stroke(); }
		g.font = `600 24px ${COND}`;
		g.fillStyle = DIM;
		g.fillText('COMMS CARRIER  ·  8.4 GHZ  ·  LINK SOLID', pad + 16, wy + 34);
		g.strokeStyle = CYAN;
		g.lineWidth = 3;
		g.shadowColor = CYAN;
		g.shadowBlur = 10;
		g.beginPath();
		for (let x = 0; x <= W - pad * 2; x += 4) {
			const u = x * 0.012;
			const yv = Math.sin(u * 2.6 + time * 4) * 0.45 + Math.sin(u * 7.3 - time * 6.5) * 0.2 + Math.sin(u * 17 + time * 11) * 0.08;
			const py = wy + wh * 0.58 + yv * wh * 0.32;
			if (x) g.lineTo(pad + x, py); else g.moveTo(pad + x, py);
		}
		g.stroke();
		g.shadowBlur = 0;
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// The greeting, and an index of the records on the walls
function commandScreen(c: CabinContent): Live {
	const W = 1200, H = 820;
	const { g, t, begin } = liveCanvas(W, H, 0.8);
	const draw = (time: number) => {
		begin();
		const { pad, top } = displayFrame(g, W, H, 'ML-1 · Command', 'Pilot on board', GREEN);
		g.font = `400 54px ${DISPLAY}`;
		g.fillStyle = '#ffffff';
		g.fillText('WELCOME ABOARD', pad, top + 70);
		g.fillStyle = AMBER;
		g.fillRect(pad, top + 96, 120, 5);
		g.font = `400 34px ${FONT}`;
		g.fillStyle = '#c9d4e3';
		let y = wrap(g, `This is ${c.name}’s command module. Its records line the corridor from the hatch.`, pad, top + 160, W - pad * 2, 46);
		y += 24;
		g.font = `600 26px ${COND}`;
		g.fillStyle = DIM;
		g.fillText('RECORDS ON BOARD', pad, y);
		y += 18;
		c.panels.forEach((p, i) => {
			y += 54;
			g.fillStyle = 'rgba(111,214,255,0.06)';
			g.fillRect(pad, y - 38, W - pad * 2, 48);
			g.font = `600 30px ${COND}`;
			g.fillStyle = AMBER;
			g.fillText(p.tag, pad + 14, y);
			g.fillStyle = ICE;
			g.fillText(p.title.toUpperCase(), pad + 74, y);
			g.textAlign = 'right';
			g.fillStyle = GREEN;
			g.fillText(i % 2 ? 'CORRIDOR · STARBOARD' : 'CORRIDOR · PORT', W - pad - 14, y);
			g.textAlign = 'left';
		});
		if (Math.floor(time * 2) % 2 === 0) {
			g.fillStyle = CYAN;
			g.fillRect(pad, y + 34, 22, 34);
		}
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// Head-up display symbology for the combiner glass: heading tape, pitch ladder, flight path marker
function hudSymbology(c: CabinContent): Live {
	const W = 1024, H = 640;
	const { g, t, begin } = liveCanvas(W, H, 0.75);
	const worlds = [...c.worlds].sort((a, z) => a.orbit - z.orbit);
	const col = 'rgba(140,255,215,0.95)';
	const draw = (time: number) => {
		begin();
		g.clearRect(0, 0, W, H);
		g.strokeStyle = col;
		g.fillStyle = col;
		g.lineWidth = 3;
		g.font = `600 26px ${COND}`;
		g.textAlign = 'center';
		// Heading tape
		const hdg = (127 + time * 1.5) % 360;
		g.beginPath(); g.moveTo(262, 70); g.lineTo(762, 70); g.stroke();
		for (let d = Math.floor((hdg - 26) / 5) * 5; d <= hdg + 26; d += 5) {
			const x = 512 + (d - hdg) * 9.6;
			const long = d % 10 === 0;
			g.beginPath(); g.moveTo(x, 70); g.lineTo(x, long ? 50 : 60); g.stroke();
			if (long) g.fillText(String(((d % 360) + 360) % 360).padStart(3, '0'), x, 40);
		}
		g.beginPath(); g.moveTo(512, 76); g.lineTo(500, 94); g.lineTo(524, 94); g.closePath(); g.fill();
		// Pitch ladder
		const pitch = Math.sin(time * 0.25) * 4, roll = Math.sin(time * 0.18) * 0.05;
		g.save();
		g.translate(512, 330);
		g.rotate(roll);
		for (const p of [-15, -10, -5, 5, 10, 15]) {
			const y = (p - pitch) * -13;
			if (Math.abs(y) > 200) continue;
			g.setLineDash(p < 0 ? [12, 8] : []);
			for (const s of [-1, 1]) {
				g.beginPath(); g.moveTo(s * 70, y); g.lineTo(s * 170, y); g.lineTo(s * 170, y + (p < 0 ? -12 : 12)); g.stroke();
				g.fillText(String(Math.abs(p)), s * 200, y + 9);
			}
		}
		g.setLineDash([]);
		const hy = pitch * 13;
		g.beginPath(); g.moveTo(-320, hy); g.lineTo(-60, hy); g.moveTo(60, hy); g.lineTo(320, hy); g.stroke();
		g.restore();
		// Flight path marker
		g.beginPath(); g.arc(512, 330, 15, 0, Math.PI * 2); g.stroke();
		g.beginPath(); g.moveTo(482, 330); g.lineTo(497, 330); g.moveTo(527, 330); g.lineTo(542, 330); g.moveTo(512, 315); g.lineTo(512, 302); g.stroke();
		// Speed and range boxes, the locked target
		g.textAlign = 'left';
		g.strokeRect(70, 300, 130, 56);
		g.strokeRect(824, 300, 130, 56);
		g.font = `600 34px ${COND}`;
		g.fillText((7.42 + Math.sin(time * 0.9) * 0.03).toFixed(2), 88, 340);
		g.fillText(`${(10.4 + Math.sin(time * 0.2) * 0.04).toFixed(2)}`, 842, 340);
		g.font = `600 22px ${COND}`;
		g.fillText('VEL KM/S', 70, 386);
		g.fillText('ORB AU', 824, 386);
		g.textAlign = 'center';
		const tg = worlds[targetOf(time, worlds.length)];
		g.font = `600 28px ${COND}`;
		g.fillText(`NAV LOCK  ${tg.code}  ${tg.name.toUpperCase()}`, 512, 590);
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// The desk's painted surface and its backlit legends, from the same cluster layout the switches sit on.
// The desk is DW wide and DD deep; local x runs to the pilot's left, z away from the pilot.
const DW = 2.2, DD = 0.5;
type Cluster = { x: number; w: number; label: string };
function deskSheets(clusters: Cluster[]) {
	const CW = 2816, CH = 640, s = CW / DW;
	const cx = (x: number) => (DW / 2 - x) * s, cz = (z: number) => (DD / 2 - z) * s;
	const { cv, g } = canvas(CW, CH);
	const { cv: gcv, g: gg } = canvas(CW, CH);
	const rand = rng(53);
	g.fillStyle = '#2a2e35';
	g.fillRect(0, 0, CW, CH);
	for (let n = 0; n < 9000; n++) {
		g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rand() * 0.03})`;
		g.fillRect(rand() * CW, rand() * CH, 2, 2);
	}
	gg.fillStyle = '#000';
	gg.fillRect(0, 0, CW, CH);
	for (const c of clusters) {
		const x0 = cx(c.x + c.w / 2), x1 = cx(c.x - c.w / 2), y0 = cz(0.18), y1 = cz(-0.18);
		g.fillStyle = '#1b1e23';
		g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 14); g.fill();
		g.strokeStyle = 'rgba(210,220,235,0.22)';
		g.lineWidth = 3;
		g.stroke();
		g.fillStyle = '#5a606a';
		for (const [fx, fy] of [[x0 + 16, y0 + 16], [x1 - 16, y0 + 16], [x0 + 16, y1 - 16], [x1 - 16, y1 - 16]]) { g.beginPath(); g.arc(fx, fy, 6, 0, Math.PI * 2); g.fill(); }
		gg.font = `600 30px ${COND}`;
		gg.fillStyle = '#e8f6ff';
		gg.textAlign = 'center';
		gg.fillText(c.label, (x0 + x1) / 2, y0 + 40);
		gg.fillStyle = 'rgba(232,246,255,0.5)';
		gg.fillRect((x0 + x1) / 2 - 80, y0 + 52, 160, 2);
	}
	return { map: tex(cv), glow: tex(gcv) };
}

// A row of annunciator tiles along the desk's far edge, a few of them lit
function annunciatorSheet() {
	const CW = 2816, CH = 72;
	const { cv, g } = canvas(CW, CH);
	const cells = [['MASTER CAUTION', AMBER], ['O2 FLOW', GREEN], ['PWR BUS A', GREEN], ['PWR BUS B', GREEN], ['CABIN P', ''], ['COMM LINK', GREEN], ['NAV LOCK', CYAN], ['RCS ARM', ''], ['THERMAL', AMBER], ['DOCK RDY', ''], ['GUIDANCE', GREEN], ['FUEL XFER', '']];
	g.fillStyle = '#0b0d10';
	g.fillRect(0, 0, CW, CH);
	const cw = CW / cells.length;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.font = `600 30px ${COND}`;
	cells.forEach(([label, col], i) => {
		const x = i * cw;
		g.fillStyle = col ? col : '#1d2127';
		g.globalAlpha = col ? 0.9 : 1;
		g.fillRect(x + 6, 6, cw - 12, CH - 12);
		g.globalAlpha = 1;
		g.fillStyle = col ? '#101215' : '#4a5260';
		g.fillText(label, x + cw / 2, CH / 2 + 2);
	});
	return tex(cv);
}

function segmentSheet(text: string) {
	const { cv, g } = canvas(512, 112);
	g.fillStyle = '#080604';
	g.fillRect(0, 0, 512, 112);
	g.font = `600 84px ${COND}`;
	g.textAlign = 'right';
	g.textBaseline = 'middle';
	g.fillStyle = 'rgba(242,177,59,0.12)';
	g.fillText('8888.8', 490, 60);
	g.fillStyle = AMBER;
	g.fillText(text, 490, 60);
	return tex(cv);
}

// An overhead panel of painted switch banks with lit legends
function overheadSheet() {
	const CW = 1536, CH = 800;
	const { cv, g } = canvas(CW, CH);
	const rand = rng(61);
	g.fillStyle = '#23272d';
	g.fillRect(0, 0, CW, CH);
	const groups = ['CABIN LIGHTS', 'ENV CONTROL', 'DOCKING', 'EMERGENCY'];
	groups.forEach((label, i) => {
		const x = 40 + (i % 2) * 740, y = 40 + Math.floor(i / 2) * 380;
		g.strokeStyle = 'rgba(210,220,235,0.25)';
		g.lineWidth = 3;
		g.strokeRect(x, y, 716, 340);
		g.font = `600 34px ${COND}`;
		g.fillStyle = '#dfeaf5';
		g.fillText(label, x + 24, y + 48);
		for (let k = 0; k < 7; k++) for (let r = 0; r < 2; r++) {
			const bx = x + 34 + k * 96, by = y + 90 + r * 120;
			const lit = rand();
			g.fillStyle = '#121418';
			g.fillRect(bx, by, 64, 84);
			g.fillStyle = label === 'EMERGENCY' && k < 2 ? RED : lit < 0.3 ? AMBER : lit < 0.55 ? GREEN : '#3b414a';
			g.fillRect(bx + 10, by + 10, 44, 44);
			g.fillStyle = 'rgba(223,234,245,0.6)';
			g.fillRect(bx + 10, by + 66, 44, 4);
		}
	});
	return tex(cv);
}

// ---------- The module ----------

export function commandModule(content: CabinContent) {
	return (kit: Kit): Interior => {
		const { world, mat, std, glow, add, put, box, rbox, rod, face, loader } = kit;
		const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
		// Metal here takes only part of the engine's bright studio environment, or the pit's floor-level work reads white
		const graphite = std({ color: '#2b3038', roughness: 0.55, metalness: 0.6, envMapIntensity: 0.45 });
		const frameMat = std({ color: '#454c57', roughness: 0.35, metalness: 0.85, envMapIntensity: 0.6 });
		const wall = wallSheet();
		const wallMat = std({ map: wall.map, emissiveMap: wall.glow, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.55, metalness: 0.35 });
		const deckTex = floorSheet();
		const deckMat = std({ map: deckTex, roughness: 0.72, metalness: 0.3 });
		// Repeating surfaces take their texture once every so many metres
		const tile = <G extends THREE.BufferGeometry>(g: G, sx: number, sy: number) => {
			const uv = g.attributes.uv;
			for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
			return g;
		};
		const deck = (x0: number, x1: number, z0: number, z1: number, y: number) =>
			add(tile(new THREE.PlaneGeometry(x1 - x0, z1 - z0), (x1 - x0) / 3, (z1 - z0) / 7).rotateX(-Math.PI / 2), deckMat, (x0 + x1) / 2, y, (z0 + z1) / 2);
		const screens = new Quads(); // every console screen, from the operations sheet, in one draw
		const ops = opsScreens();

		// ---------- Hull: the plated barrel, its ribs with rings of light, the hatch bulkhead ----------
		add(tile(shell(RH, RH, Z0, Z_NOSE, 160), (Math.PI * 2 * RH) / 20, (Z_NOSE - Z0) / 8), std({ map: wall.map, emissiveMap: wall.glow, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.55, metalness: 0.35, side: THREE.BackSide }));
		// Ribs arch over from the top of the gallery walls, clear of the decks
		for (let z = -12; z <= 6; z += 3) for (const [r, t, m] of [[RH - 0.2, 0.2, frameMat], [RH - 0.44, 0.03, mat.cool]] as const) {
			const a = Math.asin((U + 4.4) / r);
			add(new THREE.TorusGeometry(r, t, 10, 128, Math.PI - 2 * a).rotateZ(a), m, 0, 0, z);
		}
		const profile = [[-CORR.w, 0], [CORR.w, 0], [CORR.w, CORR.wall], [CORR.top, CORR.ceil], [-CORR.top, CORR.ceil], [-CORR.w, CORR.wall]].map(([x, y]) => new THREE.Vector2(x, U + y));
		const aft = new THREE.Shape().absarc(0, 0, RH, 0, Math.PI * 2, false);
		aft.holes.push(new THREE.Path([...profile].reverse()));
		add(tile(new THREE.ShapeGeometry(aft, 96), 1 / 20, 1 / 8), wallMat, 0, 0, Z0);

		// ---------- The corridor: plated walls under chamfered corners, frames of light, the records at eye level ----------
		const cl = Z0 - CORR.z0, cz = (CORR.z0 + Z0) / 2;
		const chamfer = Math.hypot(CORR.w - CORR.top, CORR.ceil - CORR.wall);
		deck(-CORR.w, CORR.w, CORR.z0, Z0, U);
		for (const e of [-1, 1]) {
			const w2 = add(tile(new THREE.PlaneGeometry(cl, CORR.wall), cl / 20, CORR.wall / 8), wallMat, e * CORR.w, U + CORR.wall / 2, cz);
			w2.rotation.y = -e * Math.PI / 2;
			box(0.05, chamfer, cl, graphite, e * (CORR.w + CORR.top) / 2, U + (CORR.wall + CORR.ceil) / 2, cz).rotation.z = e * Math.PI / 4;
			box(0.03, 0.03, cl, mat.led, e * (CORR.w - 0.02), U + 0.22, cz);
			box(0.03, 0.03, cl, mat.cool, e * (CORR.w - 0.03), U + CORR.wall - 0.02, cz);
		}
		box(CORR.top * 2, 0.05, cl, graphite, 0, U + CORR.ceil + 0.025, cz);
		box(0.4, 0.02, cl - 0.6, glow('#e8f0ff', 1.05), 0, U + CORR.ceil - 0.01, cz); // soft enough not to dazzle at this height
		box(0.05, 0.006, cl - 1.6, mat.ledSoft, 0, U + 0.004, cz + 0.4);
		// Frames across it between the pairs of records, and a lit portal at the doorway
		const frameAt = (z: number, k: number, light: THREE.Material) => {
			for (const e of [-1, 1]) {
				box(0.16 * k, CORR.wall, 0.3 * k, frameMat, e * (CORR.w - 0.08 * k), U + CORR.wall / 2, z);
				box(0.02, CORR.wall - 0.3, 0.04, light, e * (CORR.w - 0.17 * k), U + CORR.wall / 2, z);
				box(0.16 * k, chamfer + 0.1, 0.3 * k, frameMat, e * ((CORR.w + CORR.top) / 2 - 0.06), U + (CORR.wall + CORR.ceil) / 2 - 0.06, z).rotation.z = e * Math.PI / 4;
			}
			box(CORR.top * 2 + 0.2, 0.16 * k, 0.3 * k, frameMat, 0, U + CORR.ceil - 0.08 * k, z);
			box(CORR.top * 2 - 0.1, 0.02, 0.04, light, 0, U + CORR.ceil - 0.17 * k, z);
		};
		for (const z of [CORR.z0 + 2, (RECORDS_Z[0] + RECORDS_Z[1]) / 2]) frameAt(z, 1, mat.cool);
		frameAt(Z0 - 0.2, 1.5, mat.led);
		const doorSign = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: signTexture('COMMAND DECK', CYAN), color: new THREE.Color(1.2, 1.2, 1.2) }));
		doorSign.position.set(0, U + 2.72, Z0 - 0.45);
		doorSign.rotation.y = Math.PI;
		world.add(doorSign);
		// The records, in facing pairs: the first of each on the pilot's left (+X, port), the second across from it.
		// They are lit from the start and hang at eye level, close enough to read in passing.
		const RW = 2.4, RHt = 1.5;
		content.panels.slice(0, 4).forEach((p, i) => {
			const e = i % 2 ? -1 : 1, z = RECORDS_Z[Math.floor(i / 2) % 2];
			const group = put(new THREE.Group(), world, e * (CORR.w - 0.08), U + 1.62, z);
			group.rotation.y = -e * (Math.PI / 2);
			put(rbox(RW + 0.14, RHt + 0.14, 0.08, frameMat, 0.03), group, 0, 0, -0.045);
			put(rbox(RW + 0.03, RHt + 0.03, 0.014, mat.plastic, 0.005), group, 0, 0, -0.005);
			put(face(storyScreen(p, i, content.panels.length, e > 0, kit.redraw), RW, RHt, true), group, 0, 0, 0.003);
			put(new THREE.Mesh(new THREE.BoxGeometry(RW - 0.3, 0.012, 0.012), mat.led), group, 0, -RHt / 2 - 0.09, 0.006);
		});
		// The hatch at the corridor's end, an extinguisher by it
		const { door, wheel } = kit.hatch({ z: CORR.z0, y: HATCH_Y, radius: RH, material: wallMat });
		add(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 20), mat.red, -(CORR.w - 0.15), U + 0.95, CORR.z0 + 0.5);
		add(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 12), mat.dark, -(CORR.w - 0.15), U + 1.25, CORR.z0 + 0.5);

		// ---------- The window vault: panes nine around and two deep between mullions, a round window at its end ----------
		const nose = noseSheet();
		add(shell(RH, R_TIP, Z_NOSE, Z_TIP, 160), std({ map: nose.map, alphaMap: nose.alpha, alphaTest: 0.5, roughness: 0.5, metalness: 0.5, side: THREE.BackSide }));
		for (let k = 0; k <= WIN.panes; k++) {
			const a = WIN.a0 + (k / WIN.panes) * (WIN.a1 - WIN.a0);
			rod(V(Math.cos(a) * (RH - 0.12), Math.sin(a) * (RH - 0.12), Z_NOSE), V(Math.cos(a) * (R_TIP - 0.12), Math.sin(a) * (R_TIP - 0.12), Z_TIP), 0.1, frameMat);
		}
		for (const v of [0, 0.5, 1]) {
			const r = RH + v * (R_TIP - RH) - 0.12;
			add(new THREE.TorusGeometry(r, 0.1, 8, 96, WIN.a1 - WIN.a0).rotateZ(WIN.a0), frameMat, 0, 0, Z_NOSE + v * (Z_TIP - Z_NOSE));
		}
		add(new THREE.TorusGeometry(R_TIP - 0.12, 0.12, 8, 96), frameMat, 0, 0, Z_TIP);
		add(new THREE.TorusGeometry(1.8, 0.1, 8, 64), frameMat, 0, 0, Z_TIP);
		for (let k = 0; k < 10; k++) {
			const a = (k / 10) * Math.PI * 2;
			rod(V(Math.cos(a) * 1.8, Math.sin(a) * 1.8, Z_TIP), V(Math.cos(a) * (R_TIP - 0.12), Math.sin(a) * (R_TIP - 0.12), Z_TIP), 0.07, frameMat);
		}
		add(new THREE.CircleGeometry(R_TIP, 64), mat.glass, 0, 0, Z_TIP).rotation.y = Math.PI;

		// ---------- Floors: the upper deck (vestibule, landings, galleries), the stair, the pit ----------
		deck(-8.6, 8.6, Z0, STAIR.z0, U);
		for (const e of [-1, 1]) {
			const [a, b] = e > 0 ? [STAIR.x, 8.6] : [-8.6, -STAIR.x];
			deck(a, b, STAIR.z0, STAIR.z1, U);
			const [c, d] = e > 0 ? [PIT, 8.6] : [-8.6, -PIT];
			deck(c, d, STAIR.z1, GAL_END, U);
		}
		deck(-7.9, 7.9, STAIR.z1, 9.8, L);
		const steps = 8, rise = (U - L) / steps, run = (STAIR.z1 - STAIR.z0) / steps;
		for (let k = 0; k < steps; k++) {
			const top = U - (k + 1) * rise, z0 = STAIR.z0 + k * run;
			box(STAIR.x * 2, top - L, run, graphite, 0, (top + L) / 2, z0 + run / 2);
			box(STAIR.x * 2 - 0.2, 0.02, 0.06, mat.led, 0, top + 0.01, z0 + 0.05);
		}
		// The faces between the levels: the pit's sides, the landings' edges, the stair's sides, the galleries' ends
		for (const e of [-1, 1]) {
			box(0.25, U - L, GAL_END - STAIR.z1, graphite, e * (PIT + 0.125), (U + L) / 2, (STAIR.z1 + GAL_END) / 2);
			box(PIT - STAIR.x, U - L, 0.25, graphite, e * (STAIR.x + PIT) / 2, (U + L) / 2, STAIR.z1 + 0.125);
			box(0.15, U - L, STAIR.z1 - STAIR.z0, graphite, e * (STAIR.x + 0.075), (U + L) / 2, (STAIR.z0 + STAIR.z1) / 2);
			box(3.6, U - L, 0.25, graphite, e * (PIT + 1.8), (U + L) / 2, GAL_END + 0.125);
			// Light along the pit's walls, low and at the deck's lip, with fins between
			box(0.02, 0.03, GAL_END - STAIR.z1, mat.led, e * (PIT - 0.01), L + 0.15, (STAIR.z1 + GAL_END) / 2);
			box(0.02, 0.03, GAL_END - STAIR.z1, mat.cool, e * (PIT - 0.01), U - 0.08, (STAIR.z1 + GAL_END) / 2);
			for (let z = STAIR.z1 + 1; z < GAL_END; z += 2) box(0.03, U - L - 0.4, 0.06, mat.ledSoft, e * (PIT - 0.01), (U + L) / 2, z);
		}

		// ---------- Railings: posts and a rail with a line of light under it, glass between ----------
		const glassGeos: THREE.BufferGeometry[] = [];
		const railing = (a: THREE.Vector3, b: THREE.Vector3) => {
			const len = a.distanceTo(b), ang = Math.atan2(-(b.z - a.z), b.x - a.x), n = Math.max(1, Math.round(len / 1.4));
			for (let k = 0; k <= n; k++) {
				const p = a.clone().lerp(b, k / n);
				rod(p, p.clone().setY(p.y + 1.05), 0.03, frameMat);
			}
			rod(a.clone().setY(a.y + 1.05), b.clone().setY(b.y + 1.05), 0.035, frameMat);
			add(new THREE.BoxGeometry(len, 0.015, 0.02).rotateY(ang), mat.led, (a.x + b.x) / 2, a.y + 1.0, (a.z + b.z) / 2);
			glassGeos.push(new THREE.BoxGeometry(len, 0.9, 0.02).rotateY(ang).translate((a.x + b.x) / 2, a.y + 0.5, (a.z + b.z) / 2));
		};
		for (const e of [-1, 1]) {
			railing(V(e * PIT, U, STAIR.z1), V(e * PIT, U, GAL_END));
			railing(V(e * STAIR.x, U, STAIR.z1), V(e * PIT, U, STAIR.z1));
			railing(V(e * STAIR.x, U, STAIR.z0), V(e * STAIR.x, U, STAIR.z1));
			railing(V(e * PIT, U, GAL_END), V(e * 8.4, U, GAL_END));
		}
		world.add(new THREE.Mesh(mergeGeometries(glassGeos), new THREE.MeshStandardMaterial({ color: '#8fc8ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.12, depthWrite: false })));

		// ---------- The vestibule: lockers, a hazard band at the hatch, the portal onto the bridge ----------
		for (const e of [-1, 1]) {
			for (let z = Z0 + 0.6; z < STAIR.z0 - 0.6; z += 0.62) {
				box(0.6, 2.1, 0.58, mat.locker, e * 8.0, U + 1.05, z + 0.31);
				box(0.03, 0.06, 0.24, mat.gunmetal, e * 7.69, U + 1.1, z + 0.31);
			}
			box(0.02, 0.02, STAIR.z0 - Z0 - 1.2, mat.cool, e * 7.69, U + 2.18, (Z0 + STAIR.z0) / 2);
		}
		const band = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.24), new THREE.MeshStandardMaterial({ map: hazardSheet(1024, 72, 36), roughness: 0.7 }));
		band.rotation.x = -Math.PI / 2;
		band.position.set(0, U + 0.003, CORR.z0 + 1.0);
		world.add(band);
		const pz = STAIR.z0 - 0.3, ph = 5.2;
		for (const e of [-1, 1]) {
			box(0.6, ph, 0.7, frameMat, e * 7.5, U + ph / 2, pz);
			box(0.03, ph - 0.4, 0.03, mat.led, e * 7.18, U + ph / 2, pz - 0.36);
			// The portal's corner braces
			const brace = box(1.8, 0.4, 0.6, frameMat, e * 6.6, U + ph - 0.5, pz);
			brace.rotation.z = e * 0.5;
		}
		box(15.6, 0.7, 0.7, frameMat, 0, U + ph + 0.35, pz);
		box(14.4, 0.03, 0.03, mat.led, 0, U + ph - 0.02, pz - 0.36);
		const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.55), new THREE.MeshBasicMaterial({ map: signTexture('COMMAND DECK · ML-1', CYAN), color: new THREE.Color(1.2, 1.2, 1.2) }));
		sign.position.set(0, U + ph + 0.35, pz - 0.36);
		sign.rotation.y = Math.PI;
		world.add(sign);

		// ---------- The galleries' walls and the records on them ----------
		const gw = GAL_END - STAIR.z0 + 0.3, gh = 4.4;
		for (const e of [-1, 1]) {
			const w2 = add(tile(new THREE.PlaneGeometry(gw, gh), gw / 20, gh / 8), wallMat, e * WALL, U + gh / 2, (STAIR.z0 + GAL_END) / 2);
			w2.rotation.y = -e * Math.PI / 2;
			box(RH - WALL + 0.2, 0.12, gw, frameMat, e * (WALL + (RH - WALL) / 2), U + gh, (STAIR.z0 + GAL_END) / 2);
			box(0.03, 0.03, gw, mat.cool, e * (WALL - 0.03), U + gh - 0.08, (STAIR.z0 + GAL_END) / 2);
		}
		// Operations screens on the gallery walls, two a side
		const SW = 2.8, SH = 1.75;
		for (const e of [-1, 1]) for (const [z, page] of [[-3.6, e > 0 ? 4 : 6], [2.4, e > 0 ? 5 : 7]]) {
			const group = put(new THREE.Group(), world, e * (WALL - 0.09), U + 1.9, z);
			group.rotation.y = -e * (Math.PI / 2);
			put(rbox(SW + 0.14, SH + 0.14, 0.08, frameMat, 0.03), group, 0, 0, -0.045);
			put(new THREE.Mesh(new THREE.BoxGeometry(SW - 0.3, 0.012, 0.012), mat.led), group, 0, -SH / 2 - 0.08, 0.006);
			group.updateWorldMatrix(true, false);
			screens.add(group.matrixWorld.clone().multiply(M(0, 0, 0.003)), SW, SH, opsUV(page));
		}

		// ---------- Overhead: a spine truss down the crown with light panels under it, cable runs along the walls ----------
		for (const sx of [-0.7, 0.7]) for (const y of [7.9, 7.1]) rod(V(sx, y, Z0 + 0.5), V(sx, y, Z_NOSE), 0.06, frameMat);
		for (let z = Z0 + 0.5; z < Z_NOSE; z += 1.5) {
			for (const sx of [-0.7, 0.7]) rod(V(sx, 7.1, z), V(sx, 7.9, z + 1.5), 0.03, frameMat);
			rod(V(-0.7, 7.1, z), V(0.7, 7.1, z), 0.03, frameMat);
		}
		for (let z = -12; z <= 6; z += 3) box(1.2, 0.05, 2.0, mat.light, 0, 7.0, z);
		for (const e of [-1, 1]) for (const [a, k] of [[0.62, 0], [0.66, 1], [0.7, 2]] as const) {
			const ang = e > 0 ? a : Math.PI - a;
			rod(V(Math.cos(ang) * (RH - 0.3), Math.sin(ang) * (RH - 0.3), Z0 + 0.5), V(Math.cos(ang) * (RH - 0.3), Math.sin(ang) * (RH - 0.3), Z_NOSE), 0.04, k === 1 ? mat.rail : mat.dark);
		}

		// ---------- The pit: the captain's dais and chair ----------
		add(new THREE.CylinderGeometry(CAPT.r, CAPT.r + 0.05, 0.16, 64), mat.dark, 0, L + 0.08, CAPT.z);
		add(new THREE.CylinderGeometry(CAPT.r - 0.4, CAPT.r - 0.35, 0.18, 64), mat.dark, 0, L + 0.25, CAPT.z);
		add(new THREE.TorusGeometry(CAPT.r - 0.02, 0.02, 6, 96).rotateX(Math.PI / 2), mat.led, 0, L + 0.165, CAPT.z);
		const chair = put(new THREE.Group(), world, 0, L + 0.34, CAPT.z);
		const padGlow = [CYAN, GREEN, AMBER].map((c) => glow(c, 1.5)); // shared, so the pads merge into three draws
		put(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 0.36, 20), frameMat), chair, 0, 0.18, 0);
		put(rbox(0.72, 0.16, 0.66, mat.seat, 0.06), chair, 0, 0.46, 0);
		put(rbox(0.74, 1.05, 0.16, mat.seat, 0.06), chair, 0, 1.0, -0.34).rotation.x = -0.14;
		put(rbox(0.4, 0.22, 0.12, mat.seat, 0.05), chair, 0, 1.6, -0.43).rotation.x = -0.14;
		for (const s of [-1, 1]) {
			put(rbox(0.16, 0.12, 0.74, mat.body, 0.04), chair, s * 0.44, 0.68, 0.04);
			const pad = put(rbox(0.2, 0.03, 0.26, mat.plastic, 0.01), chair, s * 0.44, 0.76, 0.22);
			pad.rotation.x = 0.15;
			for (let k = 0; k < 6; k++) put(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.03), padGlow[k % 3]), chair, s * 0.44 + ((k % 3) - 1) * 0.05, 0.785, 0.17 + Math.floor(k / 3) * 0.07);
		}
		// Two wing consoles turned toward the chair, a screen on each
		for (const s of [-1, 1]) {
			const wing = put(new THREE.Group(), world, s * 1.15, L + 0.34, CAPT.z + 0.45);
			wing.rotation.y = Math.PI + s * 0.55;
			put(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 12), frameMat), wing, 0, 0.4, 0);
			put(rbox(0.66, 0.44, 0.06, mat.body, 0.02), wing, 0, 1.0, 0).rotation.x = -0.35;
			wing.updateWorldMatrix(true, false);
			screens.add(wing.matrixWorld.clone().multiply(M(0, 1.0, 0.035, 0, -0.35)), 0.58, 0.36, opsUV(s > 0 ? 8 : 0));
		}

		// ---------- The holographic table: the system turning in light above it ----------
		add(new THREE.CylinderGeometry(0.7, 1.05, 0.95, 48), graphite, 0, L + 0.475, HOLO.z);
		add(new THREE.CylinderGeometry(HOLO.r, HOLO.r - 0.1, 0.12, 64), frameMat, 0, L + 1.0, HOLO.z);
		add(new THREE.CircleGeometry(HOLO.r - 0.14, 64).rotateX(-Math.PI / 2), glow(CYAN, 0.45), 0, L + 1.065, HOLO.z);
		add(new THREE.TorusGeometry(HOLO.r - 0.05, 0.025, 6, 96).rotateX(Math.PI / 2), mat.led, 0, L + 1.07, HOLO.z);
		for (let k = 0; k < 12; k++) {
			const a = (k / 12) * Math.PI * 2;
			box(0.03, 0.6, 0.12, mat.ledSoft, Math.cos(a) * 0.98, L + 0.5, HOLO.z + Math.sin(a) * 0.98).rotation.y = -a;
		}
		const additive = (c: string, o = 0.7) => new THREE.LineBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.4), transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false });
		const holo = new THREE.Group();
		holo.position.set(0, L + 1.75, HOLO.z);
		holo.userData.keep = true;
		world.add(holo);
		const maxOrbit = Math.max(content.vesselOrbit, ...content.worlds.map((w) => w.orbit));
		const hs = 1.15 / maxOrbit;
		const ringPts = (r: number) => Array.from({ length: 96 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * Math.PI * 2) * r, 0, Math.sin((i / 96) * Math.PI * 2) * r));
		const orbitMat = additive(CYAN, 0.45);
		const holoWorlds = [...content.worlds].sort((a, z) => a.orbit - z.orbit).map((w, i) => {
			holo.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts(w.orbit * hs)), orbitMat));
			const m = new THREE.Mesh(new THREE.SphereGeometry(w.look === 'saturn' || w.look === 'neptune' ? 0.075 : 0.055, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(LOOK_COLOR[w.look] ?? ICE).multiplyScalar(1.3) }));
			holo.add(m);
			return { m, r: w.orbit * hs, a: 0.7 + i * 1.9, speed: 0.35 * Math.pow(maxOrbit / w.orbit, 1.5) * 0.12 };
		});
		const shipOrbit = new THREE.Group();
		shipOrbit.rotation.x = 0.3;
		holo.add(shipOrbit);
		shipOrbit.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts(content.vesselOrbit * hs)), additive(AMBER, 0.55)));
		const ship = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(AMBER).multiplyScalar(1.6) }));
		shipOrbit.add(ship);
		const starTex = (() => {
			const { cv, g } = canvas(128, 128);
			const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
			gr.addColorStop(0, 'rgba(255,244,220,1)'); gr.addColorStop(0.2, 'rgba(255,214,150,0.8)'); gr.addColorStop(1, 'rgba(242,177,59,0)');
			g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
			return tex(cv);
		})();
		const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1.4, 1.4, 1.4) }));
		star.scale.setScalar(0.4);
		holo.add(star);
		// The projection: a column of light rising from the table, fading as it goes
		const column = new THREE.Mesh(new THREE.CylinderGeometry(HOLO.r - 0.1, HOLO.r - 0.2, 1.4, 48, 1, true), new THREE.ShaderMaterial({
			uniforms: { uColor: { value: new THREE.Color(CYAN) } },
			vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
			fragmentShader: /* glsl */ `uniform vec3 uColor; varying vec2 vUv; void main() { float a = (1.0 - vUv.y) * 0.12 * (0.7 + 0.3 * sin(vUv.x * 220.0)); gl_FragColor = vec4(uColor * a, 1.0); }`,
			transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
		}));
		column.position.set(0, L + 1.77, HOLO.z);
		world.add(column);
		// A halo of light hung over the table from the spine
		add(new THREE.TorusGeometry(3.0, 0.1, 10, 128).rotateX(Math.PI / 2), frameMat, 0, L + 6.4, HOLO.z);
		add(new THREE.TorusGeometry(2.86, 0.03, 6, 128).rotateX(Math.PI / 2), mat.led, 0, L + 6.34, HOLO.z);
		for (let k = 0; k < 6; k++) {
			const a = (k / 6) * Math.PI * 2;
			rod(V(Math.cos(a) * 3.0, L + 6.45, HOLO.z + Math.sin(a) * 3.0), V(Math.cos(a) * 0.7, 7.1, HOLO.z + Math.sin(a) * 0.4), 0.015, frameMat);
		}

		// ---------- Operations: a bank of consoles down each side of the pit, a seat at each ----------
		const lit: { m: THREE.Matrix4; c: THREE.Color }[] = [];
		const chairSpots: THREE.Matrix4[] = [];
		let sheetIndex = 1;
		for (const e of [-1, 1]) for (let k = 0; k < 4; k++) {
			const z = -4.2 + k * 2.8;
			box(0.75, 0.82, 2.5, graphite, e * 4.45, L + 0.41, z);
			box(0.04, 0.04, 2.4, mat.led, e * 4.07, L + 0.1, z);
			const top = box(0.82, 0.05, 2.5, mat.body, e * 4.4, L + 0.86, z);
			top.rotation.z = e * 0.3;
			const hood = box(0.08, 0.82, 2.4, mat.body, e * 4.8, L + 1.4, z);
			hood.rotation.z = -e * 0.16;
			for (const dz of [-0.6, 0.6]) {
				screens.add(M(e * 4.74, L + 1.4, z + dz, -e * Math.PI / 2, -0.16), 1.0, 0.62, opsUV(sheetIndex++));
			}
			// Lit keys on the sloped top
			for (let r = 0; r < 2; r++) for (let c = 0; c < 10; c++) {
				const v = (c * 7 + r * 3 + k) % 5;
				const color = v === 0 ? AMBER : v === 1 ? GREEN : CYAN;
				const m = new THREE.Matrix4().compose(V(e * (4.3 + r * 0.1), L + 0.891 + (r * 0.1 - 0.1) * 0.309, z - 0.9 + c * 0.2), new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), e * 0.3), V(0.06, 0.012, 0.12));
				lit.push({ m, c: new THREE.Color(color).multiplyScalar(v < 3 ? 1.4 : 0.5) });
			}
			for (const dz of [-0.6, 0.6]) chairSpots.push(new THREE.Matrix4().compose(V(e * 3.55, L, z + dz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), e * Math.PI / 2), V(1, 1, 1)));
		}
		const keyGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.2);
		const keys = new THREE.InstancedMesh(keyGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), lit.length);
		lit.forEach(({ m, c }, i) => { keys.setMatrixAt(i, m); keys.setColorAt(i, c); });
		world.add(keys);
		const chairGeo = mergeGeometries([
			new RoundedBoxGeometry(0.54, 0.12, 0.52, 1, 0.04).translate(0, 0.5, 0),
			new RoundedBoxGeometry(0.54, 0.75, 0.12, 1, 0.04).rotateX(-0.12).translate(0, 0.95, -0.28),
			new THREE.CylinderGeometry(0.04, 0.04, 0.38, 8).translate(0, 0.26, 0),
			...[0, 1, 2, 3, 4].map((k) => new THREE.BoxGeometry(0.3, 0.04, 0.05).translate(0.15, 0.06, 0).rotateY((k / 5) * Math.PI * 2)),
		].map((g) => (g.index ? g.toNonIndexed() : g))); // rounded boxes come unindexed; the rest must match
		const opsChairs = new THREE.InstancedMesh(chairGeo, mat.seat, chairSpots.length);
		chairSpots.forEach((m, i) => opsChairs.setMatrixAt(i, m));
		world.add(opsChairs);
		const opsAnchor = put(new THREE.Object3D(), world, 0, L + 1, 0);
		kit.live(ops, opsAnchor, 0.2, 30, 8);

		// ---------- The pilot's station under the window: seats, the desk, its displays and the head-up glass ----------
		// Built as the desk was first modelled, a little under life size, then drawn CK.k times larger: local x runs to the
		// pilot's left, y up from the pit floor, z toward the window from the desk's centre.
		const ck = put(new THREE.Group(), world, 0, L, CK.z);
		ck.scale.setScalar(CK.k);
		const cadd = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => put(new THREE.Mesh(g, m), ck, x, y, z);
		const crod = (a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) => {
			const d = b.clone().sub(a);
			const mesh = cadd(new THREE.CylinderGeometry(r, r, d.length(), 10), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
			mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
			return mesh;
		};
		// Two seats with side sticks on their outer armrests
		for (const s of [-1, 1]) {
			const x = s * 0.6, z = -0.62;
			put(rbox(0.5, 0.12, 0.5, mat.seat, 0.05), ck, x, 0.48, z);
			put(rbox(0.5, 0.72, 0.12, mat.seat, 0.05), ck, x, 0.92, z - 0.26).rotation.x = -0.18;
			put(rbox(0.3, 0.2, 0.1, mat.seat, 0.04), ck, x, 1.38, z - 0.34).rotation.x = -0.18;
			for (const a of [-1, 1]) put(rbox(0.07, 0.07, 0.42, mat.body, 0.02), ck, x + a * 0.28, 0.62, z);
			for (const a of [-0.12, 0.12]) put(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.012), mat.strap), ck, x + a, 0.92, z - 0.19).rotation.x = -0.18;
			crod(V(x, 0, z), V(x, 0.42, z), 0.05, mat.metal);
			const ax = x + s * 0.28, az = z + 0.13;
			cadd(new THREE.CylinderGeometry(0.03, 0.035, 0.025, 20), mat.plastic, ax, 0.67, az);
			cadd(new THREE.CylinderGeometry(0.011, 0.015, 0.07, 14), mat.trim, ax, 0.71, az);
			cadd(new THREE.CapsuleGeometry(0.021, 0.06, 4, 12), mat.plastic, ax, 0.78, az + 0.005).rotation.x = 0.2;
			cadd(new THREE.SphereGeometry(0.008, 10, 8), glow(RED, 1.4), ax, 0.825, az + 0.02);
		}
		// Pedestal under the desk, with a vent grille and a cyan line along its foot
		put(rbox(2.2, 0.68, 0.66, mat.body, 0.03), ck, 0, 0.34, 0.13);
		put(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.02), mat.plastic), ck, 0, 0.06, -0.205);
		const vents = (() => {
			const { cv, g } = canvas(1024, 192);
			g.fillStyle = '#1a1d22';
			g.fillRect(0, 0, 1024, 192);
			for (let y = 12; y < 192; y += 22) { g.fillStyle = '#07080a'; g.fillRect(16, y, 992, 11); }
			return tex(cv);
		})();
		put(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.24), std({ map: vents, roughness: 0.7, metalness: 0.4 })), ck, 0, 0.34, -0.203).rotation.y = Math.PI;
		put(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.008, 0.008), mat.led), ck, 0, 0.12, -0.208);

		// The desk: a sloped control surface. Its local x runs to the pilot's left and z away from the pilot.
		const desk = new THREE.Group();
		desk.position.set(0, 0.8, 0);
		desk.rotation.x = -0.28;
		ck.add(desk);
		const clusters: Cluster[] = [
			{ x: 0, w: 0.36, label: 'THRUST' },
			{ x: 0.42, w: 0.38, label: 'NAV ENTRY' },
			{ x: 0.86, w: 0.42, label: 'RCS · PROPULSION' },
			{ x: -0.42, w: 0.38, label: 'COMMS' },
			{ x: -0.86, w: 0.42, label: 'POWER DIST' },
		];
		const sheets = deskSheets(clusters);
		put(rbox(DW, 0.05, DD, mat.body, 0.012), desk, 0, -0.026, 0);
		const flat = (m: THREE.Mesh) => { m.rotation.set(-Math.PI / 2, 0, Math.PI); return m; };
		put(flat(new THREE.Mesh(new THREE.PlaneGeometry(DW - 0.02, DD - 0.02), std({ map: sheets.map, emissiveMap: sheets.glow, emissive: '#bfe6ff', emissiveIntensity: 1.1, roughness: 0.55, metalness: 0.35 }))), desk, 0, 0.0012, 0);
		put(flat(new THREE.Mesh(new THREE.PlaneGeometry(2.06, 0.05), new THREE.MeshBasicMaterial({ map: annunciatorSheet(), color: new THREE.Color(1, 1, 1).multiplyScalar(1.3) }))), desk, 0, 0.0016, 0.215);
		put(rbox(DW + 0.04, 0.03, 0.04, mat.trim, 0.012), desk, 0, -0.008, -DD / 2 - 0.012);
		put(new THREE.Mesh(new THREE.BoxGeometry(DW - 0.1, 0.004, 0.004), mat.ledSoft), desk, 0, -0.02, -DD / 2 - 0.035);

		// Push buttons, as two instanced sets: dark caps, and lit ones in their own colours
		const unlit: THREE.Matrix4[] = [], deskLit: { m: THREE.Matrix4; c: THREE.Color }[] = [];
		const flatQ = new THREE.Quaternion();
		const cap = (x: number, z: number, w: number, d: number, color = '', k = 1.3, h = 0.012) => {
			const m = new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), flatQ, new THREE.Vector3(w, h, d));
			if (color) deskLit.push({ m, c: new THREE.Color(color).multiplyScalar(k) });
			else unlit.push(m);
		};
		const rand = rng(97);
		// Thrust: two levers in their slots
		for (const s of [-1, 1]) {
			put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.25), mat.plastic), desk, s * 0.07, 0.002, -0.01);
			for (let k = 0; k < 5; k++) put(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.003, 0.003), mat.trim), desk, s * 0.098, 0.002, -0.12 + k * 0.055);
			const lever = put(new THREE.Group(), desk, s * 0.07, 0, s > 0 ? 0.02 : -0.02);
			lever.rotation.x = 0.32;
			put(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.13, 12), mat.trim), lever, 0, 0.065, 0);
			put(rbox(0.07, 0.032, 0.05, mat.grip, 0.012), lever, 0, 0.14, 0);
			put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.012), glow(AMBER, 1.5)), lever, 0, 0.157, 0.01);
		}
		cap(0.16, 0.12, 0.04, 0.035, RED, 1.8);
		cap(-0.16, 0.12, 0.04, 0.035, AMBER, 1.8);
		// Nav entry: a keypad under a segment readout
		put(flat(new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.057), new THREE.MeshBasicMaterial({ map: segmentSheet('0412.7'), color: new THREE.Color(1, 1, 1).multiplyScalar(1.5) }))), desk, 0.42, 0.002, 0.105);
		for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) cap(0.42 + (k - 1) * 0.07, 0.035 - r * 0.052, 0.054, 0.04, r === 3 && k === 0 ? GREEN : '', 1.5);
		// RCS and propulsion: two banks of toggles, two of them under red guards, each with a status lamp
		for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) {
			const x = 0.86 + (k - 2.5) * 0.062, z = r ? -0.08 : 0.06;
			put(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.004, 16), mat.trim), desk, x, 0.002, z);
			const t = put(new THREE.Group(), desk, x, 0.004, z);
			t.rotation.x = rand() < 0.6 ? 0.45 : -0.45;
			put(new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0045, 0.034, 8), mat.metal), t, 0, 0.017, 0);
			put(new THREE.Mesh(new THREE.SphereGeometry(0.0058, 10, 8), mat.metal), t, 0, 0.035, 0);
			if ((r === 0 && k === 1) || (r === 1 && k === 4)) put(new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.034, 0.05), mat.guard), desk, x, 0.019, z);
			cap(x, z + 0.04, 0.014, 0.01, rand() < 0.7 ? GREEN : AMBER, 1.8, 0.004);
		}
		// Comms: a grid of lit push buttons
		for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
			const v = rand();
			cap(-0.42 + (k - 2) * 0.064, 0.09 - r * 0.062, 0.05, 0.042, v < 0.22 ? AMBER : v < 0.4 ? CYAN : v < 0.48 ? GREEN : '', 1.2);
		}
		// Power distribution: four rotary selectors over a row of lamps
		for (let k = 0; k < 4; k++) {
			const x = -0.86 + (k - 1.5) * 0.095;
			put(new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.004, 28), mat.trim), desk, x, 0.002, 0.045);
			const knob = put(new THREE.Group(), desk, x, 0.004, 0.045);
			knob.rotation.y = rand() * Math.PI * 2;
			put(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.026, 24), mat.plastic), knob, 0, 0.013, 0);
			put(new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, 0.016), glow('#ffffff', 1.2)), knob, 0, 0.027, 0.007);
		}
		for (let k = 0; k < 6; k++) cap(-0.86 + (k - 2.5) * 0.06, -0.095, 0.034, 0.03, k < 4 ? GREEN : rand() < 0.5 ? AMBER : '', 1.6);
		const caps = new THREE.InstancedMesh(keyGeo, mat.cap, unlit.length);
		unlit.forEach((m, i) => caps.setMatrixAt(i, m));
		desk.add(caps);
		const lamps = new THREE.InstancedMesh(keyGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), deskLit.length);
		deskLit.forEach(({ m, c }, i) => { lamps.setMatrixAt(i, m); lamps.setColorAt(i, c); });
		desk.add(lamps);
		// Behind the desk, a filler panel up to the displays
		put(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.04), mat.body), ck, 0, 0.63, 0.44);

		// The displays: navigation in the middle, command to the pilot's left, systems to the right.
		// Each sits in a housing with bezel keys, under a hood with an LED strip.
		const nav = navScreen(content), cmd = commandScreen(content), sys = systemsScreen(), hud = hudSymbology(content);
		const mfd = (t: THREE.Texture, w: number, h: number, p: THREE.Vector3, yawTo: number, tilt: number, side: number, bottom: number) => {
			const group = new THREE.Group();
			group.position.copy(p);
			group.rotation.set(tilt, yawTo, 0, 'YXZ');
			const hw = w + 0.16, hh = h + 0.15;
			put(rbox(hw, hh, 0.07, mat.body, 0.02), group, 0, 0, -0.04);
			put(rbox(w + 0.03, h + 0.03, 0.012, mat.plastic, 0.004), group, 0, 0, -0.004);
			put(face(t, w, h, true), group, 0, 0, 0.003);
			for (let i = 0; i < bottom; i++) put(rbox(0.05, 0.026, 0.016, mat.cap, 0.005), group, (i - (bottom - 1) / 2) * (w / bottom), -h / 2 - 0.042, 0);
			for (const s of [-1, 1]) for (let i = 0; i < side; i++) put(rbox(0.026, 0.044, 0.016, mat.cap, 0.005), group, s * (w / 2 + 0.042), (i - (side - 1) / 2) * (h / side), 0);
			for (const [sx, sy2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) put(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 10).rotateX(Math.PI / 2), mat.trim), group, sx * (hw / 2 - 0.022), sy2 * (hh / 2 - 0.022), -0.004);
			const hoodTop = put(rbox(hw + 0.02, 0.026, 0.17, mat.body, 0.008), group, 0, hh / 2 + 0.006, 0.05);
			hoodTop.rotation.x = 0.12;
			put(new THREE.Mesh(new THREE.BoxGeometry(w, 0.005, 0.005), mat.led), group, 0, hh / 2 - 0.03, 0.125);
			ck.add(group);
			return group;
		};
		const navG = mfd(nav.tex, 0.96, 0.533, V(0, 1.2, 0.38), Math.PI, -0.3, 4, 6);
		const cmdG = mfd(cmd.tex, 0.58, 0.397, V(0.93, 1.17, 0.2), Math.PI + 0.42, -0.25, 3, 4);
		const sysG = mfd(sys.tex, 0.58, 0.397, V(-0.93, 1.17, 0.2), Math.PI - 0.42, -0.25, 3, 4);
		// Wing consoles either side of the desk, angled in, each with two screens
		for (const s of [-1, 1]) {
			const wing = put(new THREE.Group(), ck, s * 1.55, 0, 0.05);
			wing.rotation.y = Math.PI + s * 0.55;
			put(rbox(0.7, 0.8, 0.5, mat.body, 0.03), wing, 0, 0.4, 0.05);
			put(rbox(0.74, 0.62, 0.06, mat.body, 0.02), wing, 0, 1.15, 0.2).rotation.x = -0.25;
			put(new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.008, 0.008), mat.led), wing, 0, 0.82, -0.2);
			wing.updateWorldMatrix(true, false);
			for (const dy of [-0.14, 0.14]) screens.add(wing.matrixWorld.clone().multiply(M(0, 1.15 + dy * 0.97, 0.235 - dy * 0.25, 0, -0.25)), 0.64, 0.24, opsUV(s > 0 ? 3 : 11));
		}
		// The overhead panel, on a frame arching over the seats
		for (const s of [-1, 1]) crod(V(s * 1.15, 0.68, 0.42), V(s * 0.46, 2.72, -0.62), 0.03, mat.trim);
		crod(V(-0.46, 2.72, -0.62), V(0.46, 2.72, -0.62), 0.03, mat.trim);
		const over = put(new THREE.Group(), ck, 0, 2.77, -0.7);
		over.rotation.x = 0.2;
		put(rbox(0.86, 0.05, 0.44, mat.body, 0.015), over);
		const overSheet = overheadSheet();
		put(new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.4), std({ map: overSheet, emissiveMap: overSheet, emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.6 })), over, 0, -0.026, 0).rotation.set(Math.PI / 2, 0, Math.PI);
		// Head-up display: a combiner glass on two posts above the navigation display
		const hudG = new THREE.Group();
		hudG.position.set(0, 1.73, 0.3);
		hudG.rotation.set(-0.18, Math.PI, 0, 'YXZ');
		ck.add(hudG);
		put(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshBasicMaterial({ color: '#0d2a26', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })), hudG);
		put(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.2625), new THREE.MeshBasicMaterial({ map: hud.tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(1, 1, 1).multiplyScalar(1.4) })), hudG, 0, 0, 0.002);
		for (const s of [-1, 1]) put(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.3, 0.012), mat.trim), hudG, s * 0.218, -0.04, -0.004);
		put(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.014, 0.02), mat.body), hudG, 0, -0.137, -0.004);
		// How often each display redraws; the command display only blinks its cursor
		kit.live(nav, navG, 1 / 15, 16, 1.2);
		kit.live(hud, hudG, 1 / 15, 12, 0.6);
		kit.live(sys, sysG, 1 / 12, 14, 0.8);
		kit.live(cmd, cmdG, 0.5, 14, 0.8);

		// Every console screen, in one draw
		world.add(screens.mesh(new THREE.MeshBasicMaterial({ map: ops.tex, toneMapped: false, color: new THREE.Color(0.95, 0.95, 0.95) })));

		// ---------- Lights: down the crown, over the pit, at the window, the table's glow, the pilot's station ----------
		world.add(new THREE.HemisphereLight('#cfe0ff', '#262b33', 0.55));
		for (const [c, x, y, z, k, d] of [
			['#e6efff', 0, U + 2.7, (RECORDS_Z[0] + RECORDS_Z[1]) / 2, 9, 10],
			['#ffeedb', 0, U + 4.2, -11.5, 14, 14],
			['#e6f0ff', 0, L + 6.6, -0.2, 42, 24],
			['#dfeaff', 0, L + 5.2, 6.0, 34, 18],
			[CYAN, 0, L + 1.9, HOLO.z, 6, 6],
			['#9cc8ff', 0, L + 1.9, CK.z - 0.6, 5, 5],
		] as const) {
			const l = new THREE.PointLight(c, k, d, 2);
			l.position.set(x, y, z);
			world.add(l);
		}

		// ---------- Outside the window: the star, and a world hanging in the dark ----------
		const sunDir = new THREE.Vector3(0.45, 0.42, 1).normalize();
		const glowTex = (() => {
			const { cv, g } = canvas(256, 256);
			const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
			gr.addColorStop(0, 'rgba(255,240,214,1)'); gr.addColorStop(0.1, 'rgba(255,214,150,0.8)'); gr.addColorStop(0.4, 'rgba(242,177,59,0.12)'); gr.addColorStop(1, 'rgba(242,177,59,0)');
			g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
			return tex(cv);
		})();
		const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1, 1, 1).multiplyScalar(1.3) }));
		sunSprite.position.copy(sunDir).multiplyScalar(500);
		sunSprite.scale.setScalar(56);
		world.add(sunSprite);
		const planetTex = loader.load(kit.textures + 'neptune.jpg');
		planetTex.colorSpace = THREE.SRGBColorSpace;
		const planet = new THREE.Mesh(
			new THREE.SphereGeometry(80, 96, 48),
			new THREE.ShaderMaterial({
				uniforms: { uMap: { value: planetTex }, uSun: { value: sunDir } },
				vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
				fragmentShader: /* glsl */ `uniform sampler2D uMap; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN;
					void main() { float d = max(dot(normalize(vN), uSun), 0.0); vec3 c = texture2D(uMap, vUv).rgb * (0.02 + 1.3 * d);
					gl_FragColor = vec4(c, 1.0);
					#include <colorspace_fragment>
					}`,
			}),
		);
		planet.position.set(-150, 150, 460);
		world.add(planet);

		function update(_dt: number, time: number) {
			holo.rotation.y = time * 0.08;
			for (const w of holoWorlds) { const a = w.a + time * w.speed; w.m.position.set(Math.cos(a) * w.r, 0, Math.sin(a) * w.r); }
			const sa = 2.2 + time * 0.12, sr = content.vesselOrbit * hs;
			ship.position.set(Math.cos(sa) * sr, 0, Math.sin(sa) * sr);
			ship.rotation.y = time;
		}

		return {
			code: 'VSL-01',
			name: 'Command module, aboard ML-1',
			scale: 1,
			eye: EYE,
			ground,
			spawn: V(0, 0, CORR.z0 + 1.4),
			spawnYaw: Math.PI,
			collide,
			hatch: { z: Z0, y: HATCH_Y, door, wheel },
			revealAt: 7,
			exposure: 1.0,
			update,
		};
	};
}

// ---------- Walking ----------

// The upper deck runs from the hatch along both galleries; the stair takes the pilot down into the pit
function ground(p: THREE.Vector3) {
	const ax = Math.abs(p.x);
	if (p.z <= STAIR.z0) return U;
	if (p.z < STAIR.z1) return ax < STAIR.x ? THREE.MathUtils.lerp(U, L, THREE.MathUtils.smootherstep(p.z, STAIR.z0, STAIR.z1)) : U;
	return ax >= PIT && p.z < GAL_END ? U : L;
}

// Railings keep each level to itself; consoles, seats, the dais and the table stand in the pit
const side = (e: number, a: number, b: number, z0: number, z1: number) => (e > 0 ? { x0: a, x1: b, z0, z1 } : { x0: -b, x1: -a, z0, z1 });
const blocks = [
	...[-1, 1].flatMap((e) => [
		side(e, STAIR.x - 0.06, STAIR.x + 0.06, STAIR.z0, STAIR.z1),
		side(e, STAIR.x, PIT, STAIR.z1 - 0.06, STAIR.z1 + 0.06),
		side(e, PIT - 0.06, PIT + 0.06, STAIR.z1, GAL_END),
		side(e, PIT, 9, GAL_END - 0.06, GAL_END + 0.06),
		side(e, 3.2, 4.95, -5.6, 5.6),
		side(e, 0.3, 1.25, CK.z - 1.3, CK.z - 0.4),
		side(e, 7.2, 8.6, Z0 + 0.4, STAIR.z0 - 0.4),
		side(e, 7.0, 8.6, STAIR.z0 - 0.75, STAIR.z0 + 0.15),
		side(e, CORR.w, 9, Z0 - 0.15, Z0 + 0.15), // the bulkhead either side of the corridor's doorway
	]),
	{ x0: -2.75, x1: 2.75, z0: CK.z - 0.35, z1: 10 },
];
function collide(p: THREE.Vector3, radius: number) {
	p.z = THREE.MathUtils.clamp(p.z, CORR.z0 + 0.3, 9.0);
	const lim = p.z < Z0 ? CORR.w - 0.35 : p.z > GAL_END + 0.2 ? 7.0 : 7.9;
	p.x = THREE.MathUtils.clamp(p.x, -lim, lim);
	if (ground(p) === L) for (const c of [CAPT, HOLO]) {
		const dx = p.x, dz = p.z - c.z, d = Math.hypot(dx, dz), r = c.r + radius + 0.05;
		if (d < r && d > 1e-4) { p.x = (dx / d) * r; p.z = c.z + (dz / d) * r; }
	}
	pushOut(p, blocks, radius);
}
