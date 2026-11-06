// The vessel's fourth habitat bay: a map room inside a cylinder twenty-four metres across and thirty-eight long, kept
// like an old geographical society's library. A foyer by the hatch holds a pair of globes on stands and the plan
// chests; through an arch, a two-storey hall of bookcases, with galleries along both walls up two stairs, the pilot's
// travel stories on framed displays under them, a great map table in the middle with pins where the stories happened,
// and a globe turning overhead. Past a second arch, on a raised floor between cabinets of rolled maps, a split-flap
// board lists the journeys under a great screen with the introduction.
// Every book is one instance of a single box, and so is every rolled map: a few draw calls for thousands of them.
// Units are metres: +Z runs from the entrance hatch to the great screen, +Y is up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
	ICE, COND, DISPLAY, FONT,
	rng, canvas, tex, storyScreen, liveCanvas, shell, pushOut,
	type Panel, type Live, type Kit, type Interior,
} from './interior';

export type MapRoomContent = {
	panels: Panel[]; // the introduction first, for the great screen, then the stories for the walls
	pins: { label: string; note: string; lat: number; lon: number }[];
	board: { time: string; to: string; note: string; rec: string; status: string }[];
};

const RH = 12; // hull radius
const FL = -5.5; // floor height; the hull's axis is y = 0
const HW = Math.sqrt(RH * RH - FL * FL); // half the floor's width
const Z0 = -19, Z1 = 19; // entrance and far bulkheads
const EYE = 1.62; // above whichever floor the pilot stands on
const HATCH_Y = FL + 0.85;
const ARCHES = [-12, 10.2], ARCH_R = 11.4;
// The galleries: their deck's edge and height and extent; the stair up to each, a landing then a flight toward +Z.
// Both sides are mirrored, so these are given for +X.
const GY = FL + 3.6;
const GAL = { x: 6.6, z0: -11, z1: 9.6 };
const ST = { x0: 5.0, x1: 6.6, zl: -11, zt: -9.5, zb: -3.5 };
const PLINTH = 7.0; // the solid wall under each gallery, behind its bookcases
const DISPLAYS_Z = [0.0, 5.6]; // the story displays on each wall
const TABLE = { z: 2.1, w: 8.4, d: 4.2, y: FL + 0.88 };
const GLOBE = { y: FL + 10.5, z: 2.1, r: 1.8 };
const PLAT = { z0: 12.0, z1: 12.6 }; // two steps up to the far floor
const PY = FL + 0.7;
const SCREEN = { w: 12, h: 7.5, y: FL + 8.35, z: Z1 - 0.32 };
const BOARD = { w: 8.4, y: PY + 2.03, z: Z1 - 0.62 };
const CAB = { x: 9.0, z0: 12.8, z1: 17.6, h: 4.2 }; // the rolled-map cabinets
const ROSE_Z = -15.5;
const GOLD = '#c9a24a', WALNUT = '#3b2416', OXBLOOD = '#6e1f22';

// ---------- The world, for the table, the globes and the prints ----------

// Coastlines as [longitude, latitude] rings, simplified to a few dozen points each: enough for a map in the old style
const LAND: number[][][] = [
	// North America, Greenland, the Arctic islands
	[[-168, 66], [-162, 70], [-156, 71.3], [-140, 69.6], [-128, 70], [-115, 68.5], [-95, 72], [-85, 69.5], [-80, 63], [-94, 59], [-92, 57], [-82, 55], [-79, 51.5], [-77, 58], [-70, 61], [-64, 60], [-61, 56], [-56, 52], [-60, 47.5], [-66, 45], [-70, 43.5], [-70.5, 41.5], [-74, 40.5], [-76, 38], [-76, 35], [-81, 31.5], [-80.5, 25.3], [-82.5, 28], [-84, 30], [-89, 30.2], [-94, 29.5], [-97.5, 26], [-97.5, 21.5], [-95, 18.5], [-90.5, 21], [-87, 21.5], [-88, 16], [-83.5, 15], [-83.5, 11], [-79.5, 9], [-77.5, 8.5], [-80, 7.3], [-83, 8.5], [-86, 11.5], [-88, 13.3], [-92, 14.5], [-96, 15.7], [-105, 19.5], [-106, 23], [-112, 29], [-114.5, 31.5], [-112.5, 27], [-110, 23], [-112.5, 24.5], [-117, 32.5], [-120.5, 34.5], [-124, 40.5], [-124, 46], [-123, 48.5], [-127.5, 50.5], [-130, 54.5], [-135, 58], [-140, 59.8], [-147, 60.5], [-152, 59], [-158, 57], [-164, 54.6], [-158, 58.5], [-162, 60], [-165, 62.5], [-164.5, 64.5]],
	[[-73, 78], [-60, 82], [-35, 83.5], [-20, 82], [-18, 76], [-21, 70], [-25, 68.5], [-35, 65.5], [-43, 60], [-48, 61], [-52, 65], [-54, 69], [-56, 73], [-66, 76]],
	[[-80, 73.5], [-68, 70.5], [-62, 66.7], [-65, 63], [-72, 62.5], [-78, 64.5], [-88, 70]],
	[[-90, 76.5], [-62, 82.5], [-80, 83], [-95, 80]],
	[[-118, 72.5], [-101, 70], [-106, 68.5], [-118, 69.5]],
	[[-85, 22], [-80, 23.1], [-74.2, 20.2], [-77.5, 19.8], [-82, 22.5]],
	// South America
	[[-80, 0], [-81, -5], [-76, -14.5], [-70.5, -18.5], [-70.5, -25], [-71.6, -33], [-73.5, -37], [-73.5, -42], [-75.5, -48], [-74, -52], [-69, -55.5], [-66, -55], [-68.5, -52], [-65.5, -47.5], [-67.5, -46], [-63.5, -42.5], [-62, -39], [-57.5, -38], [-56.5, -36], [-53, -34], [-48.5, -26], [-41, -22], [-39, -13.5], [-35, -9], [-35, -5.5], [-39, -3], [-44, -2.5], [-50, 0], [-51, 4], [-55, 5.8], [-60, 8.5], [-63, 10.6], [-68, 10.6], [-72, 11.8], [-75.5, 10.5], [-77.5, 8.5], [-79, 1]],
	// Europe and Asia, with Arabia
	[[-9.5, 37], [-9, 43], [-1.5, 43.5], [-4.5, 48.5], [-1, 49.5], [2, 51], [5, 53.5], [8.5, 54], [8, 57], [10.5, 57.7], [12.5, 56], [10.5, 54.5], [14, 54], [19, 54.5], [21, 57], [24, 57.5], [23.5, 59.5], [29, 60], [22.5, 60.5], [21.5, 63.5], [25, 65.5], [21, 64.5], [17.5, 62.5], [18.5, 59.5], [16.5, 56.5], [12.5, 56.5], [11, 59], [5.5, 58.5], [5, 62], [10, 64], [14, 67.5], [19, 70], [24, 71], [31, 70.5], [41, 67], [44, 68.5], [53, 68.5], [60, 69], [68, 68.5], [73, 72.5], [80, 73.5], [87, 75], [100, 77], [113, 74], [129, 72.5], [141, 72.5], [150, 71.5], [160, 70], [170, 70], [180, 68.5], [180, 65], [174, 62], [163, 60], [162, 55], [156, 51], [156, 57.5], [163, 62], [150, 59.5], [143, 59.5], [135, 54.5], [141, 52.5], [140, 48], [132, 43], [129, 41], [129.5, 35.5], [126.5, 34.5], [126, 37.5], [124.5, 40], [121, 40.8], [118, 39], [121, 37], [120, 35], [121.5, 31.5], [122, 29], [119.5, 25.5], [116, 22.8], [110.5, 21], [108, 21.5], [106, 19], [109, 13], [109, 11.5], [105, 8.6], [103, 10.5], [100.5, 13.5], [99.5, 10], [103.5, 1.3], [101, 3], [98.5, 8], [98.5, 13], [97.5, 16.5], [94.5, 16], [92, 21.5], [90, 22], [87, 21.5], [86.5, 20], [80.5, 15.5], [80, 10], [77.5, 8], [76.5, 9.5], [73, 17], [72.5, 21], [70, 22.5], [67, 24.8], [61.5, 25.2], [57, 25.8], [56.5, 27.2], [52, 27.8], [50, 30], [48, 30], [50, 26.5], [51.5, 24], [56, 26], [57, 23.5], [59.8, 22.5], [57, 18.8], [55, 17], [52, 15.8], [45, 13], [43.5, 12.7], [42.8, 15], [39, 21.5], [35, 28], [32.5, 30], [34, 31.5], [35.5, 35.5], [36, 36.8], [30, 36.3], [27, 37], [26.3, 39.5], [29, 41], [26, 40.6], [23.5, 40], [24, 38], [21.5, 37], [21, 40], [19.5, 41.8], [15.5, 44], [13.5, 45.8], [12.3, 44.5], [16, 41.4], [18.5, 40], [16, 38], [15.6, 40], [12, 42], [10, 44], [7, 43.7], [3.2, 43.3], [3.2, 42], [0.5, 40.5], [-0.5, 38.3], [-2.2, 36.7], [-5.6, 36], [-7.5, 37.2]],
	[[-5.7, 50], [1.7, 51.3], [1.6, 52.8], [0, 53.5], [-1.6, 55.6], [-2, 57.7], [-3.3, 58.6], [-5, 58.6], [-6.2, 56.5], [-4.8, 55], [-3, 54], [-4.6, 53.3], [-4.6, 52], [-5.2, 51.7], [-3.5, 51.4]],
	[[-6, 52], [-6, 54], [-7.5, 55.2], [-10, 54], [-10.4, 51.9], [-8, 51.6]],
	[[-24, 65.5], [-22, 66.4], [-15, 66.5], [-13.6, 65], [-18.5, 63.4], [-22.5, 63.8]],
	[[130, 31], [132, 33.8], [135, 33.5], [140.5, 35.3], [141, 38.5], [141.5, 41], [140, 40.3], [139.5, 38], [136.8, 37.2], [133, 35.6], [130.8, 34]],
	[[140, 41.5], [141.5, 45.4], [145.5, 43.3], [143, 42]],
	[[79.8, 6], [80.2, 9.8], [81.9, 7.5], [81.5, 6.2]],
	[[120.1, 23], [121.6, 25.2], [121.5, 22]],
	// Africa and Madagascar
	[[-17, 21], [-17, 14.7], [-16.5, 12], [-13, 8], [-8, 4.5], [-3, 5], [2, 6.3], [6, 4.3], [9, 4], [9.8, 2], [9, -1], [11.8, -5], [13.4, -9], [11.8, -16.5], [14.5, -23], [17, -29], [18.5, -34.3], [20, -34.8], [25.5, -34], [30, -31.3], [32.7, -28], [35.3, -24], [35.5, -21], [39, -17], [40.6, -15], [40.5, -10.5], [39.3, -6], [41, -1.5], [44, 1.5], [48, 5], [51.2, 11.8], [45, 10.5], [43.3, 11.6], [41.8, 13.5], [39, 15.8], [37.3, 18.6], [37, 22], [35.5, 24], [33.6, 27.5], [32.5, 29.9], [29, 30.9], [25, 31.6], [20, 30.8], [20, 32.2], [15, 32.4], [11.5, 33.1], [10.2, 36.8], [5, 36.8], [-1, 35.2], [-5.9, 35.8], [-9.6, 30.4], [-13, 27.5]],
	[[49.3, -12], [50.5, -15.5], [49.7, -17], [47.5, -25], [45, -25.5], [43.3, -22], [44, -17], [46.3, -15.5]],
	// The islands of Southeast Asia
	[[95.3, 5.6], [98, 4], [104, -2], [106, -5.9], [102, -4], [96.5, 2]],
	[[105.5, -6.8], [114.5, -7.8], [114.5, -8.7], [106, -7.4]],
	[[109, 1.5], [110.5, -3], [116, -4], [118.5, 1], [117, 5.5], [115, 4.8], [111.5, 2.5]],
	[[131, -1.4], [137, -1.5], [142, -3], [147.5, -6], [150.5, -10.5], [146, -8.2], [143, -9], [138, -8.3], [135, -4.5], [132, -4]],
	[[120, 18.5], [122.3, 18.5], [124, 13], [121.6, 13.8], [120.5, 14.5]],
	// Australia and New Zealand
	[[114, -22], [114, -26.5], [115, -34], [118, -35], [123.5, -33.9], [129, -31.6], [131.5, -31.5], [135.5, -34.8], [138, -35.6], [140, -38], [145, -38.5], [150, -37.5], [153.2, -31], [153, -25], [149.5, -22], [146, -18.8], [145.3, -15], [142.5, -10.7], [141.5, -13.5], [140.8, -17.5], [137.5, -16], [136, -12], [131, -11.2], [129.5, -15], [126, -14], [122, -17.5], [121, -19.5]],
	[[145, -40.8], [148.3, -40.9], [148, -43.2], [146, -43.6]],
	[[172.7, -34.4], [178.5, -37.7], [177, -39.5], [175, -41.5], [173.8, -39.2]],
	[[172.7, -40.5], [174.3, -41.5], [171, -44.5], [169, -46.6], [166.5, -46], [168.3, -44]],
	// Antarctica, as a band
	[[-180, -90], [-180, -72], [-150, -75], [-120, -73], [-90, -72], [-60, -63.5], [-58, -64], [-62, -66], [-65, -69], [-60, -73.5], [-40, -78], [-20, -73], [0, -70], [30, -69.5], [60, -67], [90, -66], [120, -66.5], [150, -68.5], [165, -71], [170, -77], [180, -78], [180, -90]],
];

