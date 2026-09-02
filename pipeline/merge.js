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
const curatedBySlug = new Map();   // a curated row can borrow the exact date and discoverer from its Wikidata twin
const curatedByTitle = new Map();

let curatedDates = {};
try { curatedDates = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'curated_dates.json'), 'utf8')); } catch (e) { /* optional */ }
for (const file of curatedFiles) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const row of rows) {
    const slug = (row[9] || '').toLowerCase();
    while (row.length < 12) row.push(null);
    if (!row[10] && row[9] && curatedDates[row[9]]) row[10] = curatedDates[row[9]];
    if (slug) { seenSlug.add(slugKey(slug, row[0])); curatedBySlug.set(slugKey(slug, row[0]), row); }
    seenTitle.add(normalizeTitle(row[0]));
    curatedByTitle.set(normalizeTitle(row[0]), row);
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
const THIS_YEAR = new Date().getUTCFullYear();
const MIN_LAUNCH_SITELINKS = 30;
// P575 is Wikidata's "time of discovery or invention": pick the verb from what the first sentence says the thing is.
const CONSTELLATION = /\bconstellation/i;
const DISCOVERED = /\b(nebula|cluster|galaxy|galaxies|comet|asteroid|moon|planet|star|supernova|element|isotope|particle|boson|fossil|dinosaur|reptile|genus|species|tree|plant|bacterium|virus|cell|hormone|vitamin|enzyme|protein|molecule|compound|mineral|island|islands|archipelago|territory|bay|cape|strait|cave|tomb|site|manuscript|library|mechanism|diamond|effect|force|law|constant|paradox|theorem|formula|number|numbers|sequence|theory|principle|phenomenon|wave|radiation|current|experiment|effect|scattering|spacetime|principle|pole|paradox|positron|electron|proton|neutron|isotope|deuterium|process|crater|trojan|bog body|bust|statue|city|town|settlement|harbour|mummy|wreck|shipwreck)\b/i;
function discoveryTitle(title, description) {
  const first = String(description).split(/\.\s/)[0];
  if (/^(Messier|NGC|IC) \d/.test(title)) return 'Discovery of ' + title;
  if (/\b(nebula|cluster|pillars|galaxy)\b/i.test(title + ' ' + first)) return 'Discovery of ' + title;
  if (CONSTELLATION.test(first)) return 'Constellation ' + title + ' charted';
  if (DISCOVERED.test(first) || DISCOVERED.test(title)) return 'Discovery of ' + title;
  return 'Invention of ' + title;
}

let wikidataKept = 0, wikidataDropped = 0, notEvents = 0, routineLaunches = 0;
for (const file of wikidataFiles) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const row of rows) {
    const slug = (row[9] || '').toLowerCase();
    const titleKey = normalizeTitle(row[0]);
    const sk = slugKey(slug, row[0]);
    if ((slug && seenSlug.has(sk)) || seenTitle.has(titleKey)) {
      const twin = curatedBySlug.get(sk) || curatedByTitle.get(titleKey);
      if (twin && twin[3] === row[3]) {
        if (!twin[10] && typeof row[13] === 'string' && /^-?\d{1,5}-\d\d-\d\d$/.test(row[13])) twin[10] = row[13];
        if (!twin[11] && typeof row[14] === 'string') twin[11] = row[14];
      }
      wikidataDropped++; continue;
    }
    if (slug) seenSlug.add(sk);
    seenTitle.add(titleKey);
    const copy = row.slice();
    // raw QID leaked into a title ("Birth of Q692") — recover the name from the article slug
    if (/\bQ\d+\b/.test(copy[0]) && slug && !/^q\d+$/.test(slug)) copy[0] = copy[0].replace(/\bQ\d+\b/, humanizeSlug(row[9]));
    if (discoverySlugs.has(slug)) {
      if (NOT_EVENTS.test(copy[8] || '')) { notEvents++; continue; }
      if (!/^(discovery|invention|constellation)/i.test(copy[0])) copy[0] = discoveryTitle(copy[0], copy[8] || '');
    }
    // routine launches (every Shuttle and Soyuz flight has a Wikidata item) crowd the map: keep the notable ones
    if (copy[12] === 'launch' && (copy[11] || 0) < MIN_LAUNCH_SITELINKS) { routineLaunches++; continue; }
    // dates in the future or placeholders (a war "starting" in 2100) are not events yet
    if (copy[3] > THIS_YEAR) { notEvents++; continue; }
    if (copy[4] < copy[3]) copy[4] = copy[3];
    // a point event with an exact date belongs to that date's year (Wikidata sometimes carries a stray start year)
    if (copy[3] === copy[4] && typeof copy[13] === 'string') { const y = parseInt(copy[13].replace(/^(-?\d+)-.*$/, '$1'), 10); if (!isNaN(y) && y !== copy[3] && y <= THIS_YEAR) { copy[3] = y; copy[4] = y; } }
    copy[0] = copy[0].charAt(0).toUpperCase() + copy[0].slice(1);
    if (row.length <= 10) { copy[3] = astronomicalToHistorical(copy[3]); copy[4] = astronomicalToHistorical(copy[4]); } // v0.1 output only; v0.2 already converts
    // the extraction script already bucketed weight from sitelinks with old thresholds;
    // if a raw sitelinks count is present at index 11 use it, otherwise keep the bucket.
    copy._sitelinks = typeof copy[11] === 'number' ? copy[11] : 0;
    if (!copy[8] || copy[8].length < 12) copy[8] = 'No description yet — run fetch_summaries.py to pull the Wikipedia lead paragraph.';
    if (!copy[7]) copy[7] = '';
    const trimmed = copy.slice(0, 10); trimmed._sitelinks = copy._sitelinks;
    trimmed[10] = typeof copy[13] === 'string' && /^-?\d{1,5}-\d\d-\d\d$/.test(copy[13]) ? copy[13] : null;   // exact date YYYY-MM-DD when Wikidata has one
    trimmed[11] = typeof copy[14] === 'string' ? copy[14] : null;   // discoverer / author
    out.push(trimmed);
    wikidataKept++;
  }
}

// "Death of X" next to "Assassination of X" in the same year is one event; keep the assassination (it carries the place).
const assassinated = new Map();
for (const r of out) { const m = /^assassination of (.+)$/i.exec(r[0]); if (m) assassinated.set(normalizeTitle(m[1]) + '|' + r[3], true); }
let mergedDeaths = 0;
for (let i = out.length - 1; i >= 0; i--) {
  const m = /^death of (.+)$/i.exec(out[i][0]);
  if (m && assassinated.has(normalizeTitle(m[1]) + '|' + out[i][3])) { out.splice(i, 1); mergedDeaths++; }
}

// Weight by rank among Wikidata rows: top 8% -> 4, next 17% -> 3, next 30% -> 2, rest 1.
const wd = out.filter(r => r._sitelinks !== undefined).sort((a, b) => b._sitelinks - a._sitelinks);
wd.forEach((r, i) => { const q = i / wd.length; r[6] = q < 0.08 ? 4 : q < 0.25 ? 3 : q < 0.55 ? 2 : 1; delete r._sitelinks; });
out.sort((a, b) => a[3] - b[3]);
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('curated', out.length - wikidataKept, '| wikidata kept', wikidataKept, 'dropped as duplicate', wikidataDropped, 'dropped as not-an-event', notEvents, 'routine launches', routineLaunches, 'deaths folded into assassinations', mergedDeaths, '| total', out.length);
