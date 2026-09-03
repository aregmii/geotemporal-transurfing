// Build a single self-contained HTML file of the site for hosting where no file requests are possible
// (the Claude artifact playground). Images are inlined as data URIs at reduced size.
// usage: node pipeline/playground.js [out.html]
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..'), site = path.join(root, 'site');
const out = process.argv[2] || path.join(root, 'playground.html');
// the hosted playground must stay under 16 MB: it carries the rows the visible rail (2000–2025) can show, plus the
// heaviest rows of earlier years for the hidden rails, and photos for those rows within a byte budget
const allRows = JSON.parse(fs.readFileSync(path.join(site, 'data/events.json'), 'utf8'));
const PLAYGROUND_ROWS = 7000;
let rowsKept = allRows.filter(r => r[4] >= 2000 || r[6] >= 4);
if (rowsKept.length > PLAYGROUND_ROWS) {   // weight first, then rows with a photo, then exact dates
  const man = JSON.parse(fs.readFileSync(path.join(site, 'data/images.json'), 'utf8'));
  rowsKept.sort((a, b) => (b[6] - a[6]) || ((man[b[9]] ? 1 : 0) - (man[a[9]] ? 1 : 0)) || ((b[10] ? 1 : 0) - (a[10] ? 1 : 0)));
  rowsKept = rowsKept.slice(0, PLAYGROUND_ROWS).sort((a, b) => a[3] - b[3]);
}
const events = JSON.stringify(rowsKept);
const PHOTO_BUDGET = 5.2 * 1048576;
const borders = fs.readFileSync(path.join(site, 'assets/countries-110m.json'), 'utf8');
const skyLabels = fs.readFileSync(path.join(site, 'assets/skylabels.json'), 'utf8');
const skyImage = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(site, 'assets/sky.jpg')).toString('base64');
const astro = fs.readFileSync(path.join(site, 'vendor/astronomy.browser.min.js'), 'utf8');
const earth = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(site, 'assets/earth.jpg')).toString('base64');
const manifest = JSON.parse(fs.readFileSync(path.join(site, 'data/images.json'), 'utf8'));
// only photos an event actually uses (the manifest also keeps rows that merge.js later dropped)
const usedSlugs = new Set(rowsKept.map(r => r[9]));
for (const slug of Object.keys(manifest)) if (!usedSlugs.has(slug)) delete manifest[slug];
// shrink every photo to 208px / q55 with pillow, inline as data URI (the hosted artifact must stay under 16 MB)
const tmp = path.join(root, '.playground-img'); fs.mkdirSync(tmp, { recursive: true });
const py = `
import sys, json, io, os
from PIL import Image
site, tmp = sys.argv[1], sys.argv[2]
man = json.load(open(os.path.join(site, 'data/images.json')))
for slug, v in man.items():
    src = os.path.join(site, 'img', v['file']); dst = os.path.join(tmp, v['file'])
    if not os.path.exists(src) or os.path.exists(dst): continue
    im = Image.open(src).convert('RGB'); w, h = im.size; k = min(1.0, 176 / max(w, h))
    if k < 1: im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=50, optimize=True, progressive=True)
`;
execFileSync('python3', ['-c', py, site, tmp], { stdio: 'inherit' });
let bytes = 0;
const rank = {}; rowsKept.forEach(r => { const v = (r[4] >= 2000 ? 10 : 0) + r[6]; if (!(r[9] in rank) || rank[r[9]] < v) rank[r[9]] = v; });
for (const slug of Object.keys(manifest).sort((a, b) => (rank[b] || 0) - (rank[a] || 0))) {
  const f = path.join(tmp, manifest[slug].file);
  if (!fs.existsSync(f)) { delete manifest[slug]; continue; }
  const b = fs.readFileSync(f);
  if (bytes + b.length > PHOTO_BUDGET) { delete manifest[slug]; continue; }
  bytes += b.length;
  manifest[slug].file = 'data:image/jpeg;base64,' + b.toString('base64');
}
// clips: a small demo set inlined as data URIs — the ten heaviest events with a clip inside the United States,
// then the rest by weight, until the media budget is spent (the hosted page must stay under 16 MB)
let links = [];
try { links = JSON.parse(fs.readFileSync(path.join(site, 'data/links.json'), 'utf8')); } catch (e) { /* no links yet */ }
let media = {};
try { media = JSON.parse(fs.readFileSync(path.join(site, 'data/media.json'), 'utf8')); } catch (e) { /* no clips yet */ }
const weightOf = {}; rowsKept.forEach(r => { weightOf[r[9]] = { w: r[6], us: r[1] > 24 && r[1] < 50 && r[2] > -125 && r[2] < -66 }; });
const MEDIA_BUDGET = 2.6 * 1048576; let mediaBytes = 0; const mediaOut = {};
Object.keys(media).filter(s => weightOf[s]).sort((a, b) => (weightOf[b].us - weightOf[a].us) || (weightOf[b].w - weightOf[a].w)).forEach(slug => {
  const f = path.join(site, 'media', media[slug].file);
  if (!fs.existsSync(f)) return;
  const b = fs.readFileSync(f); if (mediaBytes + b.length > MEDIA_BUDGET) return;
  mediaBytes += b.length;
  const mime = /\.opus$|\.ogg$|\.oga$/.test(media[slug].file) ? 'audio/ogg' : /\.mp3$/.test(media[slug].file) ? 'audio/mpeg' : /\.webm$/.test(media[slug].file) ? 'video/webm' : /\.mp4$/.test(media[slug].file) ? 'video/mp4' : 'application/octet-stream';
  mediaOut[slug] = Object.assign({}, media[slug], { file: 'data:' + mime + ';base64,' + b.toString('base64') });
});
let html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(site, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(site, 'app.js'), 'utf8');
// artifact host wraps the page itself: strip doctype/html/head/body, inline css + js, load three from cdnjs
html = html.replace(/<!doctype html>\s*<html[^>]*>\s*<head>/i, '').replace(/<\/head>\s*<body>/i, '').replace(/<\/body>\s*<\/html>\s*$/i, '');
html = html.replace(/<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/i, '');
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>');
html = html.replace('<script src="vendor/three.min.js"></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>');
html = html.replace('<script src="vendor/astronomy.browser.min.js"></script>', '<script>\n' + astro + '\n</script>');
html = html.replace('<script src="app.js"></script>',
  '<script id="pg-events" type="application/json">' + events + '</script>\n' +
  '<script id="pg-images" type="application/json">' + JSON.stringify(manifest) + '</script>\n' +
  '<script id="pg-borders" type="application/json">' + borders + '</script>\n' +
  '<script>window.__GT = { events: JSON.parse(document.getElementById("pg-events").textContent), images: JSON.parse(document.getElementById("pg-images").textContent), borders: JSON.parse(document.getElementById("pg-borders").textContent), skyLabels: ' + skyLabels + ', skyImage: ' + JSON.stringify(skyImage) + ', earth: ' + JSON.stringify(earth) + ', imgDir: "", media: ' + JSON.stringify(mediaOut) + ', mediaDir: "", links: ' + JSON.stringify(links) + ' };</script>\n' +
  '<script>\n' + app + '\n</script>');
fs.writeFileSync(out, html);
console.log('playground: ' + Object.keys(manifest).length + ' photos (' + (bytes / 1048576).toFixed(1) + ' MB), ' + Object.keys(mediaOut).length + ' clips (' + (mediaBytes / 1048576).toFixed(1) + ' MB), file ' + (html.length / 1048576).toFixed(1) + ' MB -> ' + out);