type Palette = { sea: string; seaEdge: string; land: string; coast: string; grid: string };

// The world in an equirectangular frame: longitude across from -180, latitude down from +90
function drawWorld(g: CanvasRenderingContext2D, W: number, H: number, p: Palette, seed: number) {
	const X = (lon: number) => ((lon + 180) / 360) * W, Y = (lat: number) => ((90 - lat) / 180) * H;
	const rand = rng(seed);
	g.fillStyle = p.sea;
	g.fillRect(0, 0, W, H);
	const path = () => {
		g.beginPath();
		for (const ring of LAND) ring.forEach(([lon, lat], i) => (i ? g.lineTo(X(lon), Y(lat)) : g.moveTo(X(lon), Y(lat))));
	};
	// Shading out to sea from every coast, then the land, then the ink of the coast
	g.lineJoin = 'round';
	for (const [w, a] of [[W / 90, 0.12], [W / 180, 0.18]] as const) {
		path();
		g.strokeStyle = p.seaEdge;
		g.globalAlpha = a;
		g.lineWidth = w;
		g.stroke();
	}
	g.globalAlpha = 1;
	path();
	g.fillStyle = p.land;
	g.fill();
	g.strokeStyle = p.coast;
	g.lineWidth = Math.max(1.5, W / 900);
	path();
	g.stroke();
	// Hatched relief across the land, faint
	g.save();
	path();
	g.clip();
	g.fillStyle = 'rgba(90,60,30,0.08)';
	for (let n = 0; n < W * 2; n++) g.fillRect(rand() * W, rand() * H, W / 300, 1);
	g.restore();
	// The graticule every fifteen degrees, the equator and the tropics stronger
	g.strokeStyle = p.grid;
	g.lineWidth = Math.max(1, W / 2400);
	for (let lon = -165; lon < 180; lon += 15) { g.beginPath(); g.moveTo(X(lon), 0); g.lineTo(X(lon), H); g.stroke(); }
	for (let lat = -75; lat < 90; lat += 15) { g.beginPath(); g.moveTo(0, Y(lat)); g.lineTo(W, Y(lat)); g.stroke(); }
	g.setLineDash([W / 200, W / 300]);
	for (const lat of [23.44, -23.44, 66.56]) { g.beginPath(); g.moveTo(0, Y(lat)); g.lineTo(W, Y(lat)); g.stroke(); }
	g.setLineDash([]);
	g.lineWidth = Math.max(1.5, W / 1200);
	g.beginPath(); g.moveTo(0, Y(0)); g.lineTo(W, Y(0)); g.stroke();
	return { X, Y };
}

// A compass rose: sixteen points, the cardinal ones long and split light and dark
function compassRose(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, ink: string, light: string, accent: string) {
	g.save();
	g.translate(cx, cy);
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2, len = i % 4 === 0 ? r : i % 2 === 0 ? r * 0.7 : r * 0.45, w = len * (i % 4 === 0 ? 0.16 : 0.12);
		g.save();
		g.rotate(a);
		g.fillStyle = i % 4 === 0 ? accent : ink;
		g.beginPath(); g.moveTo(0, -len); g.lineTo(w, 0); g.lineTo(0, 0); g.closePath(); g.fill();
		g.fillStyle = light;
		g.beginPath(); g.moveTo(0, -len); g.lineTo(-w, 0); g.lineTo(0, 0); g.closePath(); g.fill();
		g.restore();
	}
	g.strokeStyle = ink;
	g.lineWidth = r * 0.02;
	for (const k of [0.3, 1.08, 1.16]) { g.beginPath(); g.arc(0, 0, r * k, 0, Math.PI * 2); g.stroke(); }
	for (let i = 0; i < 64; i++) {
		const a = (i / 64) * Math.PI * 2, k = i % 4 ? 1.12 : 1.2;
		g.beginPath(); g.moveTo(Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08); g.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k); g.stroke();
	}
	g.fillStyle = ink;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.font = `400 ${Math.round(r * 0.22)}px ${DISPLAY}`;
	g.fillText('N', 0, -r * 1.34);
	g.restore();
}

