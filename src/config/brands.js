// Structured data table for every company building.
// Unofficial fan/hackathon project: brand names are used only as labels on
// stylised buildings and link to each company's own official website.
//
// Fields:
//   name      display name / sign text
//   district  district id (see DISTRICTS)
//   url       official website (verified to resolve)
//   style     building archetype used by the builder
//   size      [width, depth, height] footprint in meters (must fit a 58m block)
//   sign      { bg, fg, font, accent? } sign styling
// Position + collision bounds are filled in by layoutBrands() (block assignment).

import { MAP, blockCenter, isPlazaBlock } from './map.js';

export const DISTRICTS = {
  tech: {
    name: 'Technology & Online Services', short: 'TECH DISTRICT',
    color: 0x2f8cff, accent: 0x7fe7ff, angle: 330,
  },
  social: {
    name: 'Social Media & Communication', short: 'SOCIAL DISTRICT',
    color: 0xff2fb4, accent: 0xb44dff, angle: 30,
  },
  disney: {
    name: 'Disney & Entertainment', short: 'ENTERTAINMENT DISTRICT',
    color: 0xa95cff, accent: 0xffd36b, angle: 90,
  },
  gaming: {
    name: 'Video Games & Gaming', short: 'GAMING DISTRICT',
    color: 0x39ff6a, accent: 0xff3355, angle: 150,
  },
  insurance: {
    name: 'Insurance Companies', short: 'INSURANCE DISTRICT',
    color: 0x2fd6a0, accent: 0xffd23f, angle: 210,
  },
  food: {
    name: 'Fast Food, Restaurants & Coffee', short: 'FOOD STREET',
    color: 0xff7a1a, accent: 0xffe14d, angle: 270,
  },
};

export const GOOGLE = {
  name: 'Google', district: 'center', url: 'https://www.google.com',
};

