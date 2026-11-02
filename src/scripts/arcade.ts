// The vessel's fifth habitat bay: a neon arcade inside a cylinder twenty-two metres across and thirty-six long.
// A hexagonal tunnel of chasing lights leads in from the hatch; the Call of Duty campaigns hang in order down the
// left wall, the other series in lit alcoves down the right, and the stand-alone favourites turn on a pillar in the
// middle. Past a LAN island and a lounge, a wall of LEDs keeps the library like a high-score table, flanked by
// upright cabinets. Catwalks run along both walls under a vault of ribs and neon tubes.
// Every poster comes from one atlas and is drawn in one call; so are their captions and the neon signs.
// Units are metres: +Z runs from the entrance hatch to the LED wall, +Y is up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
	ICE, DIM, COND, DISPLAY,
	rng, canvas, tex, lines, liveCanvas, shell, pushOut, fontsReady, Quads, M,
	type Live, type Kit, type Interior,
} from './interior';

export type Game = { key: string; no?: number; title: string; year: number };
export type Series = { name: string; accent: string; games: Game[] };
export type ArcadeContent = {
	name: string; // the pilot's, for the high-score wall
	series: Series[]; // in atlas order: Call of Duty first, the featured stand-alone games last
	atlas: { src: string; cols: number; rows: number };
};

const RH = 11; // hall radius
const FL = -4.6; // floor height; the hall's axis is y = 0
const HW = Math.sqrt(RH * RH - FL * FL); // half the floor's width
const Z0 = -18, Z1 = 18; // entrance and far bulkheads
const TZ = -11; // where the tunnel opens into the hall
const EYE = FL + 1.62;
const HATCH_Y = FL + 0.85;
const WALL = 8.6; // the side walls
const HEX = 3.6, HEX_Y = FL + HEX * Math.sin(Math.PI / 3); // the tunnel: a hexagon with flat floor and roof
const CAR = { x: 0, z: -3.5, r: 2.9 }; // the featured pillar's dais
const LAN = { z0: 4.8, z1: 10.0 };
const CYAN = '#2de2ff', MAGENTA = '#ff2bd6', VIOLET = '#a46bff';
const PW = 1.3, PH = 1.95; // posters on the Call of Duty wall
const AW = 1.15, AH = 1.725; // posters in the alcoves
const CAP = { w: 1.28, h: 1.28 / 3.5 }; // caption plaques
const ONE = new THREE.Vector3(1, 1, 1);

// ---------- Surfaces ----------

// The floor: near-black tiles under a glowing grid (cyan every metre, magenta every four), chevrons down the tunnel,
// rings around the featured pillar, and the bay's name before the LED wall. Canvas x follows world x; canvas y runs
// from the entrance (top) to the far end. It doubles as the floor's emissive map, so the lines glow.
function floorSheet() {
	const L = Z1 - Z0, W = 2048, H = Math.round((W * L) / (2 * HW));
	const { cv, g } = canvas(W, H);
	const s = W / (2 * HW);
	const X = (x: number) => (x + HW) * s, Z = (z: number) => (z - Z0) * s;
	const rand = rng(23);
	g.fillStyle = '#05060c';
	g.fillRect(0, 0, W, H);
	for (let i = 0; i < 2600; i++) {
		g.fillStyle = `rgba(80,90,140,${rand() * 0.05})`;
		g.fillRect(rand() * W, rand() * H, s * 0.5, s * 0.5);
	}
	for (let x = Math.ceil(-HW); x <= HW; x++) {
		const major = x % 4 === 0;
		g.fillStyle = major ? 'rgba(255,43,214,0.55)' : 'rgba(45,226,255,0.22)';
		g.fillRect(X(x) - (major ? 2 : 1), 0, major ? 4 : 2, H);
	}
	for (let z = Z0; z <= Z1; z++) {
		const major = z % 4 === 0;
		g.fillStyle = major ? 'rgba(255,43,214,0.55)' : 'rgba(45,226,255,0.22)';
		g.fillRect(0, Z(z) - (major ? 2 : 1), W, major ? 4 : 2);
	}
	// Chevrons down the tunnel, pointing into the hall
	g.strokeStyle = 'rgba(45,226,255,0.9)';
	g.lineWidth = 6;
	for (let z = Z0 + 2.6; z < TZ - 0.5; z += 1.3) {
		g.beginPath(); g.moveTo(X(-0.7), Z(z)); g.lineTo(X(0), Z(z + 0.5)); g.lineTo(X(0.7), Z(z)); g.stroke();
	}
	// Rings around the dais
	for (const [r, c] of [[CAR.r + 0.5, 'rgba(164,107,255,0.9)'], [CAR.r + 0.9, 'rgba(45,226,255,0.5)'], [CAR.r + 1.5, 'rgba(255,43,214,0.35)']] as const) {
		g.strokeStyle = c;
		g.lineWidth = 5;
		g.beginPath(); g.arc(X(CAR.x), Z(CAR.z), r * s, 0, Math.PI * 2); g.stroke();
	}
	g.save();
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.translate(X(0), Z(13.2));
	g.rotate(Math.PI); // reads the right way up walking toward the LED wall
	g.font = `400 ${Math.round(0.9 * s)}px ${DISPLAY}`;
	g.fillStyle = 'rgba(255,43,214,0.95)';
	g.fillText('THE ARCADE', 0, 0);
	g.restore();
	g.save();
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.translate(X(CAR.x), Z(CAR.z - CAR.r - 1.2));
	g.rotate(Math.PI);
	g.font = `600 ${Math.round(0.42 * s)}px ${COND}`;
	g.fillStyle = 'rgba(164,107,255,0.95)';
	g.fillText('FEATURED', 0, 0);
	g.restore();
	return tex(cv);
}

