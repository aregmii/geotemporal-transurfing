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
    row._curated = true;                     // hand-written title and text: left alone by the headline step
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
// geopolitical entities carry a P575 "discovery" date (Brazil, Europe) but are not events; natural objects (Neptune, a comet, an element) are
const NOT_EVENTS = /\b(is (a|the) (largest |smallest |second-largest |third-largest )?(continent|country|sovereign state|nation|ocean|sea|region|state|province|territory|city|town|municipality|colony|kingdom|republic|empire))\b/i;
function humanizeSlug(slug) { return decodeURIComponent(String(slug)).replace(/_/g, ' '); }
const THIS_YEAR = new Date().getUTCFullYear();
const MIN_LAUNCH_SITELINKS = 30;
// P575 is Wikidata's "time of discovery or invention": pick the verb from what the thing is.
// Natural objects and archaeological finds are discovered; devices, processes, foods and drugs are invented;
// everything else (a theorem, a projection, a fallacy) is "introduced".
const CATALOG = /^(\(?\d+\)? [A-Z][\w'-]+|\d{4} [A-Z]{2}\d*|(IC|NGC|UGC|PGC|KV|TT|QV|WV|Messier|M) ?\d+[A-Za-z]?|[A-Z]+ \d+[A-Za-z]?|\d+P\/.+)$/;   // 463 Lola, 2003 UB313, IC 4970, KV36, 21P/…
const CONSTELLATION = /\bconstellation/i;
const DISCOVERED = /\b(nebula|cluster|galaxy|galaxies|comet|asteroid|moon|moons|satellite|planet|planets|star|stars|supernova|atoll|reef|peninsula|river|lake|basin|mine|tablet|jewel|horns?|sculpture|marble|bronze|relief|mosaic|treasure|element|isotope|particle|boson|positron|electron|proton|neutron|deuterium|fossil|dinosaur|reptile|genus|species|tree|plant|bacterium|virus|cell|hormone|vitamin|enzyme|protein|molecule|compound|mineral|meteorite|crater|island|islands|archipelago|territory|land|bay|cape|strait|glacier|falls|cave|tomb|site|ruins|manuscript|manuscripts|scroll|inscription|stele|library|mechanism|diamond|hoard|ship|wreck|shipwreck|chariot|statue|bust|helmet|mummy|bog body|men|man|city|town|settlement|harbour|effect|force|law|constant|paradox|theorem|formula|number|numbers|sequence|principle|phenomenon|wave|radiation|current|scattering|spacetime|pole|expedition|event|calendar|observatory)\b/i;
const INVENTED = /\b(engine|turbine|motor|filter|diode|triode|transistor|battery|cell|lamp|bulb|rod|cylinder|kaleidoscope|stroboscope|transformer|inductor|thermistor|code|press|machine|computer|maser|laser|telescope|microscope|reactor|drug|opioid|analgesic|anaesthetic|vaccine|dye|plastic|polymer|resin|process|alloy|food|dish|drink|cocktail|snack|sandwich|sauce|dessert|instrument|device|apparatus|tool|weapon|gun|rifle|bomb|vehicle|aircraft|rocket|camera|projector|phonograph|telephone|radio|television|typewriter|pen|semicolon|sign|symbol|font|typeface|game|sport|toy|projection|calendar|sort|algorithm|protocol|language)\b/i;
function discoveryTitle(title, description) {
  const first = String(description).split(/\.\s/)[0];
  if (/^(Messier|NGC|IC) \d/.test(title)) return 'Discovery of ' + title;
  if (/\b(nebula|cluster|pillars|galaxy)\b/i.test(title + ' ' + first)) return 'Discovery of ' + title;
  if (CONSTELLATION.test(first)) return 'Constellation ' + title + ' charted';
  if (DISCOVERED.test(first) || DISCOVERED.test(title)) return 'Discovery of ' + title;
  if (INVENTED.test(first) || INVENTED.test(title)) return 'Invention of ' + title;
  return title + ' introduced';
}

let wikidataKept = 0, wikidataDropped = 0, notEvents = 0, routineLaunches = 0, catalogObjects = 0;
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
    if (copy[12] === 'discovery' || discoverySlugs.has(slug)) {
      if (NOT_EVENTS.test(copy[8] || '')) { notEvents++; continue; }
      if (CATALOG.test(copy[0]) && (copy[11] || 0) < 60) { catalogObjects++; continue; }   // numbered asteroids, tomb codes, faint galaxies
      if (!/^(discovery|invention|constellation)/i.test(copy[0]) && !/ introduced$/.test(copy[0])) copy[0] = discoveryTitle(copy[0], copy[8] || '');
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

// ---- headlines: say what happened, not what the article is called ----
// facts.json (fetch_facts.py) gives winner / deaths / magnitude / exact span; headlines.json (headlines_llm.py, optional)
// gives a written headline. Without either, the first sentence of the Wikipedia lead supplies the predicate.
let facts = {}, written = {};
try { facts = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'facts.json'), 'utf8')); } catch (e) { /* optional */ }
try { written = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'headlines.json'), 'utf8')); } catch (e) { /* optional */ }
function fmtNum(n) { return n >= 1000 ? n.toLocaleString('en-US') : String(n); }
function predicateOf(title, lead) {
  // "X was a Formula One motor race that took place on ..." -> "Formula One motor race"
  let first = String(lead || '').replace(/\u00a0/g, ' ').split(/(?<=[a-z0-9\)])\.\s+(?=[A-Z])/)[0].replace(/\s+/g, ' ').trim();
  if (!first) return '';
  // "On 26 May 2017, masked gunmen opened fire on ..." -> "masked gunmen opened fire on ..." (the whole clause, subject included)
  const bad = p => !p || p.length < 12 || title.toLowerCase().indexOf(p.toLowerCase().replace(/[.…]+$/, '')) >= 0 || /^(at|around|about|approximately|shortly|just)\s/i.test(p);
  let m = /^(?:On|In|At|During|From)\s+(?:the\s+)?(?:early|late|morning of|evening of|night of)?\s*[\w\d ,–-]*?\d{4},\s+(?:at\s+(?:about |around |approximately )?[\d:.]+\s*[ap]?\.?m?\.?\s*(?:[A-Z]{2,5})?\s*(?:\([^)]*\))?,\s+)?(.+)$/.exec(first);
  let pred = m ? m[1] : '';
  if (bad(pred)) {
    m = /\b(?:was|is|were|are)\s+(?:an?\s+|the\s+)?(.+)$/i.exec(first);
    pred = m ? m[1] : '';
  }
  if (bad(pred)) return '';
  pred = pred.split(/,|;|\s(?:that|which|when|after|while|where|whose|in which|during which|held|played)\s/)[0].trim();
  pred = pred.replace(/\s+\(.*?\)/g, '').replace(/\s+(?:on|from|between|at|for)\s+\d.*$/, '').trim();
  if (pred.length > 64) pred = pred.slice(0, 64).replace(/\s+\S*$/, '') + '…';
  pred = pred.replace(/[.\s]+$/, '');
  return bad(pred) ? '' : pred;
}
// what the lead paragraph itself says about deaths and about how a crash happened
function deathsInLead(lead) {
  const t = String(lead).replace(/\u00a0/g, ' ');
  const both = /\ball (\d[\d,]*) passengers and (\d[\d,]*) crew/i.exec(t);
  if (both) return parseInt(both[1].replace(/,/g, ''), 10) + parseInt(both[2].replace(/,/g, ''), 10);
  const pats = [
    /\bkilling (?:all |at least |about |over |more than |some |an estimated )?(\d[\d,]*)/i,
    /\ball (\d[\d,]*) (?:people|passengers|persons|occupants|crew)[^.]{0,40}?(?:were |was )?(?:killed|died|perished|lost)/i,
    /\b(\d[\d,]*) (?:people|passengers|persons|occupants|civilians|soldiers|residents|pilgrims|students|workers|miners)[^.]{0,40}?(?:were |was )?(?:killed|died|perished|lost their lives)/i,
    /\b(?:death toll|deaths) (?:of|was|reached|rose to|stood at) (?:at least |about |over |more than |an estimated )?(\d[\d,]*)/i,
    /\b(?:killed|claimed the lives of|left) (?:at least |about |over |more than |some |an estimated )?(\d[\d,]*) (?:people|persons|lives|dead)/i,
    /\b(\d[\d,]*) (?:deaths|fatalities|dead)\b/i,
  ];
  for (const p of pats) { const m = p.exec(t); if (m) { const n = parseInt(m[1].replace(/,/g, ''), 10); if (n > 0 && n < 100000000) return n; } }
  return null;
}
function crashPhrase(lead) {
  const m = /\b(crashed|crash-landed|was shot down|shot down|broke up|disappeared|collided|ditched|exploded|ran off the runway|overran|struck)(?: (?:into|in|on|near|over|off|with|shortly after|during|while|at) [^.,;]{3,50})?/i.exec(String(lead).replace(/\u00a0/g, ' '));
  if (!m) return null;
  // stop before a date or a death count: those are said separately
  return m[0].replace(/^was /, '').replace(/\s+(?:on|at|in) \d.*$/, '').replace(/\s+(?:killing|with|carrying).*$/, '').replace(/\s+(?:near|in) [A-Z][^ ]* in [A-Z].*$/, '').trim();
}
function headline(row) {
  const title = row[0], slug = row[9], lead = row[8] || '', f = facts[slug] || {};
  if (written[slug]) return written[slug];
  const lower = title.toLowerCase();
  const deaths = f.deaths || deathsInLead(lead);
  if (/\bflight \d/i.test(title)) {
    const how = crashPhrase(lead);
    if (how) return title + ' ' + how + (deaths ? ', ' + fmtNum(deaths) + ' killed' : '');
  }
  if (deaths && /attack|bombing|bombings|shooting|massacre|stampede|crush|fire|flood|floods|cyclone|hurricane|typhoon|storm|tsunami|explosion|landslide|heat wave|avalanche|earthquake|crash|collapse|sinking|derailment|collision|accident|disaster/.test(lower) && !f.magnitude) return title + ': ' + fmtNum(deaths) + ' killed';
  if (f.winner && /final|cup|championship|grand prix|super bowl|open|masters|derby|race|bowl|series|tournament|olympic|games\b/.test(lower)) return f.winner + ' wins ' + title.replace(/^the /i, '');
  if (f.elected && /election/.test(lower)) return f.elected + ' wins ' + title.replace(/^the /i, '');
  if (f.winner && /battle|siege|war\b/.test(lower)) return title + ': ' + f.winner + ' victorious';
  if (f.magnitude && /earthquake/.test(lower)) return 'M' + f.magnitude + ' ' + title + (f.deaths ? ', ' + fmtNum(f.deaths) + ' killed' : '');
  if (f.deaths && /flight|crash|air|ferry|sinking|disaster|derail|collision/.test(lower)) return title + (/flight/.test(lower) ? (/shot down|shootdown/i.test(lead) ? ' shot down, ' : ' crashes, ') : ': ') + fmtNum(f.deaths) + ' killed';
  if (f.deaths && /attack|bombing|shooting|massacre|stampede|fire|flood|cyclone|hurricane|typhoon|storm|tsunami|explosion|landslide|heat wave|avalanche/.test(lower)) return title + ': ' + fmtNum(f.deaths) + ' killed';
  if (/^(birth|death) of /i.test(title)) { const p = predicateOf(title, lead); return p ? title + ', ' + p.replace(/^(?:the|an?)\s+/i, '') : title; }
  if (/^(discovery|invention) of /i.test(title) || / introduced$/.test(title) || /^constellation /i.test(title)) return title;
  const p = predicateOf(title, lead);
  return p ? title + ': ' + p : title;
}
for (const r of out) {
  const f = facts[r[9]] || {};
  while (r.length < 14) r.push(null);
  r[13] = r[0];                                   // the article name, for search and for the panel
  if (!r._curated) r[0] = written[r[9]] ? written[r[9]] : headline(r);
  delete r._curated;
  if (!r[10] && f.start) r[10] = f.start;         // exact start when the class query only had a year
  r[12] = f.end && f.end !== r[10] ? f.end : null; // exact end: the event persists over its whole span
}

// Weight by rank among Wikidata rows: top 8% -> 4, next 17% -> 3, next 30% -> 2, rest 1.
const wd = out.filter(r => r._sitelinks !== undefined).sort((a, b) => b._sitelinks - a._sitelinks);
wd.forEach((r, i) => { const q = i / wd.length; r[6] = q < 0.08 ? 4 : q < 0.25 ? 3 : q < 0.55 ? 2 : 1; delete r._sitelinks; });
out.sort((a, b) => a[3] - b[3]);
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('curated', out.length - wikidataKept, '| wikidata kept', wikidataKept, 'dropped as duplicate', wikidataDropped, 'dropped as not-an-event', notEvents, 'routine launches', routineLaunches, 'catalogue objects', catalogObjects, 'deaths folded into assassinations', mergedDeaths, '| total', out.length);