export const BRANDS = [
  // --- Technology & Online Services ---
  { name: 'Amazon', district: 'tech', url: 'https://www.amazon.com', style: 'tower', size: [36, 36, 70],
    sign: { bg: '#131921', fg: '#ffffff', accent: '#ff9900', font: '900 120px Arial' } },
  { name: 'eBay', district: 'tech', url: 'https://www.ebay.com', style: 'tower', size: [34, 34, 52],
    sign: { bg: '#ffffff', fg: 'multi:#e53238,#0064d2,#f5af02,#86b817', font: '900 150px Arial' } },
  { name: 'Wikipedia', district: 'tech', url: 'https://www.wikipedia.org', style: 'tower', size: [32, 32, 60],
    sign: { bg: '#f8f9fa', fg: '#202122', font: '400 110px Georgia' } },
  { name: 'National Geographic', district: 'tech', url: 'https://www.nationalgeographic.com', style: 'tower', size: [36, 30, 48],
    sign: { bg: '#000000', fg: '#ffffff', accent: '#ffce00', frame: '#ffce00', font: '700 64px Georgia' } },
  { name: 'Kickstarter', district: 'tech', url: 'https://www.kickstarter.com', style: 'tower', size: [32, 32, 44],
    sign: { bg: '#05ce78', fg: '#04261a', font: '900 96px Arial' } },
  { name: 'Spotify', district: 'tech', url: 'https://www.spotify.com', style: 'tower', size: [34, 34, 58],
    sign: { bg: '#121212', fg: '#1ed760', font: '900 130px Arial' } },
  { name: 'Cisco', district: 'tech', url: 'https://www.cisco.com', style: 'tower', size: [34, 34, 66],
    sign: { bg: '#ffffff', fg: '#049fd9', font: '700 140px Arial' } },
  { name: 'Apple', district: 'tech', url: 'https://www.apple.com', style: 'glasscube', size: [38, 38, 34],
    sign: { bg: '#0b0b0f', fg: '#f5f5f7', font: '500 140px Helvetica, Arial' } },

  // --- Social Media & Communication ---
  { name: 'YouTube', district: 'social', url: 'https://www.youtube.com', style: 'screens', size: [36, 36, 46],
    sign: { bg: '#ff0000', fg: '#ffffff', font: '900 130px Arial' } },
  { name: 'Facebook', district: 'social', url: 'https://www.facebook.com', style: 'screens', size: [36, 34, 54],
    sign: { bg: '#1877f2', fg: '#ffffff', font: '900 120px Arial' } },
  { name: 'X', district: 'social', url: 'https://x.com', style: 'screens', size: [32, 32, 60],
    sign: { bg: '#000000', fg: '#ffffff', font: '900 200px Arial' } },
  { name: 'Instagram', district: 'social', url: 'https://www.instagram.com', style: 'screens', size: [34, 34, 42],
    sign: { bg: 'grad:#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5', fg: '#ffffff', font: 'italic 700 115px Georgia' } },
  { name: 'Snapchat', district: 'social', url: 'https://www.snapchat.com', style: 'screens', size: [30, 30, 36],
    sign: { bg: '#fffc00', fg: '#000000', font: '900 110px Arial' } },
  { name: 'Pinterest', district: 'social', url: 'https://www.pinterest.com', style: 'screens', size: [32, 32, 40],
    sign: { bg: '#e60023', fg: '#ffffff', font: '900 110px Arial' } },
  { name: 'Reddit', district: 'social', url: 'https://www.reddit.com', style: 'screens', size: [32, 32, 38],
    sign: { bg: '#ff4500', fg: '#ffffff', font: '900 140px Arial' } },

  // --- Disney & Entertainment ---
  { name: 'Disney', district: 'disney', url: 'https://www.disney.com', style: 'castle', size: [44, 40, 52],
    sign: { bg: '#0b1d5e', fg: '#ffffff', accent: '#9ad0ff', font: 'italic 700 140px Georgia' } },
  { name: 'Disneyland', district: 'disney', url: 'https://disneyland.disney.go.com', style: 'castle', size: [44, 40, 44],
    sign: { bg: '#3a0d63', fg: '#ffe6a8', accent: '#ff7ad9', font: 'italic 700 110px Georgia' } },
  { name: 'Pixar', district: 'disney', url: 'https://www.pixar.com', style: 'dome', size: [40, 40, 30],
    sign: { bg: '#ffffff', fg: '#111111', font: '700 150px Arial' } },
  { name: 'Marvel', district: 'disney', url: 'https://www.marvel.com', style: 'theater', size: [40, 32, 34],
    sign: { bg: '#ec1d24', fg: '#ffffff', font: '900 150px Impact, Arial Black' } },
  { name: 'Lucasfilm', district: 'disney', url: 'https://www.lucasfilm.com', style: 'spire', size: [34, 34, 62],
    sign: { bg: '#000000', fg: '#ffe81f', font: '700 104px Georgia' } },
  { name: 'The Muppets', district: 'disney', url: 'https://muppets.disney.com', style: 'theater', size: [38, 30, 28],
    sign: { bg: '#1c8c3c', fg: '#fff6c8', accent: '#ff4f9a', font: '900 96px Arial' } },

  // --- Video Games ---
  { name: 'GameStop', district: 'gaming', url: 'https://www.gamestop.com', style: 'arcade', size: [36, 32, 30],
    sign: { bg: '#000000', fg: '#ffffff', accent: '#e4002b', font: '900 110px Arial' } },
  { name: 'Steam', district: 'gaming', url: 'https://store.steampowered.com', style: 'arcade', size: [34, 34, 46],
    sign: { bg: 'grad:#171a21,#1b2838,#2a475e', fg: '#c7d5e0', accent: '#66c0f4', font: '900 140px Arial' } },
  { name: 'Xbox', district: 'gaming', url: 'https://www.xbox.com', style: 'arcade', size: [36, 36, 40],
    sign: { bg: '#107c10', fg: '#ffffff', font: '900 150px Arial' } },
  { name: 'EA Games', district: 'gaming', url: 'https://www.ea.com', style: 'arcade', size: [34, 34, 50],
    sign: { bg: '#ff4747', fg: '#ffffff', font: '900 120px Arial' } },
  { name: 'Nintendo', district: 'gaming', url: 'https://www.nintendo.com', style: 'arcade', size: [38, 32, 34],
    sign: { bg: '#e60012', fg: '#ffffff', font: '900 110px Arial' } },

  // --- Fast Food, Restaurants & Coffee ---
  { name: "McDonald's", district: 'food', url: 'https://www.mcdonalds.com', style: 'store', size: [36, 28, 12],
    sign: { bg: '#da291c', fg: '#ffc72c', font: '900 105px Arial' } },
  { name: 'Burger King', district: 'food', url: 'https://www.bk.com', style: 'store', size: [36, 28, 12],
    sign: { bg: '#f5ebdc', fg: '#d62300', accent: '#ff8732', font: '900 100px Arial' } },
  { name: "Wendy's", district: 'food', url: 'https://www.wendys.com', style: 'store', size: [34, 28, 11],
    sign: { bg: '#ffffff', fg: '#e2203d', font: 'italic 900 120px Georgia' } },
  { name: 'Starbucks', district: 'food', url: 'https://www.starbucks.com', style: 'store', size: [32, 28, 13],
    sign: { bg: '#00704a', fg: '#ffffff', font: '700 110px Arial' } },
  { name: 'KFC', district: 'food', url: 'https://www.kfc.com', style: 'store', size: [32, 28, 12],
    sign: { bg: '#a3080c', fg: '#ffffff', font: '900 170px Arial' } },

  // --- Insurance ---
  { name: 'Manulife', district: 'insurance', url: 'https://www.manulife.com', style: 'office', size: [36, 36, 74],
    sign: { bg: '#00a758', fg: '#ffffff', font: '700 130px Arial' } },
  { name: 'Sun Life', district: 'insurance', url: 'https://www.sunlife.com', style: 'office', size: [36, 36, 66],
    sign: { bg: '#ffffff', fg: '#004c6c', accent: '#ffcb05', font: '700 130px Arial' } },
  { name: 'Intact Insurance', district: 'insurance', url: 'https://www.intact.ca', style: 'office', size: [36, 36, 58],
    sign: { bg: '#ffffff', fg: '#cc0033', font: '700 90px Arial' } },
];