// Hexagonal panels outlined in faint light, for the walls and the tunnel; tiles every two metres
function hexSheet(color: string, repeatX: number, repeatY: number) {
	const W = 512, H = 444;
	const { cv, g } = canvas(W, H);
	g.fillStyle = '#080a14';
	g.fillRect(0, 0, W, H);
	const r = 64, h = r * Math.sqrt(3);
	g.strokeStyle = color;
	g.lineWidth = 3;
	for (let col = -1; col < W / (r * 1.5) + 1; col++) for (let row = -1; row < H / h + 1; row++) {
		const cx = col * r * 1.5, cy = row * h + (col % 2 ? h / 2 : 0);
		g.beginPath();
		for (let k = 0; k <= 6; k++) g.lineTo(cx + Math.cos((k * Math.PI) / 3) * (r - 4), cy + Math.sin((k * Math.PI) / 3) * (r - 4));
		g.stroke();
	}
	const t = tex(cv);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.repeat.set(repeatX, repeatY);
	return t;
}

// The vault: deep indigo with circuit traces running along it and nodes where they turn
function vaultSheet() {
	const W = 2048, H = 1024;
	const { cv, g } = canvas(W, H);
	const rand = rng(31);
	g.fillStyle = '#07071a';
	g.fillRect(0, 0, W, H);
	for (let n = 0; n < 140; n++) {
		let x = rand() * W, y = rand() * H;
		g.strokeStyle = rand() < 0.5 ? 'rgba(45,226,255,0.35)' : 'rgba(255,43,214,0.3)';
		g.lineWidth = 2;
		g.beginPath();
		g.moveTo(x, y);
		for (let k = 0; k < 5; k++) {
			if (k % 2) y += (rand() - 0.5) * 220; else x += (rand() - 0.5) * 260;
			g.lineTo(x, y);
		}
		g.stroke();
		g.fillStyle = g.strokeStyle;
		g.fillRect(x - 4, y - 4, 8, 8);
	}
	return tex(cv);
}

// Neon signs, eight to a sheet, each a 2048 × 256 row: glowing letters with a hot core, a line under them
function signSheet(rows: { text: string; sub?: string; color: string }[]) {
	const W = 2048, H = 2048, RH_ = 256;
	const { cv, g } = canvas(W, H);
	const t = tex(cv);
	const draw = () => {
		g.clearRect(0, 0, W, H);
		g.textAlign = 'center';
		rows.forEach((r, i) => {
			const y0 = i * RH_, main = r.sub ? y0 + 130 : y0 + 160;
			let size = r.sub ? 120 : 140;
			do g.font = `400 ${size -= 6}px ${DISPLAY}`; while (g.measureText(r.text).width > 1900);
			g.shadowColor = r.color;
			for (const blur of [40, 16]) { g.shadowBlur = blur; g.fillStyle = r.color; g.fillText(r.text, W / 2, main); }
			g.shadowBlur = 0;
			g.fillStyle = 'rgba(255,255,255,0.75)';
			g.fillText(r.text, W / 2, main);
			if (r.sub) {
				g.font = `600 52px ${COND}`;
				g.fillStyle = r.color;
				g.fillText(r.sub.toUpperCase(), W / 2, y0 + 222);
			}
		});
		t.needsUpdate = true;
	};
	draw();
	void fontsReady.then(draw);
	return { tex: t, uv: (i: number) => [0, 1 - ((i + 1) * RH_) / H, 1, 1 - (i * RH_) / H] };
}

// Caption plaques, four to a row: the year large in the series colour, the series number, the title
function captionSheet(games: { game: Game; accent: string }[]) {
	const W = 2048, H = 1024, cols = 4, cw = W / cols, ch = 146;
	const { cv, g } = canvas(W, H);
	const t = tex(cv);
	const draw = () => {
		g.fillStyle = '#04060c';
		g.fillRect(0, 0, W, H);
		games.forEach(({ game, accent }, i) => {
			const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
			g.fillStyle = '#0a0e1c';
			g.fillRect(x + 4, y + 4, cw - 8, ch - 8);
			g.fillStyle = accent;
			g.fillRect(x + 4, y + 4, 8, ch - 8);
			g.textAlign = 'left';
			g.font = `400 46px ${DISPLAY}`;
			g.fillText(String(game.year), x + 30, y + 66);
			g.font = `600 30px ${COND}`;
			g.fillStyle = DIM;
			g.fillText(game.no ? `NO. ${String(game.no).padStart(2, '0')}` : 'STAND-ALONE', x + 30, y + 112);
			let size = 40, ls: string[];
			do { g.font = `600 ${size -= 2}px ${COND}`; ls = lines(g, game.title.toUpperCase(), cw - 262); } while (ls.length > 2 && size > 24);
			g.fillStyle = ICE;
			const lh = size * 1.1, top = y + ch / 2 - ((ls.length - 1) * lh) / 2 + size * 0.35;
			ls.forEach((l, k) => g.fillText(l, x + 240, top + k * lh));
		});
		t.needsUpdate = true;
	};
	draw();
	void fontsReady.then(draw);
	return { tex: t, uv: (i: number) => { const x = (i % cols) / cols, y = Math.floor(i / cols) * ch; return [x, 1 - (y + ch) / H, x + 1 / cols, 1 - y / H]; } };
}

