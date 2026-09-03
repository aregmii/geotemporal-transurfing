// Build step: merge curated + Wikidata rows into site/data/events.json.
// usage (from the repo root):  node pipeline/build.js
// Inputs:  pipeline/curated/*.json, pipeline/events_wikidata.json (from extract + summaries)
// Output:  site/data/events.json  — one array of rows the site loads at start
//          site/data/images.json  — written by fetch_images.py, only checked here
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pipelineDir = path.join(root, 'pipeline');
const curatedDir = path.join(pipelineDir, 'curated');
const outDir = path.join(root, 'site', 'data');
const wikidataFile = path.join(pipelineDir, 'events_wikidata.json');
const discoveriesCache = path.join(pipelineDir, 'wdqs_cache', 'discoveries_P575.json');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const curatedFiles = fs.readdirSync(curatedDir).filter(f => f.endsWith('.json')).map(f => path.join(curatedDir, f));
const args = [path.join(pipelineDir, 'merge.js'), path.join(outDir, 'events.json'), ...curatedFiles];
const yearPagesFile = path.join(pipelineDir, 'events_yearpages.json');
if (fs.existsSync(wikidataFile)) {
  args.push('--wikidata', wikidataFile);
  if (fs.existsSync(yearPagesFile)) args.push(yearPagesFile);      // Wikipedia year-by-country pages, same row shape
} else {
  console.log('no pipeline/events_wikidata.json yet — building from curated rows only');
}
// merge.js reads discoveries_P575.json from its working directory
execFileSync('node', args, { stdio: 'inherit', cwd: fs.existsSync(discoveriesCache) ? path.dirname(discoveriesCache) : pipelineDir });

let events = JSON.parse(fs.readFileSync(path.join(outDir, 'events.json'), 'utf8'));

// Sharding. Up to SINGLE_FILE_MAX rows ship as one events.json. Beyond that, events.json keeps everything before
// SHARD_FROM plus the top BASE_PER_YEAR rows of every later year, and the rest go to data/y/<year>.json, listed in
// data/index.json — the app loads a shard when a window touches its year.
const SINGLE_FILE_MAX = 12000, SHARD_FROM = 1800, BASE_PER_YEAR = 120;
const shardDir = path.join(outDir, 'y');
fs.rmSync(shardDir, { recursive: true, force: true });
fs.rmSync(path.join(outDir, 'index.json'), { force: true });
if (events.length > SINGLE_FILE_MAX) {
  const byYear = new Map();
  const base = [];
  for (const r of events) {
    if (r[3] < SHARD_FROM) { base.push(r); continue; }
    if (!byYear.has(r[3])) byYear.set(r[3], []);
    byYear.get(r[3]).push(r);
  }
  fs.mkdirSync(shardDir, { recursive: true });
  const years = [];
  for (const [year, rows] of [...byYear.entries()].sort((a, b) => a[0] - b[0])) {
    rows.sort((a, b) => b[6] - a[6] || (b[10] ? 1 : 0) - (a[10] ? 1 : 0));
    base.push(...rows.slice(0, BASE_PER_YEAR));
    const rest = rows.slice(BASE_PER_YEAR);
    if (rest.length) { fs.writeFileSync(path.join(shardDir, year + '.json'), JSON.stringify(rest)); years.push(year); }
  }
  base.sort((a, b) => a[3] - b[3]);
  fs.writeFileSync(path.join(outDir, 'events.json'), JSON.stringify(base));
  fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify({ years, perYear: BASE_PER_YEAR, total: events.length }));
  console.log('sharded: ' + base.length + ' rows in events.json, ' + (events.length - base.length) + ' rows in ' + years.length + ' year shards');
  events = base;
}
let images = {};
const manifest = path.join(outDir, 'images.json');
if (fs.existsSync(manifest)) images = JSON.parse(fs.readFileSync(manifest, 'utf8'));
else fs.writeFileSync(manifest, '{}');

const withPhoto = events.filter(r => images[r[9]]).length;
const missing = Object.keys(images).filter(slug => !fs.existsSync(path.join(root, 'site', 'img', images[slug].file)));
console.log('site/data/events.json: ' + events.length + ' events, ' + withPhoto + ' with a photo');
if (missing.length) console.log('WARNING: ' + missing.length + ' manifest entries point at image files that do not exist');
