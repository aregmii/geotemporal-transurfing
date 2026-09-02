// Build a single self-contained HTML file of the site for hosting where no file requests are possible
// (the Claude artifact playground). Images are inlined as data URIs at reduced size.
// usage: node pipeline/playground.js [out.html]
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..'), site = path.join(root, 'site');
const out = process.argv[2] || path.join(root, 'playground.html');
const events = fs.readFileSync(path.join(site, 'data/events.json'), 'utf8');
const borders = fs.readFileSync(path.join(site, 'assets/countries-110m.json'), 'utf8');
const skyImage = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(site, 'assets/sky.jpg')).toString('base64');
const astro = fs.readFileSync(path.join(site, 'vendor/astronomy.browser.min.js'), 'utf8');
const earth = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(site, 'assets/earth.jpg')).toString('base64');
const manifest = JSON.parse(fs.readFileSync(path.join(site, 'data/images.json'), 'utf8'));
// shrink every photo to 224px / q58 with pillow, inline as data URI
const tmp = path.join(root, '.playground-img'); fs.mkdirSync(tmp, { recursive: true });
const py = `
import sys, json, io, os
from PIL import Image
site, tmp = sys.argv[1], sys.argv[2]
man = json.load(open(os.path.join(site, 'data/images.json')))
for slug, v in man.items():
    src = os.path.join(site, 'img', v['file']); dst = os.path.join(tmp, v['file'])
    if not os.path.exists(src) or os.path.exists(dst): continue
    im = Image.open(src).convert('RGB'); w, h = im.size; k = min(1.0, 224 / max(w, h))
    if k < 1: im = im.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    im.save(dst, 'JPEG', quality=58, optimize=True, progressive=True)
`;
execFileSync('python3', ['-c', py, site, tmp], { stdio: 'inherit' });
let bytes = 0;
for (const slug of Object.keys(manifest)) {
  const f = path.join(tmp, manifest[slug].file);
  if (!fs.existsSync(f)) { delete manifest[slug]; continue; }
  const b = fs.readFileSync(f); bytes += b.length;
  manifest[slug].file = 'data:image/jpeg;base64,' + b.toString('base64');
}
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
  '<script>window.__ATLAS = { events: JSON.parse(document.getElementById("pg-events").textContent), images: JSON.parse(document.getElementById("pg-images").textContent), borders: JSON.parse(document.getElementById("pg-borders").textContent), skyImage: ' + JSON.stringify(skyImage) + ', earth: ' + JSON.stringify(earth) + ', imgDir: "" };</script>\n' +
  '<script>\n' + app + '\n</script>');
fs.writeFileSync(out, html);
console.log('playground: ' + Object.keys(manifest).length + ' photos (' + (bytes / 1048576).toFixed(1) + ' MB), file ' + (html.length / 1048576).toFixed(1) + ' MB -> ' + out);