// The LED wall: the whole library as a high-score table, one title lit after another, a ticker along the foot
function libraryBoard(content: ArcadeContent): Live {
	const W = 2400, H = 1000;
	const { g, t, begin } = liveCanvas(W, H, 0.6);
	const all = content.series.flatMap((s) => s.games.map((game) => ({ game, s })));
	const first = Math.min(...all.map((a) => a.game.year)), last = Math.max(...all.map((a) => a.game.year));
	const ticker = `INSERT COIN   ·   PRESS START   ·   ${all.length} GAMES PLAYED   ·   ${content.series.length - 1} SERIES AND ${content.series.at(-1)!.games.length} STAND-ALONES   ·   ${first} – ${last}   ·   `;
	// Columns: Call of Duty alone, then the series two to a column, then the stand-alone games
	const cols: Series[][] = [[content.series[0]], content.series.slice(1, 3), content.series.slice(3, 5), content.series.slice(5)];
	const draw = (time: number) => {
		begin();
		g.fillStyle = '#03040a';
		g.fillRect(0, 0, W, H);
		g.fillStyle = 'rgba(255,255,255,0.03)';
		for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
		// Header
		g.textBaseline = 'alphabetic';
		g.textAlign = 'left';
		g.font = `400 70px ${DISPLAY}`;
		g.shadowColor = MAGENTA;
		g.shadowBlur = 24;
		g.fillStyle = MAGENTA;
		g.fillText('ML-1 ARCADE', 60, 100);
		g.shadowBlur = 0;
		g.textAlign = 'right';
		g.font = `600 44px ${COND}`;
		g.fillStyle = CYAN;
		g.fillText(`PLAYER ONE  ·  ${content.name.toUpperCase()}`, W - 60, 72);
		g.fillStyle = DIM;
		g.fillText(`LIBRARY  ${String(all.length).padStart(3, '0')}  ·  ${first}–${last}`, W - 60, 118);
		g.fillStyle = 'rgba(255,43,214,0.5)';
		g.fillRect(60, 140, W - 120, 3);
		// The table; the lit row steps through the library
		const lit = Math.floor(time / 0.7) % all.length;
		let n = 0;
		cols.forEach((col, c) => {
			const x = 60 + c * 590;
			let y = 210;
			for (const s of col) {
				g.textAlign = 'left';
				g.font = `400 34px ${DISPLAY}`;
				g.fillStyle = s.accent;
				g.fillText(s.name.toUpperCase(), x, y);
				y += 56;
				for (const game of s.games) {
					if (n === lit) {
						g.fillStyle = s.accent;
						g.globalAlpha = 0.22 + 0.1 * Math.sin(time * 8);
						g.fillRect(x - 14, y - 34, 560, 46);
						g.globalAlpha = 1;
						g.fillText('▶', x - 40, y);
					}
					g.font = `600 36px ${COND}`;
					g.fillStyle = s.accent;
					g.fillText(String(game.year), x, y);
					g.fillStyle = n === lit ? '#ffffff' : ICE;
					g.fillText(game.title.toUpperCase(), x + 96, y);
					y += 46;
					n++;
				}
				y += 30;
			}
		});
		// Ticker
		g.fillStyle = 'rgba(255,43,214,0.85)';
		g.fillRect(0, H - 90, W, 90);
		g.font = `600 52px ${COND}`;
		g.fillStyle = '#ffffff';
		g.textAlign = 'left';
		const span = g.measureText(ticker).width;
		for (let x = -((time * 160) % span); x < W; x += span) g.fillText(ticker, x, H - 28);
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// ---------- The bay ----------

export function arcadeBay(content: ArcadeContent) {
	return (kit: Kit): Interior => {
		const { world, mat, std, glow, add, put, box, rbox, rod, face } = kit;
		const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
		// A room lit by its neon: surfaces take little from the bright studio environment the engine provides
		const steel = std({ color: '#2a2e3a', roughness: 0.4, metalness: 0.8, envMapIntensity: 0.35 });
		const panel = std({ color: '#0d1020', roughness: 0.55, metalness: 0.4, envMapIntensity: 0.3 });
		const cyan = glow(CYAN, 2.0), magenta = glow(MAGENTA, 2.0), violet = glow(VIOLET, 2.0);
		const cyanSoft = glow(CYAN, 1.1), magentaSoft = glow(MAGENTA, 1.1), violetSoft = glow(VIOLET, 1.1);
		const seriesGlow = content.series.map((s) => glow(s.accent, 1.9));
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
		const up = new THREE.Vector3(0, 1, 0);

		// The poster atlas; until it loads the posters are dark
		const { cols, rows } = content.atlas;
		const atlas = kit.loader.load(content.atlas.src, () => kit.redraw());
		atlas.colorSpace = THREE.SRGBColorSpace;
		atlas.anisotropy = 8;
		const posterMat = new THREE.MeshBasicMaterial({ map: atlas, toneMapped: false, color: new THREE.Color(0.86, 0.86, 0.86) });
		const cell = (i: number) => [(i % cols) / cols, 1 - (Math.floor(i / cols) + 1) / rows, (i % cols + 1) / cols, 1 - Math.floor(i / cols) / rows];
		// A band across a poster at `at` (0 foot, 1 head), `frac` of its height: a screen's worth of its art
		const band = (i: number, at: number, frac: number) => {
			const [u0, v0, u1, v1] = cell(i), h = v1 - v0, c = Math.min(v1 - (h * frac) / 2, Math.max(v0 + (h * frac) / 2, v0 + h * at));
			return [u0, c - (h * frac) / 2, u1, c + (h * frac) / 2];
		};
		const games = content.series.flatMap((s, si) => s.games.map((game) => ({ game, accent: s.accent, si })));
		const posters = new Quads(), captions = captionSheet(games), capQuads = new Quads();
		const signs = signSheet([
			{ text: 'CALL OF DUTY', sub: `${content.series[0].games.length} campaigns  ·  ${content.series[0].games[0].year} – ${content.series[0].games.at(-1)!.year}`, color: content.series[0].accent },
			...content.series.slice(1, 5).map((s) => ({ text: s.name.toUpperCase(), color: s.accent })),
			{ text: 'FEATURED', color: VIOLET },
			{ text: 'THE ARCADE', sub: 'Habitat bay 5  ·  ML-1', color: MAGENTA },
			{ text: 'PRESS START', color: CYAN },
		]);
		const signQuads = new Quads();
		// A lit frame for a poster: a dark box with glowing edges in its series' colour
		const frame = (m: THREE.Matrix4, w: number, h: number, light: THREE.Material) => {
			const o = new THREE.Object3D();
			m.decompose(o.position, o.quaternion, o.scale);
			world.add(o);
			put(rbox(w + 0.16, h + 0.16, 0.1, panel, 0.03), o, 0, 0, -0.06);
			for (const [fw, fh, x, y] of [[w + 0.1, 0.025, 0, h / 2 + 0.05], [w + 0.1, 0.025, 0, -h / 2 - 0.05], [0.025, h + 0.1, w / 2 + 0.05, 0], [0.025, h + 0.1, -w / 2 - 0.05, 0]] as const) {
				put(new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.02), light), o, x, y, 0);
			}
		};

		// ---------- Hall: the vault, ribs with rings of light, the floor, catwalks along the walls ----------
		add(shell(RH, RH, TZ, Z1, 140), std({ map: vaultSheet(), roughness: 0.7, metalness: 0.3, side: THREE.BackSide }));
		for (let z = -9; z <= 15; z += 3) {
			add(new THREE.TorusGeometry(RH - 0.14, 0.14, 8, 110), steel, 0, 0, z);
			add(new THREE.TorusGeometry(RH - 0.32, 0.03, 6, 110), (z / 3) % 2 ? cyanSoft : magentaSoft, 0, 0, z);
		}
		// Neon tubes along the crown
		for (const [deg, m] of [[62, magenta], [80, cyan], [100, cyan], [118, magenta]] as const) {
			const a = (deg * Math.PI) / 180, r = RH - 0.55;
			add(new THREE.CylinderGeometry(0.04, 0.04, Z1 - TZ - 1, 10).rotateX(Math.PI / 2), m, Math.cos(a) * r, Math.sin(a) * r, (TZ + Z1) / 2);
			for (let z = TZ + 1; z < Z1; z += 3) rod(V(Math.cos(a) * r, Math.sin(a) * r, z), V(Math.cos(a) * (RH - 0.05), Math.sin(a) * (RH - 0.05), z), 0.02, steel);
		}
		const floorTex = floorSheet();
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, Z1 - Z0), std({ map: floorTex, emissiveMap: floorTex, emissive: '#ffffff', emissiveIntensity: 0.85, roughness: 0.6, metalness: 0.2, envMapIntensity: 0.3 }));
		floor.rotation.x = -Math.PI / 2;
		floor.position.set(0, FL, (Z0 + Z1) / 2);
		world.add(floor);
		// The left wall is one hex-panelled surface; the right is built around its alcoves
		const wallTex = hexSheet('rgba(45,226,255,0.35)', (Z1 - TZ) / 2, 2.6);
		const hexWall = std({ map: wallTex, emissive: '#ffffff', emissiveMap: wallTex, emissiveIntensity: 0.5, roughness: 0.5, metalness: 0.3, envMapIntensity: 0.3 });
		const lw = add(new THREE.PlaneGeometry(Z1 - TZ, 5.2), hexWall, WALL, FL + 2.6, (TZ + Z1) / 2);
		lw.rotation.y = -Math.PI / 2;
		for (const e of [-1, 1]) {
			const len = Z1 - TZ, zc = (TZ + Z1) / 2;
			// The ledge from the wall's top to the hull, a strip of light along it
			box(RH - WALL, 0.1, len, steel, e * (WALL + (RH - WALL) / 2), FL + 5.2, zc);
			box(0.04, 0.04, len, e > 0 ? cyan : magenta, e * (WALL - 0.03), FL + 5.14, zc);
			// The catwalk: a grated deck on brackets, railings, a glowing edge
			const cz0 = TZ + 0.4, cz1 = 13, cl = cz1 - cz0, cx = e * (WALL - 0.65);
			box(1.3, 0.07, cl, steel, cx, FL + 5.35, (cz0 + cz1) / 2);
			box(0.03, 0.03, cl, e > 0 ? cyanSoft : magentaSoft, e * (WALL - 1.32), FL + 5.3, (cz0 + cz1) / 2);
			for (let z = cz0 + 0.2; z <= cz1; z += 1.6) {
				rod(V(e * (WALL - 1.25), FL + 5.38, z), V(e * (WALL - 1.25), FL + 6.4, z), 0.022, steel);
				rod(V(e * WALL, FL + 4.6, z), V(e * (WALL - 1.25), FL + 5.32, z), 0.03, steel);
			}
			for (const y of [FL + 5.9, FL + 6.4]) rod(V(e * (WALL - 1.25), y, cz0), V(e * (WALL - 1.25), y, cz1), 0.025, steel);
		}

		// ---------- The tunnel: a hexagonal passage of chasing lights from the hatch to the hall ----------
		const hexV = (k: number) => V(Math.cos((k * Math.PI) / 3) * HEX, HEX_Y + Math.sin((k * Math.PI) / 3) * HEX, 0);
		const tunnelTex = hexSheet('rgba(45,226,255,0.45)', 2, 3.5);
		const tunnelMat = std({ map: tunnelTex, emissive: '#ffffff', emissiveMap: tunnelTex, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.3, envMapIntensity: 0.3 });
		const edge = (k: number, inset: number) => {
			const a = hexV(k), b = hexV(k + 1), mid = a.clone().add(b).multiplyScalar(0.5);
			const ang = Math.atan2(b.y - a.y, b.x - a.x), inward = V(-mid.x, HEX_Y - mid.y, 0).normalize();
			return { mid: mid.addScaledVector(inward, inset), ang };
		};
		for (let k = 0; k < 6; k++) {
			if (k === 4) continue; // the floor
			const { mid, ang } = edge(k, -0.04);
			add(new THREE.BoxGeometry(HEX, 0.06, TZ - Z0).rotateZ(ang), tunnelMat, mid.x, mid.y, (Z0 + TZ) / 2);
		}
		const chase: THREE.MeshBasicMaterial[] = [];
		for (let j = 0; j < 6; j++) {
			const z = Z0 + 1.6 + j * 1.0, light = glow(j % 2 ? MAGENTA : CYAN, 2);
			chase.push(light);
			for (let k = 0; k < 6; k++) {
				const outer = edge(k, 0.1), inner = edge(k, 0.27);
				if (k !== 4) add(new THREE.BoxGeometry(HEX + 0.12, 0.26, 0.28).rotateZ(outer.ang), steel, outer.mid.x, outer.mid.y, z);
				add(new THREE.BoxGeometry(HEX - (k === 4 ? 0.6 : 0.3), 0.05, 0.08).rotateZ(inner.ang), light, inner.mid.x, k === 4 ? FL + 0.02 : inner.mid.y, z);
			}
		}
		// The wall where the tunnel opens into the hall, the opening ringed in light
		const front = new THREE.Shape().absarc(0, 0, RH, 0, Math.PI * 2, false);
		front.holes.push(new THREE.Path([0, 1, 2, 3, 4, 5].map((k) => new THREE.Vector2(hexV(k).x, hexV(k).y)).reverse()));
		add(new THREE.ShapeGeometry(front, 64), std({ map: wallTex, emissive: '#ffffff', emissiveMap: wallTex, emissiveIntensity: 0.35, roughness: 0.6, metalness: 0.4, envMapIntensity: 0.3, side: THREE.DoubleSide }), 0, 0, TZ);
		// Hexagons of light ripple out from the opening on the hall's side
		for (const [k0, out, m] of [[1, 0.12, magenta], [1.32, 0, cyanSoft], [1.7, 0, magentaSoft]] as const) for (let k = 0; k < 6; k++) {
			const a = hexV(k), b = hexV(k + 1);
			if (k === 4) continue;
			const c = V(0, HEX_Y, 0), pa = a.clone().sub(c).multiplyScalar(k0).add(c), pb = b.clone().sub(c).multiplyScalar(k0).add(c);
			if (pa.y < FL || pb.y < FL) continue;
			const mid = pa.clone().add(pb).multiplyScalar(0.5), dir = pb.clone().sub(pa), n = V(mid.x, mid.y - HEX_Y, 0).normalize();
			mid.addScaledVector(n, out);
			add(new THREE.BoxGeometry(dir.length() + 0.08, 0.06, 0.06).rotateZ(Math.atan2(dir.y, dir.x)), m, mid.x, mid.y, TZ + 0.05);
		}
		// The hatch, and the bay's name on both ends of the tunnel
		const bulk = std({ color: '#0a0c18', roughness: 0.6, metalness: 0.4, envMapIntensity: 0.3 });
		const { door, wheel } = kit.hatch({ z: Z0, y: HATCH_Y, radius: RH, material: bulk });
		add(new THREE.CircleGeometry(RH, 96), bulk, 0, 0, Z1).rotation.y = Math.PI;
		signQuads.add(M(0, FL + 2.75, Z0 + 0.03), 3.6, 0.45, signs.uv(6));
		signQuads.add(M(0, HEX_Y + HEX * 0.87 + 0.75, TZ + 0.08), 6.4, 0.8, signs.uv(6));

		// ---------- Call of Duty down the left wall, in order, captions under each, its name above ----------
		const cod = games.filter((g) => g.si === 0);
		cod.forEach((g, i) => {
			const z = -9.9 + i * 1.7, idx = games.indexOf(g);
			frame(M(WALL - 0.06, FL + 2.2, z, -Math.PI / 2), PW, PH, seriesGlow[0]);
			posters.add(M(WALL - 0.12, FL + 2.2, z, -Math.PI / 2), PW, PH, cell(idx));
			capQuads.add(M(WALL - 0.04, FL + 0.82, z, -Math.PI / 2), CAP.w, CAP.h, captions.uv(idx));
			// Light fins between the posters
			if (i) box(0.05, 2.6, 0.04, cyanSoft, WALL - 0.05, FL + 2.0, z - 0.85);
		});
		signQuads.add(M(WALL - 0.03, FL + 4.3, 0.1, -Math.PI / 2), 8, 1, signs.uv(0));

		// ---------- The other series in alcoves down the right wall ----------
		const backX = -(WALL + 0.85);
		let z = TZ;
		const fin = (z0: number) => {
			box(0.85, 5.2, 0.6, panel, -(WALL + 0.425), FL + 2.6, z0 + 0.3);
			box(0.04, 3.3, 0.04, magenta, -(WALL - 0.02), FL + 1.65, z0 + 0.3);
		};
		// Laid from the tunnel end in reverse, so that facing the wall they read left to right, first series first,
		// and walking back down from the far end meets them in order
		for (let si = 4; si >= 1; si--) {
			const list = games.filter((g) => g.si === si).reverse(), n = list.length;
			const width = n * AW + (n - 1) * 0.35 + 0.6;
			fin(z);
			const z0 = z + 0.6, z1 = z0 + width, zc = (z0 + z1) / 2;
			// The alcove: its back wall, a lintel over the opening, a soffit with a line of light in the series' colour
			box(0.1, 3.3, width, panel, backX - 0.05, FL + 1.65, zc);
			box(0.85, 1.9, width, panel, -(WALL + 0.425), FL + 4.25, zc);
			box(0.85, 0.06, width, steel, -(WALL + 0.425), FL + 3.3, zc);
			box(0.05, 0.04, width - 0.2, seriesGlow[si], backX + 0.06, FL + 3.15, zc);
			list.forEach((g, k) => {
				const pz = z0 + 0.3 + AW / 2 + k * (AW + 0.35), idx = games.indexOf(g);
				frame(M(backX + 0.06, FL + 1.85, pz, Math.PI / 2), AW, AH, seriesGlow[si]);
				posters.add(M(backX + 0.12, FL + 1.85, pz, Math.PI / 2), AW, AH, cell(idx));
				capQuads.add(M(backX + 0.04, FL + 0.66, pz, Math.PI / 2), CAP.w * 0.9, CAP.h * 0.9, captions.uv(idx));
			});
			signQuads.add(M(-(WALL - 0.03), FL + 3.95, zc, Math.PI / 2), Math.min(4.2, width - 0.2), Math.min(4.2, width - 0.2) / 8, signs.uv(si));
			z = z1;
		}
		fin(z);
		// The wall on past the alcoves
		const rest = Z1 - (z + 0.6);
		box(0.1, 5.2, rest, panel, -WALL, FL + 2.6, z + 0.6 + rest / 2);
		box(0.04, 0.04, rest, magentaSoft, -(WALL - 0.06), FL + 3.3, z + 0.6 + rest / 2);
		box(0.06, 0.05, Z1 - TZ, magentaSoft, -(WALL - 0.02), FL + 0.06, (TZ + Z1) / 2);
		box(0.06, 0.05, Z1 - TZ, cyanSoft, WALL - 0.02, FL + 0.06, (TZ + Z1) / 2);

		// ---------- The featured pillar: four stand-alone favourites turning on a dais, rings of light around it ----------
		add(new THREE.CylinderGeometry(CAR.r, CAR.r + 0.1, 0.3, 64), steel, CAR.x, FL + 0.15, CAR.z);
		add(new THREE.CylinderGeometry(CAR.r + 0.35, CAR.r + 0.4, 0.1, 64), panel, CAR.x, FL + 0.05, CAR.z);
		add(new THREE.TorusGeometry(CAR.r - 0.05, 0.025, 6, 96).rotateX(Math.PI / 2), violet, CAR.x, FL + 0.31, CAR.z);
		for (let k = 0; k < 16; k++) {
			const a = (k / 16) * Math.PI * 2;
			add(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 6), k % 2 ? cyan : violet, CAR.x + Math.cos(a) * (CAR.r - 0.25), FL + 0.55, CAR.z + Math.sin(a) * (CAR.r - 0.25));
		}
		const pillar = new THREE.Group();
		pillar.position.set(CAR.x, FL + 0.3, CAR.z);
		pillar.userData.keep = true;
		world.add(pillar);
		put(new THREE.Mesh(new THREE.BoxGeometry(1.7, 3.2, 1.7), panel), pillar, 0, 1.6, 0);
		put(new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.12, 4, 1).rotateY(Math.PI / 4), steel), pillar, 0, 3.26, 0);
		put(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.03, 6, 48).rotateX(Math.PI / 2), violet), pillar, 0, 3.36, 0);
		const featured = new Quads();
		const fGames = games.filter((g) => g.si === content.series.length - 1);
		fGames.slice(0, 4).forEach((g, k) => {
			const a = (k * Math.PI) / 2, x = Math.sin(a) * 0.86, zz = Math.cos(a) * 0.86;
			featured.add(M(x, 1.75, zz, a), 1.5, 2.25, cell(games.indexOf(g)));
			for (const s of [-1, 1]) put(new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.4, 0.03), violet), pillar, x + Math.cos(a) * s * 0.8, 1.75, zz - Math.sin(a) * s * 0.8);
		});
		pillar.add(featured.mesh(posterMat));
		// The stand-alone captions on the dais's rim, one per side, turning with it
		const fCaps = new Quads();
		fGames.slice(0, 4).forEach((g, k) => {
			const a = (k * Math.PI) / 2;
			fCaps.add(M(Math.sin(a) * 0.86, 0.32, Math.cos(a) * 0.86, a), 1.5, 1.5 / 3.5, captions.uv(games.indexOf(g)));
		});
		const ringMat = (c: string, o: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.4), transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
		const rings: THREE.Mesh[] = [];
		for (const [r, y, c, o] of [[2.1, 0.9, CYAN, 0.35], [2.35, 2.3, VIOLET, 0.45], [1.8, 3.7, MAGENTA, 0.35]] as const) {
			const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 4, 96), ringMat(c, o));
			ring.position.set(CAR.x, FL + y, CAR.z);
			ring.rotation.x = Math.PI / 2;
			ring.userData.keep = true;
			world.add(ring);
			rings.push(ring);
		}
		signQuads.add(M(CAR.x, FL + 4.6, CAR.z, Math.PI), 3.2, 0.4, signs.uv(5));
		signQuads.add(M(CAR.x, FL + 4.6, CAR.z, 0), 3.2, 0.4, signs.uv(5));

		// ---------- The LAN island: eight stations back to back, monitors showing the games, chairs and keyboards ----------
		const deskZ = (LAN.z0 + LAN.z1) / 2, deskL = LAN.z1 - LAN.z0 - 0.4;
		box(1.9, 0.05, deskL, std({ color: '#111522', roughness: 0.35, metalness: 0.5 }), 0, FL + 0.75, deskZ);
		for (const e of [-1, 1]) {
			box(0.02, 0.03, deskL, e > 0 ? cyan : magenta, e * 0.96, FL + 0.72, deskZ);
			for (const zz of [LAN.z0 + 0.35, deskZ, LAN.z1 - 0.35]) box(0.06, 0.73, 0.06, steel, e * 0.85, FL + 0.365, zz);
		}
		box(0.04, 0.5, deskL, panel, 0, FL + 1.02, deskZ); // the divider down the middle
		const chairGeo = mergeGeometries([
			new RoundedBoxGeometry(0.56, 0.12, 0.54, 1, 0.04).translate(0, 0.5, 0),
			new RoundedBoxGeometry(0.56, 0.85, 0.12, 1, 0.04).rotateX(-0.12).translate(0, 1.0, -0.3),
			new RoundedBoxGeometry(0.34, 0.16, 0.1, 1, 0.03).rotateX(-0.12).translate(0, 1.5, -0.37),
			new THREE.CylinderGeometry(0.04, 0.04, 0.38, 8).translate(0, 0.26, 0),
			...[0, 1, 2, 3, 4].map((k) => new THREE.BoxGeometry(0.32, 0.04, 0.05).translate(0.16, 0.06, 0).rotateY((k / 5) * Math.PI * 2)),
		].map((g) => (g.index ? g.toNonIndexed() : g))); // rounded boxes come unindexed; the rest must match
		const stations: { x: number; z: number; e: number }[] = [];
		for (const e of [-1, 1]) for (let k = 0; k < 4; k++) stations.push({ x: e * 1.55, z: LAN.z0 + 0.75 + k * 1.2, e });
		const chairs = new THREE.InstancedMesh(chairGeo, std({ color: '#ffffff', roughness: 0.6, metalness: 0.1 }), stations.length);
		const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, 0.03, 0.46), std({ color: '#0b0d14', roughness: 0.4 }), stations.length);
		const keyLight = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.43).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8) }), stations.length);
		const hues = ['#ff2bd6', '#2de2ff', '#a46bff', '#b6ff3d'];
		const pick = [24, 25, 26, 27, 19, 20, 22, 17]; // the games on the eight monitors
		stations.forEach(({ x, z: sz, e }, i) => {
			chairs.setMatrixAt(i, m4.compose(V(x, FL, sz), q.setFromAxisAngle(up, -e * Math.PI / 2), ONE));
			chairs.setColorAt(i, col.set(i % 2 ? '#2a1030' : '#0f2030'));
			keys.setMatrixAt(i, m4.compose(V(e * 0.62, FL + 0.79, sz), q.identity(), ONE));
			keyLight.setMatrixAt(i, m4.compose(V(e * 0.62, FL + 0.806, sz), q.identity(), ONE));
			keyLight.setColorAt(i, col.set(hues[i % 4]));
			// The monitor, its stand, and on its screen a band of a game's art
			box(0.05, 0.42, 0.72, mat.dark, e * 0.12, FL + 1.25, sz);
			box(0.04, 0.3, 0.06, steel, e * 0.08, FL + 0.92, sz);
			posters.add(M(e * 0.146, FL + 1.25, sz, e * Math.PI / 2), 0.66, 0.37, band(pick[i % pick.length], 0.6, 0.37 / 0.66 / 1.5));
		});
		world.add(chairs, keys, keyLight);
		// Hexagonal light panels over the island
		const hexLines: THREE.Vector3[] = [];
		for (const [dx, dz] of [[0, 0], [1.35, 0], [-1.35, 0], [0.675, 1.17], [-0.675, 1.17], [0.675, -1.17], [-0.675, -1.17]]) {
			const hx = dx, hz = deskZ + dz, hy = FL + 6.3;
			add(new THREE.CylinderGeometry(0.72, 0.72, 0.08, 6), panel, hx, hy, hz);
			add(new THREE.RingGeometry(0.5, 0.64, 6).rotateX(Math.PI / 2), dx === 0 && dz === 0 ? cyanSoft : violetSoft, hx, hy - 0.045, hz);
			hexLines.push(V(hx, hy, hz), V(hx, Math.sqrt(RH * RH - hx * hx) - 0.1, hz));
		}
		world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(hexLines), new THREE.LineBasicMaterial({ color: '#3a3f55' })));

		// ---------- The lounge: two sofas facing the LED wall ----------
		const fabric = std({ color: '#2a1440', roughness: 0.9 });
		for (const e of [-1, 1]) {
			const s = put(new THREE.Group(), world, e * 2.0, FL, 12.3);
			put(rbox(2.6, 0.42, 0.9, fabric, 0.08), s, 0, 0.21, 0);
			put(rbox(2.6, 0.75, 0.22, fabric, 0.08), s, 0, 0.6, -0.4);
			for (const sx of [-1.3, 1.3]) put(rbox(0.22, 0.6, 0.9, fabric, 0.06), s, sx, 0.3, 0);
			box(2.6, 0.02, 0.02, e > 0 ? cyanSoft : magentaSoft, e * 2.0, FL + 0.03, 12.78);
		}

		// ---------- The far end: a stage under the LED wall, upright cabinets down both sides ----------
		box(12, 0.3, Z1 - 14.6, panel, 0, FL + 0.15, (14.6 + Z1) / 2);
		box(12, 0.03, 0.03, magenta, 0, FL + 0.29, 14.59);
		const board = libraryBoard(content);
		const led = put(face(board.tex, 10.4, 4.33, true), world, 0, FL + 3.0, Z1 - 0.23);
		led.rotation.y = Math.PI;
		put(rbox(10.8, 4.75, 0.3, mat.dark, 0.06), world, 0, FL + 3.0, Z1 - 0.05);
		for (const [w, h, x, y] of [[10.6, 0.04, 0, 2.21], [10.6, 0.04, 0, -2.21], [0.04, 4.46, 5.25, 0], [0.04, 4.46, -5.25, 0]] as const) box(w, h, 0.04, magenta, x, FL + 3.0 + y, Z1 - 0.26);
		kit.live(board, led, 1 / 10, 40, 5.5);
		signQuads.add(M(0, FL + 5.85, Z1 - 0.25, Math.PI), 4.8, 0.6, signs.uv(7));
		// Cabinets: a body, a slanted screen showing a game, a lit marquee with its title art, a stick and buttons
		const cabGeo = mergeGeometries([
			new THREE.BoxGeometry(0.78, 1.0, 0.7).translate(0, 0.5, 0),
			new THREE.BoxGeometry(0.78, 0.1, 0.34).rotateX(0.25).translate(0, 1.04, 0.36),
			new THREE.BoxGeometry(0.78, 0.72, 0.42).rotateX(-0.2).translate(0, 1.45, 0.02),
			new THREE.BoxGeometry(0.78, 0.38, 0.62).translate(0, 2.0, -0.05),
			new THREE.BoxGeometry(0.78, 0.24, 0.18).translate(0, 1.93, 0.3),
		]);
		const cabSpots: THREE.Matrix4[] = [];
		for (const e of [-1, 1]) for (let k = 0; k < 4; k++) cabSpots.push(M(e * (WALL - 0.5), FL, 13.6 + k * 1.0, -e * Math.PI / 2));
		const cabs = new THREE.InstancedMesh(cabGeo, std({ color: '#141828', roughness: 0.45, metalness: 0.3 }), cabSpots.length);
		const btn = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6) }), cabSpots.length * 4);
		const cabGames = [13, 16, 19, 22, 3, 8, 10, 21];
		cabSpots.forEach((cm, i) => {
			cabs.setMatrixAt(i, cm);
			const local = (x: number, y: number, zz: number, rx = 0) => cm.clone().multiply(M(x, y, zz, 0, rx));
			posters.add(local(0, 1.47, 0.24, -0.2), 0.62, 0.48, band(cabGames[i], 0.45, (0.48 / 0.62) / 1.5));
			posters.add(local(0, 1.93, 0.395), 0.74, 0.2, band(cabGames[i], 0.9, (0.2 / 0.74) / 1.5));
			for (let b = 0; b < 4; b++) {
				btn.setMatrixAt(i * 4 + b, local(-0.05 + b * 0.09, 1.1, 0.4, 0.25));
				btn.setColorAt(i * 4 + b, col.set(hues[(i + b) % 4]));
			}
			// Stripes of light down the sides
			const o = new THREE.Object3D();
			cm.decompose(o.position, o.quaternion, o.scale);
			world.add(o);
			for (const sx of [-0.4, 0.4]) put(new THREE.Mesh(new THREE.BoxGeometry(0.01, 1.8, 0.04), i < 4 ? magenta : cyan), o, sx, 1.1, 0.33);
		});
		world.add(cabs, btn);

		// ---------- All the posters, captions and signs, each set in one draw ----------
		world.add(posters.mesh(posterMat));
		world.add(capQuads.mesh(new THREE.MeshBasicMaterial({ map: captions.tex, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) })));
		pillar.add(fCaps.mesh(new THREE.MeshBasicMaterial({ map: captions.tex, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) })));
		world.add(signQuads.mesh(new THREE.MeshBasicMaterial({ map: signs.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(1.5, 1.5, 1.5) })));

		// ---------- Lights: a cold fill, cyan down the left, magenta down the right, violet over the island and the stage ----------
		world.add(new THREE.HemisphereLight('#6a70ff', '#1a0820', 0.6));
		for (const [c, x, y, zz, k, d] of [[CYAN, 5.4, FL + 4.6, -1, 45, 24], [MAGENTA, -5.4, FL + 4.6, -1, 45, 24], ['#c9b6ff', 0, FL + 5.4, 8.5, 38, 22], [VIOLET, 0, FL + 5.2, 13.6, 16, 16]] as const) {
			const l = new THREE.PointLight(c, k, d, 2);
			l.position.set(x, y, zz);
			world.add(l);
		}

		const chaseBase = chase.map((m) => m.color.clone());
		function update(_dt: number, time: number) {
			pillar.rotation.y = time * 0.32;
			rings.forEach((r, i) => { r.rotation.z = time * (i % 2 ? -0.5 : 0.4); r.rotation.x = Math.PI / 2 + Math.sin(time * 0.6 + i) * 0.08; });
			// A pulse runs down the tunnel toward the hall
			chase.forEach((m, j) => {
				const p = 0.5 + 0.5 * Math.cos((time * 2.4 - j * 0.9) % (Math.PI * 2));
				m.color.copy(chaseBase[j]).multiplyScalar(0.3 + 0.55 * p * p);
			});
		}

		return {
			code: 'VSL-06',
			name: 'The arcade, habitat bay 5',
			scale: 1,
			eye: EYE,
			spawn: V(0, EYE, Z0 + 1.4),
			spawnYaw: Math.PI,
			collide,
			hatch: { z: Z0, y: HATCH_Y, door, wheel },
			revealAt: 12,
			exposure: 1.0,
			update,
		};
	};
}

