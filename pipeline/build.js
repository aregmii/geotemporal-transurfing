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
if (fs.existsSync(wikidataFile)) {
  args.push('--wikidata', wikidataFile);
} else {
  console.log('no pipeline/events_wikidata.json yet — building from curated rows only');
}
// merge.js reads discoveries_P575.json from its working directory
execFileSync('node', args, { stdio: 'inherit', cwd: fs.existsSync(discoveriesCache) ? path.dirname(discoveriesCache) : pipelineDir });

const events = JSON.parse(fs.readFileSync(path.join(outDir, 'events.json'), 'utf8'));
let images = {};
const manifest = path.join(outDir, 'images.json');
if (fs.existsSync(manifest)) images = JSON.parse(fs.readFileSync(manifest, 'utf8'));
else fs.writeFileSync(manifest, '{}');

const withPhoto = events.filter(r => images[r[9]]).length;
const missing = Object.keys(images).filter(slug => !fs.existsSync(path.join(root, 'site', 'img', images[slug].file)));
console.log('site/data/events.json: ' + events.length + ' events, ' + withPhoto + ' with a photo');
if (missing.length) console.log('WARNING: ' + missing.length + ' manifest entries point at image files that do not exist');