// The map on the table: parchment, the pins' places marked, a dotted route between them, a cartouche and a compass rose
function tableSheet(pins: MapRoomContent['pins']) {
	const W = 3072, H = 1536;
	const { cv, g } = canvas(W, H);
	const { X, Y } = drawWorld(g, W, H, { sea: '#a9bcae', seaEdge: '#3f6466', land: '#ecd49a', coast: '#4a2f18', grid: 'rgba(90,60,35,0.35)' }, 3);
	// Age: a darker edge, a few stains
	const vg = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.62);
	vg.addColorStop(0, 'rgba(120,80,40,0)'); vg.addColorStop(1, 'rgba(90,55,25,0.45)');
	g.fillStyle = vg;
	g.fillRect(0, 0, W, H);
	const rand = rng(9);
	for (let n = 0; n < 14; n++) {
		const x = rand() * W, y = rand() * H, r = 40 + rand() * 120;
		const st = g.createRadialGradient(x, y, r * 0.6, x, y, r);
		st.addColorStop(0, 'rgba(120,80,40,0)'); st.addColorStop(0.9, 'rgba(120,80,40,0.08)'); st.addColorStop(1, 'rgba(120,80,40,0)');
		g.fillStyle = st;
		g.fillRect(x - r, y - r, r * 2, r * 2);
	}
	// The route between the pins, dotted in red, and each place's label
	g.strokeStyle = 'rgba(150,30,25,0.85)';
	g.lineWidth = 6;
	g.setLineDash([16, 12]);
	for (let i = 1; i < pins.length; i++) {
		const a = pins[i - 1], b = pins[i], mx = (X(a.lon) + X(b.lon)) / 2, my = (Y(a.lat) + Y(b.lat)) / 2 - 60;
		g.beginPath(); g.moveTo(X(a.lon), Y(a.lat)); g.quadraticCurveTo(mx + 80, my, X(b.lon), Y(b.lat)); g.stroke();
	}
	g.setLineDash([]);
	g.textBaseline = 'middle';
	for (const p of pins) {
		const x = X(p.lon), y = Y(p.lat);
		g.fillStyle = 'rgba(150,30,25,0.9)';
		g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
		g.fillStyle = '#3a2412';
		g.font = `600 44px ${COND}`;
		g.fillText(p.label.toUpperCase(), x + 30, y - 18);
		g.font = `italic 400 30px ${FONT}`;
		g.fillText(p.note, x + 30, y + 22);
	}
	// A cartouche in the South Atlantic, a compass rose in the South Pacific
	const cx = X(-28), cy = Y(-50), cw = 560, ch = 200;
	g.fillStyle = 'rgba(234,215,164,0.92)';
	g.strokeStyle = '#5a3d22';
	g.lineWidth = 5;
	g.beginPath(); g.roundRect(cx - cw / 2, cy - ch / 2, cw, ch, 30); g.fill(); g.stroke();
	g.lineWidth = 2;
	g.beginPath(); g.roundRect(cx - cw / 2 + 14, cy - ch / 2 + 14, cw - 28, ch - 28, 20); g.stroke();
	g.textAlign = 'center';
	g.fillStyle = '#3a2412';
	g.font = `400 54px ${DISPLAY}`;
	g.fillText('THE WORLD', cx, cy - 30);
	g.font = `italic 400 30px ${FONT}`;
	g.fillText('as walked by the pilot of ML-1', cx, cy + 34);
	g.textAlign = 'left';
	compassRose(g, X(-140), Y(-28), 150, '#4a2f18', '#efe0b8', OXBLOOD);
	g.strokeStyle = '#5a3d22';
	g.lineWidth = 10;
	g.strokeRect(5, 5, W - 10, H - 10);
	return tex(cv);
}

// The terrestrial globe's skin, in the colours of an old globe
function globeSheet() {
	const W = 2048, H = 1024;
	const { cv, g } = canvas(W, H);
	drawWorld(g, W, H, { sea: '#6f8c8a', seaEdge: '#2e4a4c', land: '#d9c18a', coast: '#3a2a18', grid: 'rgba(40,30,20,0.35)' }, 5);
	const t = tex(cv);
	t.wrapS = THREE.RepeatWrapping;
	return t;
}

// The celestial globe's: deep blue, stars, the ecliptic in gold
function celestialSheet() {
	const W = 1024, H = 512;
	const { cv, g } = canvas(W, H);
	const rand = rng(77);
	g.fillStyle = '#16233d';
	g.fillRect(0, 0, W, H);
	for (let n = 0; n < 700; n++) {
		const b = rand();
		g.fillStyle = `rgba(250,236,200,${0.3 + b * 0.7})`;
		g.beginPath(); g.arc(rand() * W, rand() * H, 0.6 + b * b * 2.4, 0, Math.PI * 2); g.fill();
	}
	g.strokeStyle = GOLD;
	g.lineWidth = 3;
	g.beginPath();
	for (let x = 0; x <= W; x += 8) { const y = H / 2 - Math.sin((x / W) * Math.PI * 2) * H * 0.13; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
	g.stroke();
	g.strokeStyle = 'rgba(201,162,74,0.35)';
	g.lineWidth = 1.5;
	for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo((i * W) / 12, 0); g.lineTo((i * W) / 12, H); g.stroke(); }
	const t = tex(cv);
	t.wrapS = THREE.RepeatWrapping;
	return t;
}

// ---------- Surfaces ----------

// The vault: walnut coffers with green panels and a gilt boss in each, between gilt ribs. u runs around from +X
// through +Y, v from the entrance to the far end.
function vaultSheet() {
	const W = 2048, H = 1024;
	const { cv, g } = canvas(W, H);
	const rand = rng(19);
	g.fillStyle = '#2a170d';
	g.fillRect(0, 0, W, H);
	const cols = 64, rows = 19, cw = W / cols, ch = H / rows;
	for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
		const x = i * cw, y = j * ch, k = (rand() - 0.5) * 6;
		g.fillStyle = `rgb(${58 + k},${36 + k * 0.7},${22 + k * 0.5})`;
		g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
		g.fillStyle = `rgb(${30 + k},${56 + k},${50 + k})`;
		g.fillRect(x + cw * 0.18, y + ch * 0.18, cw * 0.64, ch * 0.64);
		g.strokeStyle = 'rgba(201,162,74,0.55)';
		g.lineWidth = 1.5;
		g.strokeRect(x + cw * 0.16, y + ch * 0.16, cw * 0.68, ch * 0.68);
		g.fillStyle = 'rgba(201,162,74,0.8)';
		g.beginPath(); g.arc(x + cw / 2, y + ch / 2, Math.min(cw, ch) * 0.07, 0, Math.PI * 2); g.fill();
	}
	g.fillStyle = 'rgba(201,162,74,0.7)';
	g.fillRect(W / 4 - 3, 0, 6, H); // the crown
	const t = tex(cv);
	t.wrapS = THREE.RepeatWrapping;
	return t;
}

// The floor: oak laid on the diagonal, a red runner down the middle to a great rug under the map table, and a
// compass rose inlaid in the foyer. Canvas x follows world x; canvas y runs from the entrance (top) to the far end.
function floorSheet() {
	const L = Z1 - Z0, W = 2048, H = Math.round((W * L) / (2 * HW));
	const { cv, g } = canvas(W, H);
	const s = W / (2 * HW);
	const X = (x: number) => (x + HW) * s, Z = (z: number) => (z - Z0) * s;
	const rand = rng(29);
	g.fillStyle = '#4a2f1b';
	g.fillRect(0, 0, W, H);
	// Planks on the diagonal, alternating direction every course: a herringbone
	const pw = 0.09 * s, pl = 0.54 * s;
	g.save();
	for (let row = -2; row * pl * 0.7 < H + pl; row++) for (let col = -2; col * pw * 2 < W + pl; col++) {
		const x = col * pw * 2 + (row % 2) * pw, y = row * pl * 0.7, k = (rand() - 0.5) * 22;
		g.fillStyle = `rgb(${128 + k},${86 + k * 0.8},${50 + k * 0.6})`;
		g.save();
		g.translate(x, y);
		g.rotate(col % 2 ? Math.PI / 4 : -Math.PI / 4);
		g.fillRect(0, 0, pl, pw - 1.5);
		g.restore();
	}
	g.restore();
	for (let n = 0; n < 9000; n++) { g.fillStyle = `rgba(40,20,8,${0.04 + rand() * 0.06})`; g.fillRect(rand() * W, rand() * H, 1, 3 + rand() * 12); }
	// A rug with a border of medallions, and the runner that leads to it
	const rug = (x0: number, x1: number, z0: number, z1: number, field: string, border: string) => {
		g.fillStyle = border;
		g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
		const b = 0.32 * s;
		g.fillStyle = field;
		g.fillRect(X(x0) + b, Z(z0) + b, X(x1) - X(x0) - b * 2, Z(z1) - Z(z0) - b * 2);
		g.strokeStyle = GOLD;
		g.lineWidth = 3;
		g.strokeRect(X(x0) + b * 0.3, Z(z0) + b * 0.3, X(x1) - X(x0) - b * 0.6, Z(z1) - Z(z0) - b * 0.6);
		g.strokeRect(X(x0) + b, Z(z0) + b, X(x1) - X(x0) - b * 2, Z(z1) - Z(z0) - b * 2);
		g.fillStyle = 'rgba(201,162,74,0.55)';
		for (let x = X(x0) + b; x < X(x1) - b; x += b * 1.2) for (const y of [Z(z0) + b * 0.65, Z(z1) - b * 0.65]) { g.beginPath(); g.arc(x, y, b * 0.16, 0, Math.PI * 2); g.fill(); }
		// A lattice of diamonds across the field
		g.strokeStyle = 'rgba(255,255,255,0.05)';
		g.lineWidth = 2;
		const d = 0.6 * s;
		for (let x = X(x0) + b - (Z(z1) - Z(z0)); x < X(x1); x += d) {
			g.beginPath(); g.moveTo(x, Z(z0) + b); g.lineTo(x + (Z(z1) - Z(z0)), Z(z1) - b); g.stroke();
			g.beginPath(); g.moveTo(x + (Z(z1) - Z(z0)), Z(z0) + b); g.lineTo(x, Z(z1) - b); g.stroke();
		}
	};
	rug(-1.3, 1.3, -12.6, -2.2, OXBLOOD, '#3a1012');
	rug(-6.0, 6.0, -2.4, 6.6, '#1f2a44', '#3a1012');
	// The compass rose in the foyer, in brass and dark wood
	g.fillStyle = '#2a170d';
	g.beginPath(); g.arc(X(0), Z(ROSE_Z), 2.3 * s, 0, Math.PI * 2); g.fill();
	g.save();
	g.translate(X(0), Z(ROSE_Z));
	g.rotate(Math.PI); // north toward the far end
	compassRose(g, 0, 0, 1.6 * s, '#c9a24a', '#e9d9a8', '#8a6a2a');
	g.restore();
	g.save();
	g.translate(X(0), Z(-11.2));
	g.rotate(Math.PI); // reads the right way up walking in from the hatch
	g.textAlign = 'center';
	g.fillStyle = 'rgba(233,217,168,0.8)';
	g.font = `400 ${Math.round(0.34 * s)}px ${DISPLAY}`;
	g.fillText('THE MAP ROOM', 0, 0);
	g.restore();
	return tex(cv);
}