// ---------- Walking ----------

// Down the tunnel, then the hall around the dais, the island, the sofas, the stage and the cabinets
const blocks = [
	{ x0: -RH, x1: -1.75, z0: TZ - 0.25, z1: TZ + 0.05 },
	{ x0: 1.75, x1: RH, z0: TZ - 0.25, z1: TZ + 0.05 },
	{ x0: -1.95, x1: 1.95, z0: LAN.z0 - 0.1, z1: LAN.z1 + 0.1 },
	{ x0: -3.35, x1: -0.65, z0: 11.8, z1: 12.8 },
	{ x0: 0.65, x1: 3.35, z0: 11.8, z1: 12.8 },
	{ x0: WALL - 0.95, x1: WALL, z0: 13.1, z1: 17.1 },
	{ x0: -WALL, x1: -(WALL - 0.95), z0: 13.1, z1: 17.1 },
];
function collide(p: THREE.Vector3, radius: number) {
	p.z = THREE.MathUtils.clamp(p.z, Z0 + 0.3, 14.3);
	p.x = THREE.MathUtils.clamp(p.x, p.z < TZ - 0.2 ? -1.5 : -(WALL - 0.4), p.z < TZ - 0.2 ? 1.5 : WALL - 0.4);
	// The dais is round
	const dx = p.x - CAR.x, dz = p.z - CAR.z, d = Math.hypot(dx, dz), r = CAR.r + 0.4 + radius;
	if (d < r && d > 1e-4) { p.x = CAR.x + (dx / d) * r; p.z = CAR.z + (dz / d) * r; }
	pushOut(p, blocks, radius);
}
