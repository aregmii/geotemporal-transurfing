// Rasterise the Milky Way brightness levels on the sphere with d3-geo (correct across the RA seam and at the poles).
const d3 = require('d3'); const fs = require('fs');
const mw = require('d3-celestial/data/mw.json').features;
const W = 360, H = 180; const out = Buffer.alloc(W * H);
for (let y = 0; y < H; y++) {
  const dec = 90 - (y + 0.5) / H * 180;
  for (let x = 0; x < W; x++) {
    const ra = -180 + (x + 0.5) / W * 360;
    let v = 0;
    for (let i = 0; i < mw.length; i++) if (d3.geoContains(mw[i], [ra, dec])) v = 28 + i * 26;
    out[y * W + x] = v;
  }
}
fs.writeFileSync('__dirname + '/mw_mask.pgm'', Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`), out]));
let filled = 0; for (const b of out) if (b) filled++; console.log('mask done, coverage', (filled / out.length * 100).toFixed(1) + '%');