// Under the galleries: walnut boards, each with a gilt reveal
function panelSheet() {
	const { cv, g } = canvas(1024, 512);
	const rand = rng(41);
	g.fillStyle = '#1d110a';
	g.fillRect(0, 0, 1024, 512);
	for (let x = 0; x < 1024; x += 128) {
		const k = (rand() - 0.5) * 10;
		g.fillStyle = `rgb(${62 + k},${38 + k * 0.7},${24 + k * 0.5})`;
		g.fillRect(x + 6, 6, 116, 500);
		g.strokeStyle = 'rgba(201,162,74,0.45)';
		g.lineWidth = 2;
		g.strokeRect(x + 18, 18, 92, 476);
	}
	const t = tex(cv);
	t.wrapS = THREE.RepeatWrapping;
	return t;
}

// A book's spine: plain, with gilt bands near its head and foot. Tinted per book.
function spineSheet() {
	const { cv, g } = canvas(64, 256);
	g.fillStyle = '#c8c8c8';
	g.fillRect(0, 0, 64, 256);
	g.fillStyle = '#ffffff';
	for (const y of [20, 30, 222, 232]) g.fillRect(0, y, 64, 4);
	g.fillRect(14, 70, 36, 60);
	const t = tex(cv);
	t.anisotropy = 4;
	return t;
}

