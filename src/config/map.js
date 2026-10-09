// City grid + terrain feature configuration. All units are meters.
// The city is a square grid of blocks separated by wide roads. Every block is
// fully surrounded by road, so every building can be driven around.

export const MAP = {
  blocks: 12,            // blocks per side
  pitch: 80,             // distance between road centerlines
  roadWidth: 22,         // asphalt width between curbs
  curbHeight: 0.22,      // sidewalk height (drive-over bump)
  half: 480,             // outermost road centerline (blocks * pitch / 2)
  wallInner: 516,        // inner face of the perimeter brick wall
  wallThickness: 6,
  wallHeight: 6,
  plazaHalf: 80,         // central plaza (blocks removed) half-size
  googleRadius: 26,      // central landmark island radius
  blockSize: 58,         // pitch - roadWidth
};

// Block (i, j) center in world space. i -> x, j -> z, both 0..blocks-1.
export function blockCenter(i, j) {
  return {
    x: -MAP.half + MAP.pitch / 2 + i * MAP.pitch,
    z: -MAP.half + MAP.pitch / 2 + j * MAP.pitch,
  };
}

export function isPlazaBlock(i, j) {
  const c = blockCenter(i, j);
  return Math.abs(c.x) < MAP.plazaHalf && Math.abs(c.z) < MAP.plazaHalf;
}

// Ramps / elevated sections. All axis-aligned and placed mid-block on roads.
//  axis: 'x' means the ramp rises while travelling +x (dir=1) or -x (dir=-1).
//  kind: 'jump' (wedge with a drop-off) or 'hump' (up, flat elevated deck, down).
// `at` is the road centerline coordinate, `from` the start along the road,
// `lane` offsets the ramp across the road (so it can be bypassed).
export const RAMPS = [
  { kind: 'jump', axis: 'z', dir: -1, at: -240, from: 212, len: 16, width: 10, height: 2.6, lane: 5 },
  { kind: 'jump', axis: 'x', dir: 1, at: 160, from: -295, len: 16, width: 10, height: 2.6, lane: -5 },
  { kind: 'jump', axis: 'z', dir: 1, at: 320, from: -140, len: 16, width: 10, height: 2.6, lane: -5 },
  { kind: 'jump', axis: 'x', dir: -1, at: -320, from: 145, len: 16, width: 10, height: 2.6, lane: 5 },
  // Elevated "skyway" decks spanning full road width between intersections
  { kind: 'hump', axis: 'x', dir: 1, at: -480, from: -148, len: 56, width: 22, height: 5, up: 18, flat: 20 },
  { kind: 'hump', axis: 'z', dir: 1, at: 480, from: 172, len: 56, width: 22, height: 5, up: 18, flat: 20 },
];

// Decorative neon tunnels over road segments (side walls are the block curbs).
export const TUNNELS = [
  { axis: 'x', at: 480, from: -148, to: -92 },
  { axis: 'z', at: -480, from: 92, to: 148 },
];

export const SPAWN = { x: 0, z: 230, heading: Math.PI }; // facing north toward Google
