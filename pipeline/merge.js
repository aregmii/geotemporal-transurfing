// Merge curated rows with Wikidata rows into one event array for the prototype.
// usage: node merge.js out.json curated1.json curated2.json ... --wikidata events_wikidata.json
const fs = require('fs');
const argv = process.argv.slice(2);
const outPath = argv[0];
const curatedFiles = [];
const wikidataFiles = [];
let mode = 'curated';
for (let i = 1; i < argv.length; i++) {
  if (argv[i] === '--wikidata') { mode = 'wikidata'; continue; }
  if (mode === 'curated') curatedFiles.push(argv[i]); else wikidataFiles.push(argv[i]);
}

function normalizeTitle(title) {
  return String(title).toLowerCase().replace(/^the /, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function slugKey(slug, title) {
  // A person's birth and death share one article; keep them distinct.
  const kind = /^(birth|death|discovery) of /i.test(title) ? title.split(' ')[0].toLowerCase() : '';
  return slug + '|' + kind;
}
function weightFromSitelinks(sitelinks) {
  if (sitelinks >= 120) return 4;
  if (sitelinks >= 70) return 3;
  if (sitelinks >= 40) return 2;
  return 1;
}
function astronomicalToHistorical(year) {
  // Wikidata: year 0 exists, -479 means 480 BCE. Curated rows use -480 for 480 BCE.
  if (year <= 0) return year - 1;
  return year;
}

const out = [];
const seenSlug = new Set();
const seenTitle = new Set();

for (const file of curatedFiles) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const row of rows) {
    const slug = (row[9] || '').toLowerCase();
    if (slug) seenSlug.add(slugKey(slug, row[0]));
    seenTitle.add(normalizeTitle(row[0]));
    out.push(row);
  }
}

// Discovery rows (from the P575 query) are titled with the bare item label ("Brazil"). Prefix them,
// and drop continents/countries/oceans which are not events.
let discoverySlugs = new Set();
try {
  const disc = JSON.parse(fs.readFileSync('discoveries_P575.json', 'utf8'));
  for (const b of disc.results.bindings) {
    if (b.article) discoverySlugs.add(b.article.value.rsplit ? '' : b.article.value.split('/').pop().toLowerCase());
  }
} catch (e) { /* no discoveries cache available */ }
const NOT_EVENTS = /\b(continent|country|sovereign state|ocean|sea|island|planet|moon|star|galaxy|dwarf planet|asteroid|comet|element|chemical|mineral|river|lake|mountain|region)\b/i;
function humanizeSlug(slug) { return decodeURIComponent(String(slug)).replace(/_/g, ' '); }

let wikidataKept = 0, wikidataDropped = 0, notEvents = 0;
for (const file of wikidataFiles) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const row of rows) {
    const slug = (row[9] || '').toLowerCase();
    const titleKey = normalizeTitle(row[0]);
    const sk = slugKey(slug, row[0]);
    if ((slug && seenSlug.has(sk)) || seenTitle.has(titleKey)) { wikidataDropped++; continue; }
    if (slug) seenSlug.add(sk);
    seenTitle.add(titleKey);
    const copy = row.slice();
    // raw QID leaked into a title ("Birth of Q692") — recover the name from the article slug
    if (/\bQ\d+\b/.test(copy[0]) && slug && !/^q\d+$/.test(slug)) copy[0] = copy[0].replace(/\bQ\d+\b/, humanizeSlug(row[9]));
    if (discoverySlugs.has(slug)) {
      if (NOT_EVENTS.test(copy[8] || '')) { notEvents++; continue; }
      if (!/^discovery/i.test(copy[0])) copy[0] = 'Discovery of ' + copy[0];
    }
    if (row.length <= 10) { copy[3] = astronomicalToHistorical(copy[3]); copy[4] = astronomicalToHistorical(copy[4]); } // v0.1 output only; v0.2 already converts
    // the extraction script already bucketed weight from sitelinks with old thresholds;
    // if a raw sitelinks count is present at index 11 use it, otherwise keep the bucket.
    copy._sitelinks = typeof copy[11] === 'number' ? copy[11] : 0;
    if (!copy[8] || copy[8].length < 12) copy[8] = 'No description yet — run fetch_summaries.py to pull the Wikipedia lead paragraph.';
    if (!copy[7]) copy[7] = '';
    const trimmed = copy.slice(0, 10); trimmed._sitelinks = copy._sitelinks;
    out.push(trimmed);
    wikidataKept++;
  }
}

// Weight by rank among Wikidata rows: top 8% -> 4, next 17% -> 3, next 30% -> 2, rest 1.
const wd = out.filter(r => r._sitelinks !== undefined).sort((a, b) => b._sitelinks - a._sitelinks);
wd.forEach((r, i) => { const q = i / wd.length; r[6] = q < 0.08 ? 4 : q < 0.25 ? 3 : q < 0.55 ? 2 : 1; delete r._sitelinks; });
out.sort((a, b) => a[3] - b[3]);
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('curated', out.length - wikidataKept, '| wikidata kept', wikidataKept, 'dropped as duplicate', wikidataDropped, 'dropped as not-an-event', notEvents, '| total', out.length);
