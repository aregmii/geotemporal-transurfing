// Build site/assets/sky.json from the d3-celestial data package (BSD-3-Clause):
// stars to magnitude 6 as [ra_deg, dec_deg, mag], constellation lines, and Milky Way contours.
// usage: node pipeline/build_sky.js  (expects d3-celestial installed: npm i -D d3-celestial)
const fs = require('fs'), path = require('path');
const dataDir = path.join(require.resolve('d3-celestial/package.json'), '..', 'data');
const stars = JSON.parse(fs.readFileSync(path.join(dataDir, 'stars.6.json'), 'utf8')).features
  .map(f => [Math.round(f.geometry.coordinates[0] * 100) / 100, Math.round(f.geometry.coordinates[1] * 100) / 100, Math.round(f.properties.mag * 10) / 10]);
const lines = JSON.parse(fs.readFileSync(path.join(dataDir, 'constellations.lines.json'), 'utf8')).features
  .map(f => ({ id: f.id, lines: f.geometry.coordinates.map(l => l.map(p => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100])) }));
const names = JSON.parse(fs.readFileSync(path.join(dataDir, 'constellations.json'), 'utf8')).features
  .reduce((m, f) => { m[f.id] = { name: f.properties.name, at: f.geometry.coordinates }; return m; }, {});
const mw = JSON.parse(fs.readFileSync(path.join(dataDir, 'mw.json'), 'utf8')).features
  .map(f => f.geometry.coordinates.map(poly => poly[0].filter((p, i) => i % 3 === 0).map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])));
const out = { stars, constellations: lines.map(l => ({ id: l.id, name: (names[l.id] || {}).name || l.id, at: (names[l.id] || {}).at || null, lines: l.lines })), milkyWay: mw,
  credit: 'Star and constellation data: d3-celestial (Olaf Frohn, BSD-3-Clause), from the Yale Bright Star Catalog and HYG database' };
fs.writeFileSync(path.join(__dirname, '..', 'site', 'assets', 'sky.json'), JSON.stringify(out));
console.log('sky.json: ' + stars.length + ' stars, ' + lines.length + ' constellations, ' + mw.length + ' Milky Way levels');