// Compass angle in degrees: 0 = north (-z), 90 = east (+x).
export function compassAngle(x, z) {
  let a = (Math.atan2(x, -z) * 180) / Math.PI;
  if (a < 0) a += 360;
  return a;
}

export function districtAt(x, z) {
  if (Math.abs(x) < MAP.plazaHalf + 10 && Math.abs(z) < MAP.plazaHalf + 10) return 'center';
  const a = compassAngle(x, z);
  let best = null, bestD = 1e9;
  for (const [id, d] of Object.entries(DISTRICTS)) {
    let diff = Math.abs(a - d.angle);
    if (diff > 180) diff = 360 - diff;
    if (diff < bestD) { bestD = diff; best = id; }
  }
  return best;
}

// Assign every brand to a city block inside its district sector, nearest to
// the centre first, so districts form clear clusters around the landmark.
// Returns { brands: [...with x,z,block,bounds], blockOwner: Map("i,j" -> brand|null) }
export function layoutBrands() {
  const free = [];
  for (let i = 0; i < MAP.blocks; i++) {
    for (let j = 0; j < MAP.blocks; j++) {
      if (isPlazaBlock(i, j)) continue;
      const c = blockCenter(i, j);
      free.push({ i, j, ...c, district: districtAt(c.x, c.z), dist: Math.hypot(c.x, c.z), used: false });
    }
  }
  const placed = [];
  for (const id of Object.keys(DISTRICTS)) {
    const list = BRANDS.filter((b) => b.district === id);
    const cands = free.filter((f) => f.district === id).sort((a, b) => a.dist - b.dist);
    list.forEach((b, k) => {
      const blk = cands[k];
      blk.used = true;
      const [w, d] = b.size;
      placed.push({
        ...b,
        x: blk.x, z: blk.z, block: [blk.i, blk.j],
        bounds: { minX: blk.x - w / 2, maxX: blk.x + w / 2, minZ: blk.z - d / 2, maxZ: blk.z + d / 2 },
      });
    });
  }
  return { brands: placed, blocks: free };
}