// Painted gold lettering, on a dark board where it hangs
function goldSign(text: string, sub: string, board = false) {
	const { cv, g } = canvas(2048, 512);
	if (board) {
		g.fillStyle = 'rgba(28,16,9,0.95)';
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

// ---------- The departures board ----------

// A split-flap board of the journeys. Every few seconds one row turns over: its flaps spin through letters, left to
// right, and settle on the row's text.
function departuresBoard(rows: MapRoomContent['board']): Live {
	const W = 2400, H = 760;
	const { g, t, begin } = liveCanvas(W, H, 0.5);
	const cols = [{ key: 'time', n: 5, label: 'TIME' }, { key: 'to', n: 9, label: 'DESTINATION' }, { key: 'note', n: 21, label: 'REMARKS' }, { key: 'rec', n: 2, label: 'REC' }, { key: 'status', n: 8, label: 'STATUS' }] as const;
	const cw = 40, gap = 14, x0 = (W - (cols.reduce((s, c) => s + c.n, 0) * cw + gap * (cols.length - 1))) / 2;
	const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const draw = (time: number) => {
		begin();
		g.fillStyle = '#0c0b0a';
		g.fillRect(0, 0, W, H);
		g.fillStyle = '#1a1714';
		g.fillRect(0, 0, W, 110);
		g.textBaseline = 'middle';
		g.font = `400 46px ${DISPLAY}`;
		g.fillStyle = '#f4d36b';
		g.textAlign = 'left';
		g.fillText('DEPARTURES', x0, 56);
		g.textAlign = 'right';
		g.font = `600 36px ${COND}`;
		g.fillStyle = ICE;
		g.fillText('ML-1  ·  THE MAP ROOM', W - x0, 56);
		// Column heads
		let cx = x0;
		g.textAlign = 'left';
		g.font = `600 26px ${COND}`;
		g.fillStyle = 'rgba(244,211,107,0.7)';
		for (const c of cols) { g.fillText(c.label, cx, 140); cx += c.n * cw + gap; }
		// The rows; one turns over every three and a half seconds
		const turning = Math.floor(time / 3.5) % rows.length, since = time % 3.5;
		const rand = rng(Math.floor(time * 12));
		g.textAlign = 'center';
		g.font = `600 46px ${COND}`;
		rows.forEach((row, r) => {
			const y = 180 + r * 112;
			let x = x0, i = 0;
			for (const c of cols) {
				const text = String(row[c.key]).toUpperCase().padEnd(c.n).slice(0, c.n);
				for (let k = 0; k < c.n; k++, i++) {
					const settled = r !== turning || since > 0.35 + i * 0.025;
					const ch = settled ? text[k] : glyphs[Math.floor(rand() * glyphs.length)];
					g.fillStyle = '#1f1c19';
					g.fillRect(x + 2, y, cw - 4, 92);
					g.fillStyle = '#121010';
					g.fillRect(x + 2, y + 45, cw - 4, 2);
					g.fillStyle = c.key === 'status' ? (row.status === 'BOARDING' ? '#7be08a' : '#f4d36b') : '#f2efe6';
					if (ch !== ' ') g.fillText(ch, x + cw / 2, y + 48);
					x += cw;
				}
				x += gap;
			}
		});
		t.needsUpdate = true;
	};
	return { tex: t, draw };
}

// ---------- The bay ----------

export function mapRoomBay(content: MapRoomContent) {
	return (kit: Kit): Interior => {
		const { world, mat, std, glow, add, put, box, rbox, rod, face } = kit;
		const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
		const walnut = std({ color: WALNUT, roughness: 0.55, metalness: 0.05 });
		const walnutDark = std({ color: '#21130b', roughness: 0.6, metalness: 0.05 });
		const oak = std({ color: '#8a5a32', roughness: 0.5, metalness: 0.03 });
		const gold = std({ color: GOLD, roughness: 0.32, metalness: 0.95 });
		const brass = std({ color: '#b58a3c', roughness: 0.3, metalness: 0.9 });
		const leather = std({ color: '#4a1c16', roughness: 0.6, metalness: 0.02 });
		const paper = std({ color: '#e6d6b0', roughness: 0.85, metalness: 0 });
		const warm = glow('#ffd9a0', 1.5), warmSoft = glow('#ffd9a0', 0.9);
		const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
		const up = new THREE.Vector3(0, 1, 0);
		const rand = rng(101);

		// ---------- Hull: the coffered vault, wooden ribs, the floor ----------
		add(shell(RH, RH, Z0, Z1, 160), std({ map: vaultSheet(), roughness: 0.75, metalness: 0.1, side: THREE.BackSide }));
		for (let z = -17; z <= 17; z += 4) {
			if (ARCHES.some((a) => Math.abs(a - z) < 0.8)) continue;
			add(new THREE.TorusGeometry(RH - 0.14, 0.15, 8, 120), walnutDark, 0, 0, z);
			add(new THREE.TorusGeometry(RH - 0.3, 0.025, 6, 120), gold, 0, 0, z);
		}
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, Z1 - Z0), std({ map: floorSheet(), roughness: 0.68, metalness: 0.02 }));
		floor.rotation.x = -Math.PI / 2;
		floor.position.set(0, FL, (Z0 + Z1) / 2);
		world.add(floor);

		// ---------- The hatch end, and the two arches: between the foyer and the hall, and before the far floor ----------
		const bulkMat = std({ color: '#2a170d', roughness: 0.7, metalness: 0.05 });
		const { door, wheel } = kit.hatch({ z: Z0, y: HATCH_Y, radius: RH, material: bulkMat });
		const hatchSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: goldSign('THE MAP ROOM', 'HABITAT BAY 4  ·  ML-1'), transparent: true, depthWrite: false }));
		hatchSign.position.set(0, FL + 6.8, Z0 + 0.03);
		world.add(hatchSign);
		const a0 = Math.asin(FL / ARCH_R);
		for (const z of ARCHES) {
			add(new THREE.TorusGeometry(ARCH_R, 0.42, 14, 120, Math.PI - 2 * a0).rotateZ(a0), walnut, 0, 0, z);
			for (const dz of [-0.22, 0.22]) add(new THREE.TorusGeometry(ARCH_R - 0.42, 0.05, 8, 120, Math.PI - 2 * a0).rotateZ(a0), gold, 0, 0, z + dz);
			for (let i = 1; i < 24; i++) {
				const a = a0 + (i / 24) * (Math.PI - 2 * a0);
				const coffer = box(0.5, 0.08, 0.5, gold, Math.cos(a) * (ARCH_R - 0.44), Math.sin(a) * (ARCH_R - 0.44), z);
				coffer.rotation.z = a + Math.PI / 2;
			}
		}
		const archSign = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: goldSign('THE MAP ROOM', 'VSL-05  ·  HABITAT BAY 4', true), transparent: true, depthWrite: false }));
		archSign.position.set(0, FL + 7.6, ARCHES[0] - 0.45);
		archSign.rotation.y = Math.PI;
		world.add(archSign);
		for (const s of [-2.6, 2.6]) rod(V(s, FL + 8.45, ARCHES[0] - 0.45), V(s, Math.sqrt((ARCH_R - 0.42) ** 2 - s * s), ARCHES[0] - 0.45), 0.015, brass);

		// ---------- The foyer: a terrestrial and a celestial globe on stands, plan chests along the walls ----------
		const globeTex = globeSheet();
		const tableTex = tableSheet(content.pins);
		const spinners: { o: THREE.Object3D; speed: number }[] = [];
		for (const [e, skin] of [[1, globeTex], [-1, celestialSheet()]] as const) {
			const stand = put(new THREE.Group(), world, e * 3.2, FL, ROSE_Z);
			// Three turned legs on a stretcher, a horizon ring, a brass meridian holding the ball at the earth's tilt
			for (let k = 0; k < 3; k++) {
				const a = (k / 3) * Math.PI * 2 + 0.4;
				put(strut(V(Math.cos(a) * 0.66, 0, Math.sin(a) * 0.66), V(Math.cos(a) * 0.56, 0.86, Math.sin(a) * 0.56), 0.035, walnut), stand);
				put(strut(V(Math.cos(a) * 0.64, 0.25, Math.sin(a) * 0.64), V(0, 0.25, 0), 0.02, walnut), stand);
			}
			put(new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.035, 8, 64).rotateX(Math.PI / 2), walnut), stand, 0, 0.88, 0);
			put(new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.012, 6, 64).rotateX(Math.PI / 2), gold), stand, 0, 0.91, 0);
			const tilt = put(new THREE.Group(), stand, 0, 0.88, 0);
			tilt.rotation.z = e * 0.41;
			tilt.userData.keep = true;
			put(new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.014, 6, 64, Math.PI * 1.4).rotateZ(-Math.PI * 0.2), brass), tilt);
			const ball = put(new THREE.Mesh(new THREE.SphereGeometry(0.48, 48, 32), std({ map: skin, roughness: 0.45, metalness: 0.05 })), tilt);
			spinners.push({ o: ball, speed: 0.05 * e });
		}
		const chestFront = (() => {
			const { cv, g } = canvas(512, 256);
			g.fillStyle = '#3b2416';
			g.fillRect(0, 0, 512, 256);
			for (let r = 0; r < 4; r++) {
				const y = 8 + r * 62;
				g.fillStyle = '#4a2e1c';
				g.fillRect(8, y, 496, 56);
				g.strokeStyle = 'rgba(201,162,74,0.6)';
				g.lineWidth = 2;
				g.strokeRect(14, y + 6, 484, 44);
				g.fillStyle = '#c9a24a';
				for (const x of [150, 362]) g.fillRect(x - 22, y + 24, 44, 8);
				g.fillStyle = '#e6d6b0';
				g.fillRect(244, y + 18, 24, 18);
			}
			return tex(cv);
		})();
		const chestMat = std({ map: chestFront, roughness: 0.55 });
		for (const e of [-1, 1]) for (const z of [-16.7, -14.2]) {
			put(rbox(0.9, 1.0, 2.2, walnut, 0.03), world, e * 9.15, FL + 0.5, z);
			const f = add(new THREE.PlaneGeometry(2.1, 0.95), chestMat, e * 8.69, FL + 0.5, z);
			f.rotation.y = -e * Math.PI / 2;
			put(rbox(1.0, 0.05, 2.3, oak, 0.015), world, e * 9.15, FL + 1.02, z);
			// A map laid out on the top, held flat by a brass weight
			const sheet = add(new THREE.PlaneGeometry(0.75, 1.1).rotateX(-Math.PI / 2), std({ map: tableTex, roughness: 0.8 }), e * 9.1, FL + 1.046, z);
			sheet.rotation.y = 0.12 * e;
			add(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 16), brass, e * 9.3, FL + 1.08, z + 0.35);
		}
		// Framed prints of the world above the chests, hung close against the curve of the hull
		for (const e of [-1, 1]) {
			const frame = new THREE.Group();
			frame.position.set(e * 11.25, FL + 3.0, -15.45);
			frame.rotation.y = -e * Math.PI / 2;
			world.add(frame);
			put(rbox(4.4, 2.4, 0.1, walnutDark, 0.03), frame, 0, 0, -0.05);
			put(new THREE.Mesh(new THREE.PlaneGeometry(4.0, 2.0), std({ map: tableTex, roughness: 0.8 })), frame, 0, 0, 0.004);
			for (const [w, h, x, y] of [[4.16, 0.04, 0, 1.06], [4.16, 0.04, 0, -1.06], [0.04, 2.16, 2.06, 0], [0.04, 2.16, -2.06, 0]] as const) put(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), gold), frame, x, y, 0.01);
		}

		// ---------- The galleries: a deck on each side, its fascia gilt, a balustrade of brass under a walnut rail ----------
		const gz = (GAL.z0 + GAL.z1) / 2, gl = GAL.z1 - GAL.z0;
		const deckTex = (() => {
			const { cv, g } = canvas(512, 512);
			const r = rng(57);
			for (let y = 0; y < 512; y += 32) for (let x = -r() * 200; x < 512; x += 120 + r() * 160) {
				const k = (r() - 0.5) * 14;
				g.fillStyle = `rgb(${110 + k},${72 + k * 0.8},${42 + k * 0.6})`;
				g.fillRect(x, y, 300, 30);
			}
			const t = tex(cv);
			t.wrapS = t.wrapT = THREE.RepeatWrapping;
			t.repeat.set(gl / 2.5, 2);
			return t;
		})();
		const deckMat = std({ map: deckTex, roughness: 0.5 });
		const panelMat = std({ map: panelSheet(), roughness: 0.6 });
		for (const e of [-1, 1]) {
			const xo = e * (GAL.x + 12.3) / 2;
			box(12.3 - PLINTH, GY - 0.3 - FL, gl, panelMat, e * (PLINTH + 12.3) / 2, (FL + GY - 0.3) / 2, gz); // the wall under the gallery
			box(12.3 - GAL.x, 0.3, gl, walnut, xo, GY - 0.15, gz);
			box(12.3 - GAL.x, 0.02, gl, deckMat, xo, GY + 0.01, gz);
			box(0.08, 0.36, gl, walnutDark, e * (GAL.x + 0.02), GY - 0.12, gz);
			for (const y of [GY - 0.26, GY + 0.03]) box(0.09, 0.025, gl, gold, e * (GAL.x + 0.03), y, gz);
			// Corbels under the deck's edge, between the bookcases and the displays
			for (let z = GAL.z0 + 0.6; z < GAL.z1; z += 2.4) {
				const corbel = box(0.14, 0.5, 0.14, walnutDark, e * (GAL.x + 0.2), GY - 0.5, z);
				corbel.rotation.z = -e * 0.5;
			}
			// The balustrade, leaving the landing open
			const rail = (z0: number, z1: number) => {
				rod(V(e * GAL.x, GY + 1.0, z0), V(e * GAL.x, GY + 1.0, z1), 0.045, walnut);
				rod(V(e * GAL.x, GY + 0.08, z0), V(e * GAL.x, GY + 0.08, z1), 0.03, brass);
				for (let z = z0; z <= z1 + 1e-3; z += 0.16) rod(V(e * GAL.x, GY + 0.08, z), V(e * GAL.x, GY + 0.98, z), 0.012, brass);
			};
			rail(ST.zt, GAL.z1);
			for (const z of [GAL.z0, GAL.z1]) {
				rod(V(e * GAL.x, GY + 1.0, z), V(e * 11.4, GY + 1.0, z), 0.045, walnut);
				for (let x = GAL.x; x < 11.4; x += 0.16) rod(V(e * x, GY + 0.08, z), V(e * x, GY + 0.98, z), 0.012, brass);
			}
			// The stair: a landing, then an open flight of oak treads with brass nosings on two sloping stringers, so
			// the bookcases show through it; a rail down its open side
			box(ST.x1 - ST.x0, GY - FL, ST.zt - ST.zl, panelMat, e * (ST.x0 + ST.x1) / 2, (FL + GY) / 2, (ST.zl + ST.zt) / 2);
			box(ST.x1 - ST.x0, 0.02, ST.zt - ST.zl, deckMat, e * (ST.x0 + ST.x1) / 2, GY + 0.01, (ST.zl + ST.zt) / 2);
			const n = 18, run = (ST.zb - ST.zt) / n, slope = Math.atan2(GY - FL, ST.zb - ST.zt), flight = Math.hypot(GY - FL, ST.zb - ST.zt);
			for (const x of [ST.x0 + 0.05, ST.x1 - 0.05]) {
				const stringer = box(0.1, 0.32, flight, walnutDark, e * x, (FL + GY) / 2 - 0.12, (ST.zt + ST.zb) / 2);
				stringer.rotation.x = slope;
			}
			for (let i = 0; i < n - 1; i++) {
				const top = GY - ((i + 1) * (GY - FL)) / n, z = ST.zt + (i + 0.5) * run;
				box(ST.x1 - ST.x0 - 0.12, 0.05, run + 0.03, oak, e * (ST.x0 + ST.x1) / 2, top - 0.025, z - 0.01);
				box(ST.x1 - ST.x0 - 0.12, 0.02, 0.03, brass, e * (ST.x0 + ST.x1) / 2, top + 0.005, z + run / 2 - 0.02);
			}
			const sx = e * ST.x0;
			rod(V(sx, GY + 1.0, ST.zl), V(sx, GY + 1.0, ST.zt), 0.045, walnut);
			rod(V(sx, GY + 1.0, ST.zt), V(sx, FL + 1.0, ST.zb), 0.045, walnut);
			rod(V(e * ST.x0, GY + 1.0, ST.zl), V(e * ST.x1, GY + 1.0, ST.zl), 0.045, walnut);
			for (let z = ST.zl; z <= ST.zb; z += 0.18) {
				const y = z <= ST.zt ? GY : THREE.MathUtils.lerp(GY, FL, (z - ST.zt) / (ST.zb - ST.zt));
				rod(V(sx, y, z), V(sx, y + 0.98, z), 0.012, brass);
			}
			for (let x = ST.x0; x <= ST.x1; x += 0.16) rod(V(e * x, GY, ST.zl), V(e * x, GY + 0.98, ST.zl), 0.012, brass);
			add(new THREE.SphereGeometry(0.09, 16, 12), gold, sx, FL + 1.1, ST.zb);
			box(0.16, 1.0, 0.16, walnutDark, sx, FL + 0.5, ST.zb);
		}

		// ---------- Bookcases: under each gallery and along the hull above it. Every book is one instance. ----------
		const shelf: [number, number, number, number, number, number, number][] = []; // x of face, facing sign, z0, z1, y0, rows, row height
		for (const e of [-1, 1]) {
			// Five rows under the gallery, their cornice clear of its deck
			shelf.push([e * 6.64, -e, GAL.z0 + 0.2, DISPLAYS_Z[0] - 2.5, FL + 0.12, 5, 0.58]);
			shelf.push([e * 6.64, -e, DISPLAYS_Z[1] + 2.5, GAL.z1 - 0.2, FL + 0.12, 5, 0.58]);
			shelf.push([e * 10.3, -e, GAL.z0 + 0.3, GAL.z1 - 0.3, GY + 0.1, 5, 0.5]);
		}
		const bookSpots: { x: number; y: number; z: number; d: number; h: number; t: number; c: THREE.Color }[] = [];
		const leathers = ['#5b1f1a', '#2e3b2a', '#1f2a44', '#6b4a2b', '#3a2417', '#7a5a2a', '#4a1c2c', '#2a2a2a', '#7d6a4a', '#8a3a22', '#244040'];
		for (const [xf, dir, z0, z1, y0, rows, rh] of shelf) {
			const depth = rh > 0.55 ? 0.34 : 0.3, back = xf - dir * (depth + 0.04);
			// The carcass: uprights every metre or so, a shelf under each row, a cornice and a plinth
			const len = z1 - z0, zc = (z0 + z1) / 2, bays = Math.max(1, Math.round(len / 1.05));
			box(0.03, rows * rh + 0.18, len, walnutDark, back, y0 + (rows * rh) / 2, zc);
			for (let r = 0; r <= rows; r++) box(depth + 0.04, 0.035, len, walnut, xf - dir * (depth / 2 + 0.02), y0 + r * rh, zc);
			for (let b = 0; b <= bays; b++) box(depth + 0.06, rows * rh + 0.12, 0.05, walnut, xf - dir * (depth / 2 + 0.02), y0 + (rows * rh) / 2, z0 + (b * len) / bays);
			box(depth + 0.12, 0.16, len + 0.1, walnutDark, xf - dir * (depth / 2 + 0.02), y0 + rows * rh + 0.1, zc);
			box(depth + 0.1, 0.03, len + 0.08, gold, xf - dir * (depth / 2 + 0.02), y0 + rows * rh + 0.02, zc);
			// The books, standing in runs with the odd gap
			for (let r = 0; r < rows; r++) for (let b = 0; b < bays; b++) {
				const bz0 = z0 + (b * len) / bays + 0.04, bz1 = z0 + ((b + 1) * len) / bays - 0.04;
				let z = bz0 + rand() * 0.05;
				while (z < bz1 - 0.03) {
					if (rand() < 0.03) { z += 0.06 + rand() * 0.14; continue; }
					const t = 0.022 + rand() * 0.05;
					if (z + t > bz1) break;
					const h = rh * (0.58 + rand() * 0.32), d = depth * (0.72 + rand() * 0.22);
					bookSpots.push({ x: xf - dir * (d / 2 + 0.015), y: y0 + r * rh + 0.0175, z: z + t / 2, d, h, t, c: col.set(leathers[Math.floor(rand() * leathers.length)]).multiplyScalar(0.8 + rand() * 0.4).clone() });
					z += t + 0.002;
				}
			}
		}
		const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), std({ map: spineSheet(), roughness: 0.75, metalness: 0.05 }), bookSpots.length);
		bookSpots.forEach((b, i) => {
			books.setMatrixAt(i, m4.compose(V(b.x, b.y, b.z), q.identity(), V(b.d, b.h, b.t)));
			books.setColorAt(i, b.c);
		});
		world.add(books);
		// Rolling ladders on the upper cases, on a brass rail along their tops
		for (const e of [-1, 1]) {
			rod(V(e * 10.18, GY + 2.62, GAL.z0 + 0.3), V(e * 10.18, GY + 2.62, GAL.z1 - 0.3), 0.02, brass);
			for (const z of [-6, 4]) {
				const top = V(e * 10.16, GY + 2.62, z), foot = V(e * 9.35, GY, z);
				for (const dz of [-0.22, 0.22]) rod(top.clone().setZ(z + dz), foot.clone().setZ(z + dz), 0.022, oak);
				for (let k = 1; k < 9; k++) rod(top.clone().lerp(foot, k / 9).setZ(z - 0.22), top.clone().lerp(foot, k / 9).setZ(z + 0.22), 0.012, oak);
			}
		}
		// Reading chairs at each gallery's far end, a small table and a lamp between them
		const armchair = mergeGeometries([
			new RoundedBoxGeometry(0.8, 0.22, 0.8, 2, 0.06).translate(0, 0.32, 0),
			new RoundedBoxGeometry(0.8, 0.7, 0.18, 2, 0.06).translate(0, 0.62, -0.34),
			new RoundedBoxGeometry(0.16, 0.42, 0.8, 2, 0.05).translate(-0.36, 0.48, 0),
			new RoundedBoxGeometry(0.16, 0.42, 0.8, 2, 0.05).translate(0.36, 0.48, 0),
		].map((g) => g.toNonIndexed()));
		const chairSpots: [number, number, number][] = [];
		for (const e of [-1, 1]) {
			chairSpots.push([e * 9.4, 7.6, -e * Math.PI / 2 + e * 0.5], [e * 9.4, 9.0, -e * Math.PI / 2 - e * 0.5]);
			put(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 24), oak), world, e * 9.6, GY + 0.58, 8.3);
			add(new THREE.CylinderGeometry(0.03, 0.05, 0.56, 10), walnut, e * 9.6, GY + 0.28, 8.3);
			add(new THREE.CylinderGeometry(0.02, 0.06, 0.4, 12), brass, e * 9.6, GY + 0.8, 8.3);
			add(new THREE.CylinderGeometry(0.1, 0.2, 0.22, 20, 1, true), std({ color: '#e9d9b0', roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color('#ffcf8a'), emissiveIntensity: 0.6 }), e * 9.6, GY + 1.08, 8.3);
		}
		const armchairs = new THREE.InstancedMesh(armchair, leather, chairSpots.length);
		chairSpots.forEach(([x, z, r], i) => armchairs.setMatrixAt(i, m4.compose(V(x, GY, z), q.setFromAxisAngle(up, r), one)));
		world.add(armchairs);

		// ---------- The stories on framed displays under the galleries, each under a picture lamp ----------
		// Up the left wall from the table, then down the right
		const SW = 4.2, SH = 2.625, sy = FL + 1.85;
		const place = { code: 'VSL-05', name: 'The map room' };
		const stories = content.panels.slice(1, 5);
		stories.forEach((p, i) => {
			const e = i < 2 ? 1 : -1, z = i < 2 ? DISPLAYS_Z[i] : DISPLAYS_Z[3 - i];
			const group = new THREE.Group();
			group.position.set(e * (PLINTH - 0.06), sy, z);
			group.rotation.y = -e * Math.PI / 2;
			put(rbox(SW + 0.36, SH + 0.36, 0.12, walnutDark, 0.04), group, 0, 0, -0.07);
			for (const [w, h, x, y] of [[SW + 0.14, 0.03, 0, SH / 2 + 0.07], [SW + 0.14, 0.03, 0, -SH / 2 - 0.07], [0.03, SH + 0.14, SW / 2 + 0.07, 0], [0.03, SH + 0.14, -SW / 2 - 0.07, 0]] as const) {
				put(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), gold), group, x, y, 0);
			}
			put(face(storyScreen(p, i + 1, content.panels.length, i % 2 === 0, kit.redraw, place), SW, SH, false), group, 0, 0, 0.004);
			put(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.1), brass), group, 0, SH / 2 + 0.3, 0.2);
			put(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.015, 0.06), warm), group, 0, SH / 2 + 0.265, 0.22);
			world.add(group);
		});
		// Pilasters between the displays and at the ends of the cases
		for (const e of [-1, 1]) for (const z of [DISPLAYS_Z[0] - 2.42, (DISPLAYS_Z[0] + DISPLAYS_Z[1]) / 2, DISPLAYS_Z[1] + 2.42]) {
			box(0.3, GY - 0.3 - FL, 0.36, walnut, e * 6.82, (FL + GY - 0.3) / 2, z);
			box(0.36, 0.2, 0.42, gold, e * 6.82, FL + 0.1, z);
			box(0.38, 0.22, 0.44, gold, e * 6.82, GY - 0.42, z);
		}

		// ---------- The map table, its pins and its props; the globe that turns over it ----------
		const tw = TABLE.w, td = TABLE.d, ty = TABLE.y;
		put(rbox(tw + 0.5, 0.12, td + 0.5, walnut, 0.04), world, 0, ty - 0.06, TABLE.z);
		box(tw + 0.56, 0.03, td + 0.56, gold, 0, ty - 0.13, TABLE.z);
		const top = add(new THREE.PlaneGeometry(tw, td), std({ map: tableTex, roughness: 0.8, metalness: 0, color: new THREE.Color(0.86, 0.86, 0.86) }), 0, ty + 0.003, TABLE.z);
		top.rotation.set(-Math.PI / 2, 0, Math.PI); // north toward the far end, west on the left walking in
		for (const [x, z] of [[-tw / 2, -td / 2], [tw / 2, -td / 2], [-tw / 2, td / 2], [tw / 2, td / 2]]) {
			add(new THREE.CylinderGeometry(0.14, 0.1, ty - 0.12 - FL, 16), walnutDark, x * 0.92, (FL + ty - 0.12) / 2, TABLE.z + z * 0.85);
			add(new THREE.SphereGeometry(0.16, 16, 12), walnutDark, x * 0.92, FL + 0.16, TABLE.z + z * 0.85);
		}
		box(tw * 0.9, 0.08, 0.1, walnutDark, 0, FL + 0.3, TABLE.z);
		// Pins where the stories happened: brass pins, red flags, a red thread from one to the next
		const pinAt = (lat: number, lon: number) => V(tw / 2 - ((lon + 180) / 360) * tw, ty, TABLE.z + (lat / 90) * (td / 2));
		const flagMat = std({ color: '#9a1f18', roughness: 0.7, side: THREE.DoubleSide });
		const pinPts = content.pins.map((p) => pinAt(p.lat, p.lon));
		for (const p of pinPts) {
			add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), brass, p.x, ty + 0.15, p.z);
			add(new THREE.SphereGeometry(0.025, 12, 8), gold, p.x, ty + 0.3, p.z);
			add(new THREE.PlaneGeometry(0.14, 0.09), flagMat, p.x - 0.07, ty + 0.25, p.z);
		}
		for (let i = 1; i < pinPts.length; i++) {
			const a = pinPts[i - 1].clone().setY(ty + 0.22), b = pinPts[i].clone().setY(ty + 0.22);
			const mid = a.clone().lerp(b, 0.5).setY(ty + 0.12);
			add(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.006, 5, false), std({ color: '#b3261e', roughness: 0.6 }));
		}
		// A brass compass, a magnifying glass, rolled charts, and a banker's lamp at each end
		add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 32), brass, -2.6, ty + 0.02, TABLE.z - 1.4);
		add(new THREE.CircleGeometry(0.14, 32).rotateX(-Math.PI / 2), std({ color: '#efe6cf', roughness: 0.6 }), -2.6, ty + 0.041, TABLE.z - 1.4);
		add(new THREE.BoxGeometry(0.02, 0.005, 0.22), mat.red, -2.6, ty + 0.045, TABLE.z - 1.4).rotation.y = 0.5;
		add(new THREE.TorusGeometry(0.1, 0.012, 8, 32).rotateX(-Math.PI / 2), brass, 1.6, ty + 0.03, TABLE.z - 1.3);
		add(new THREE.CircleGeometry(0.095, 32).rotateX(-Math.PI / 2), mat.glass, 1.6, ty + 0.032, TABLE.z - 1.3);
		add(new THREE.CylinderGeometry(0.018, 0.022, 0.24, 10).rotateZ(Math.PI / 2), walnut, 1.82, ty + 0.03, TABLE.z - 1.34).rotation.y = 0.3;
		for (const [x, z, r] of [[3.2, TABLE.z + 1.5, 0.3], [3.3, TABLE.z + 1.66, 0.2], [-3.4, TABLE.z + 1.4, -0.2]] as const) {
			const roll = add(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 16).rotateZ(Math.PI / 2), paper, x, ty + 0.05, z);
			roll.rotation.y = r;
		}
		for (const e of [-1, 1]) {
			const lx = e * 3.55, lz = TABLE.z - 1.6;
			add(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 20), brass, lx, ty + 0.02, lz);
			add(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 8), brass, lx, ty + 0.2, lz);
			const shade = add(new THREE.CylinderGeometry(0.08, 0.13, 0.36, 24, 1, true).rotateZ(Math.PI / 2), std({ color: '#1c5a3a', roughness: 0.2, metalness: 0.1, side: THREE.DoubleSide, emissive: new THREE.Color('#2a7a4c'), emissiveIntensity: 0.5 }), lx, ty + 0.38, lz);
			shade.rotation.y = Math.PI / 2;
			add(new THREE.BoxGeometry(0.3, 0.01, 0.1), warmSoft, lx, ty + 0.32, lz);
		}
		// Chairs along both long sides
		const chairGeo = mergeGeometries([
			new THREE.BoxGeometry(0.46, 0.05, 0.44).translate(0, 0.46, 0),
			new THREE.BoxGeometry(0.46, 0.5, 0.04).translate(0, 0.74, -0.21),
			...[[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]].map(([x, z]) => new THREE.BoxGeometry(0.04, 0.46, 0.04).translate(x, 0.23, z)),
			...[-0.12, 0, 0.12].map((x) => new THREE.BoxGeometry(0.03, 0.4, 0.02).translate(x, 0.72, -0.2)),
		].map((g) => g.toNonIndexed()));
		const chairs = new THREE.InstancedMesh(chairGeo, walnut, 6);
		[-2.8, 0, 2.8].forEach((x, i) => {
			chairs.setMatrixAt(i, m4.compose(V(x, FL, TABLE.z - td / 2 - 0.55), q.identity(), one));
			chairs.setMatrixAt(i + 3, m4.compose(V(x, FL, TABLE.z + td / 2 + 0.55), q.setFromAxisAngle(up, Math.PI), one));
		});
		world.add(chairs);
		// The great globe, hung from the crown on rods, turning on its tilted axis within a brass meridian and horizon
		const hang = put(new THREE.Group(), world, 0, GLOBE.y, GLOBE.z);
		put(new THREE.Mesh(new THREE.TorusGeometry(GLOBE.r + 0.12, 0.04, 8, 96), brass), hang);
		put(new THREE.Mesh(new THREE.TorusGeometry(GLOBE.r + 0.22, 0.05, 8, 96).rotateX(Math.PI / 2), brass), hang);
		put(new THREE.Mesh(new THREE.TorusGeometry(GLOBE.r + 0.22, 0.015, 6, 96).rotateX(Math.PI / 2), gold), hang, 0, 0.06, 0);
		for (let k = 0; k < 4; k++) {
			const a = (k / 4) * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * (GLOBE.r + 0.22), z = Math.sin(a) * (GLOBE.r + 0.22);
			rod(V(x, GLOBE.y, GLOBE.z + z), V(x * 0.2, Math.sqrt(RH * RH - (x * 0.2) ** 2) - 0.15, GLOBE.z + z * 0.2), 0.018, brass);
		}
		const axis = put(new THREE.Group(), world, 0, GLOBE.y, GLOBE.z);
		axis.rotation.z = 0.41;
		axis.userData.keep = true;
		const earth = put(new THREE.Mesh(new THREE.SphereGeometry(GLOBE.r, 96, 64), std({ map: globeTex, roughness: 0.42, metalness: 0.05 })), axis);
		spinners.push({ o: earth, speed: 0.04 });
		for (const s of [-1, 1]) put(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10), brass), axis, 0, s * (GLOBE.r + 0.08), 0);

		// ---------- The far floor: two steps up, cabinets of rolled maps either side, the board and the great screen ----------
		for (const [z0, y] of [[PLAT.z0, FL + 0.35], [PLAT.z1, PY]] as const) {
			box(HW * 2, y - FL, Z1 - z0, walnut, 0, (FL + y) / 2, (z0 + Z1) / 2);
			box(HW * 2, 0.02, Z1 - z0, deckMat, 0, y + 0.01, (z0 + Z1) / 2);
			box(HW * 2, 0.03, 0.04, brass, 0, y - 0.01, z0 + 0.02);
		}
		// Each cabinet a grid of pigeonholes, most holding a few rolled maps
		const rolls: { x: number; y: number; z: number; r: number; len: number }[] = [];
		const cc = 7, cr = 8, cl = CAB.z1 - CAB.z0, cwid = cl / cc, chh = CAB.h / cr, cd = 0.6;
		for (const e of [-1, 1]) {
			const xf = e * CAB.x, xc = e * (CAB.x + cd / 2);
			box(0.03, CAB.h, cl, walnutDark, e * (CAB.x + cd), PY + CAB.h / 2, (CAB.z0 + CAB.z1) / 2);
			for (let r = 0; r <= cr; r++) box(cd, 0.03, cl, walnut, xc, PY + r * chh, (CAB.z0 + CAB.z1) / 2);
			for (let c = 0; c <= cc; c++) box(cd, CAB.h, 0.03, walnut, xc, PY + CAB.h / 2, CAB.z0 + c * cwid);
			box(cd + 0.14, 0.2, cl + 0.14, walnutDark, xc, PY + CAB.h + 0.1, (CAB.z0 + CAB.z1) / 2);
			box(cd + 0.12, 0.03, cl + 0.12, gold, xc, PY + CAB.h + 0.01, (CAB.z0 + CAB.z1) / 2);
			for (let r = 0; r < cr; r++) for (let c = 0; c < cc; c++) {
				const n = Math.floor(rand() * 4);
				for (let k = 0; k < n; k++) {
					const rr = 0.035 + rand() * 0.035;
					rolls.push({ x: xf + e * (cd / 2 - 0.08 + rand() * 0.16), y: PY + r * chh + 0.02 + rr + (k % 2) * rr * 1.6, z: CAB.z0 + c * cwid + 0.12 + rand() * (cwid - 0.24), r: rr, len: cd * (0.85 + rand() * 0.4) });
				}
			}
		}
		const rollMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2), paper, rolls.length);
		const parchment = ['#e6d6b0', '#d9c49a', '#efe4c8', '#cdb88a'];
		rolls.forEach((r, i) => {
			rollMesh.setMatrixAt(i, m4.compose(V(r.x, r.y, r.z), q.identity(), V(r.len, r.r, r.r)));
			rollMesh.setColorAt(i, col.set(parchment[i % parchment.length]));
		});
		world.add(rollMesh);
		// The far bulkhead, panelled in walnut
		const far = add(new THREE.ShapeGeometry(new THREE.Shape().absarc(0, 0, RH, 0, Math.PI * 2, false), 96), bulkMat, 0, 0, Z1);
		far.rotation.y = Math.PI;
		// The great screen with the introduction, in a gilt frame; it is always on, and can be read from the foyer
		const intro = face(storyScreen(content.panels[0], 0, content.panels.length, true, kit.redraw, place), SCREEN.w, SCREEN.h, true);
		intro.position.set(0, SCREEN.y, SCREEN.z);
		intro.rotation.y = Math.PI;
		world.add(intro);
		put(rbox(SCREEN.w + 0.8, SCREEN.h + 0.8, 0.26, walnutDark, 0.06), world, 0, SCREEN.y, Z1 - 0.16);
		for (const [w, h, x, y] of [[SCREEN.w + 0.5, 0.07, 0, SCREEN.h / 2 + 0.25], [SCREEN.w + 0.5, 0.07, 0, -SCREEN.h / 2 - 0.25], [0.07, SCREEN.h + 0.5, SCREEN.w / 2 + 0.25, 0], [0.07, SCREEN.h + 0.5, -SCREEN.w / 2 - 0.25, 0]] as const) {
			box(w, h, 0.05, gold, x, SCREEN.y + y, SCREEN.z - 0.01);
		}
		// The departures board below it, in a dark case
		const dep = departuresBoard(content.board);
		const bh = BOARD.w * (760 / 2400);
		const boardGroup = put(new THREE.Group(), world, 0, BOARD.y, BOARD.z);
		boardGroup.rotation.y = Math.PI;
		put(rbox(BOARD.w + 0.4, bh + 0.4, 0.4, std({ color: '#141210', roughness: 0.5, metalness: 0.4 }), 0.05), boardGroup, 0, 0, -0.22);
		put(new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, bh), new THREE.MeshBasicMaterial({ map: dep.tex, color: new THREE.Color(0.92, 0.92, 0.92) })), boardGroup, 0, 0, 0.0);
		for (const s of [-1, 1]) box(0.12, BOARD.y - bh / 2 - PY, 0.12, brass, s * (BOARD.w / 2 - 0.4), (PY + BOARD.y - bh / 2) / 2, BOARD.z + 0.05);
		kit.live(dep, boardGroup, 1 / 12, 40, 4.5);

		// ---------- Lamps and lights: warm, as in a library at evening ----------
		// Lanterns down both aisles on long rods, sconces between the upper cases
		const lantern = (x: number, y: number, z: number) => {
			rod(V(x, y + 0.35, z), V(x, Math.sqrt(RH * RH - x * x) - 0.1, z), 0.012, brass);
			add(new THREE.CylinderGeometry(0.12, 0.2, 0.12, 6), brass, x, y + 0.3, z);
			add(new THREE.CylinderGeometry(0.17, 0.14, 0.5, 6, 1, true), std({ color: '#ffe8c0', roughness: 0.3, side: THREE.DoubleSide, emissive: new THREE.Color('#ffc878'), emissiveIntensity: 1.1 }), x, y, z);
			add(new THREE.CylinderGeometry(0.15, 0.1, 0.08, 6), brass, x, y - 0.28, z);
			for (let k = 0; k < 6; k++) {
				const a = (k / 6) * Math.PI * 2;
				rod(V(x + Math.cos(a) * 0.17, y - 0.25, z + Math.sin(a) * 0.17), V(x + Math.cos(a) * 0.19, y + 0.25, z + Math.sin(a) * 0.19), 0.008, brass);
			}
		};
		// Spread outward toward the far end, so none hangs between the foyer and the great screen
		for (const [x, z] of [[4.3, -15.5], [4.3, -7], [4.6, 6.5], [5.8, 13.4]]) for (const e of [-1, 1]) lantern(e * x, FL + 6.4, z);
		for (const e of [-1, 1]) for (let z = -8; z <= 7; z += 5) {
			box(0.06, 0.3, 0.12, brass, e * 10.22, GY + 2.95, z);
			add(new THREE.SphereGeometry(0.09, 14, 10), warm, e * 10.1, GY + 3.12, z);
		}
		world.add(new THREE.HemisphereLight('#ffe9cc', '#3a2a1c', 0.5));
		for (const [x, y, z, k, d] of [[0, FL + 6.2, -15.5, 22, 14], [0, FL + 6.2, -6.5, 42, 22], [0, FL + 8.4, 5.5, 30, 22], [0, FL + 6.2, 14.5, 34, 20], [8.6, GY + 2.8, 0, 14, 12], [-8.6, GY + 2.8, 0, 14, 12]] as const) {
			const l = new THREE.PointLight('#ffd9a8', k, d, 2);
			l.position.set(x, y, z);
			world.add(l);
		}

		function update(_dt: number, time: number) {
			for (const s of spinners) s.o.rotation.y = time * s.speed;
		}

		return {
			code: 'VSL-05',
			name: 'The map room, habitat bay 4',
			scale: 1,
			eye: EYE,
			ground,
			spawn: V(0, 0, Z0 + 1.4),
			spawnYaw: Math.PI,
			collide,
			hatch: { z: Z0, y: HATCH_Y, door, wheel },
			revealAt: 11,
			exposure: 1.0,
			readFrom: 40, // the great screen can be opened from the foyer
			update,
		};
	};
}

// A cylinder between two points, in whatever group it is put in
function strut(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) {
	const d = b.clone().sub(a);
	const g = new THREE.CylinderGeometry(r, r, d.length(), 8);
	g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
	g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
	return new THREE.Mesh(g, m);
}

// ---------- Walking ----------

// The hall's floor, each gallery up its stair, and the far floor's two steps
function ground(p: THREE.Vector3) {
	const ax = Math.abs(p.x);
	if (ax > GAL.x && p.z > GAL.z0 && p.z < GAL.z1) return GY;
	if (ax >= ST.x0 && ax <= ST.x1) {
		if (p.z >= ST.zl && p.z <= ST.zt) return GY;
		if (p.z > ST.zt && p.z < ST.zb) return THREE.MathUtils.lerp(GY, FL, (p.z - ST.zt) / (ST.zb - ST.zt));
	}
	if (p.z > PLAT.z1) return PY;
	if (p.z > PLAT.z0) return FL + 0.35;
	return FL;
}

// Both sides mirrored: the gallery's edge (open at its landing) and ends, the stair's open side and the landing's end,
// the chairs at the gallery's end, the plan chests, the arches' feet, the map cabinets; then the table and its chairs
const blocks = [
	...[-1, 1].flatMap((e) => {
		const side = (a: number, b: number, z0: number, z1: number) => (e > 0 ? { x0: a, x1: b, z0, z1 } : { x0: -b, x1: -a, z0, z1 });
		return [
			side(GAL.x - 0.06, GAL.x + 0.06, ST.zt, GAL.z1),
			side(GAL.x, 13, GAL.z0 - 0.06, GAL.z0 + 0.06),
			side(GAL.x, 13, GAL.z1 - 0.06, GAL.z1 + 0.06),
			side(ST.x0 - 0.06, ST.x0 + 0.06, ST.zl, ST.zb),
			side(ST.x0, ST.x1, ST.zl - 0.06, ST.zl + 0.06),
			side(8.8, 13, 7.1, 9.5),
			...[-6, 4].map((z) => side(9.2, 13, z - 0.3, z + 0.3)), // the ladders' feet
			side(8.6, 13, -17.9, -13.0),
			...ARCHES.map((z) => side(9.6, 13, z - 0.45, z + 0.45)),
			side(CAB.x - 0.05, 13, CAB.z0 - 0.05, CAB.z1 + 0.05),
		];
	}),
	{ x0: -TABLE.w / 2 - 0.3, x1: TABLE.w / 2 + 0.3, z0: TABLE.z - TABLE.d / 2 - 0.85, z1: TABLE.z + TABLE.d / 2 + 0.85 },
];
function collide(p: THREE.Vector3, radius: number) {
	p.z = THREE.MathUtils.clamp(p.z, Z0 + 0.3, Z1 - 1.25);
	const lim = ground(p) === GY ? 9.95 : HW - 0.6;
	p.x = THREE.MathUtils.clamp(p.x, -lim, lim);
	if (ground(p) === FL) for (const e of [-1, 1]) {
		const dx = p.x - e * 3.2, dz = p.z - ROSE_Z, d = Math.hypot(dx, dz), r = 0.7 + radius;
		if (d < r && d > 1e-4) { p.x = e * 3.2 + (dx / d) * r; p.z = ROSE_Z + (dz / d) * r; }
	}
	pushOut(p, blocks, radius);
}
