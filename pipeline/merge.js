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
const CATALOG = /^(\(\d+\) \d{4} [A-Z]{2}\d*|\(?\d+\)? [A-Z][\w'-]+|\d{4} [A-Z]{2}\d*|(IC|NGC|UGC|PGC|KV|TT|QV|WV|Messier|M) ?\d+[A-Za-z]?|[A-Z]+ \d+[A-Za-z]?|\d+P\/.+)$/;   // 463 Lola, 2003 UB313, IC 4970, KV36, 21P/…
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
    // year-page rows link a related article, not necessarily the event's own; they dedupe on date + headline,
    // and drop out when a Wikidata row already covers the linked article as an event
    const yearPage = row[12] === 'yearpage';
    const sk = yearPage ? 'yp|' + row[13] + '|' + titleKey : slugKey(slug, row[0]);
    if (yearPage && slug && seenSlug.has(slug + '|')) { wikidataDropped++; continue; }
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
    const trimmed = copy.slice(0, 10); trimmed._sitelinks = copy._sitelinks; trimmed._yearpage = yearPage;
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
const WORD_NUMBERS = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19, twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90, hundred:100 };
function deathsInLead(lead) {
  // Wikipedia writes small counts as words ("ten people were killed"): turn those into digits first
  const t = String(lead).replace(/\u00a0/g, ' ')
    .replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)\b/gi, (w, tens, ones) => String(WORD_NUMBERS[tens.toLowerCase()] + WORD_NUMBERS[ones.toLowerCase()]))
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b(?= (?:people|passengers|persons|occupants|civilians|soldiers|residents|pilgrims|students|workers|miners|deaths|fatalities|dead|lives|were|died))/gi, w => String(WORD_NUMBERS[w.toLowerCase()]));
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
  const text = String(lead).replace(/\u00a0/g, ' ');
  const m = /\b(crashed|crash-landed|was shot down|shot down|broke up|disappeared|collided|ditched|exploded|ran off the runway|overran|struck)(?: (?:into|in|on|near|over|off|with|shortly after|during|while|at) [^.,;]{3,50})?/i.exec(text);
  if (!m) return null;
  // the 50-character cap can land inside a word ("... in New Y|ork City"): drop the partial word
  if (/\w/.test(text.charAt(m.index + m[0].length)) && /\s\S+$/.test(m[0])) m[0] = m[0].replace(/\s+\S*$/, '');
  // stop before a date or a death count: those are said separately
  return m[0].replace(/^was /, '').replace(/\s+(?:on|at|in) \d.*$/, '').replace(/\s+(?:killing|with|carrying).*$/, '').replace(/\s+(?:near|in) [A-Z][^ ]* in [A-Z].*$/, '').trim();
}
// A few shapes that carry no information on their own ("United States–Mexico–Canada Agreement", "Kellogg-Briand
// pact", "1st Academy Awards"): say what the thing did, taken from the first sentence, before the name.
const DULL = /(agreement|pact|treaty|accord|convention|protocol|charter|declaration|act\b|bill\b|amendment|awards|ceremony|summit|conference|council|congress|assembly|session|referendum|census|census\b|standard|system|model|principle|law\b|theory|process|method|effect|equation|constant|hypothesis)/i;
function whatItDid(lead) {
  const first = String(lead || '').replace(/\u00a0/g, ' ').split(/(?<=[a-z0-9\)])\.\s+(?=[A-Z])/)[0].replace(/\s+/g, ' ').trim();
  // "... is a trade agreement between Canada, Mexico and the United States that replaced NAFTA" -> the clause that says what it does
  let m = /\b(replaced|replaces|superseded|ended|ends|banned|bans|outlawed|created|creates|established|establishes|founded|abolished|granted|guarantees|guaranteed|required|requires|committed|commits|allowed|allows|limited|limits|set|sets|introduced|introduces|renamed|merged|split|opened|closed|recognised|recognized|awarded|honoured|honored)\b\s+(.{8,90}?)(?:[,.;]|$)/i.exec(first);
  if (m) return (m[1].replace(/s$|es$/, '').replace(/^(ban)$/, 'banned') + ' ' + m[2]).trim();
  return '';
}
// Who won, taken from the lead when facts.json has no answer. Wikipedia's first sentences are formulaic about
// results ("was won by Max Verstappen", "Argentina defeated France 4-2 on penalties"), so a small set of shapes
// covers most finals, races and elections. Returns the whole result clause, score included, or ''.
const NAME = "(?:the )?((?:[A-Z][\\w'’-]*|\\d+[A-Za-z][\\w'’-]*)(?: (?:[A-Z][\\w'’-]*|\\d+[A-Za-z][\\w'’-]*|de|di|van|von|of|the))*)";   // "Felipe Massa", "the 49ers", "Real Madrid"; a score is not a name   // "Felipe Massa", "the 49ers", "Real Madrid"
const NOT_A_WINNER = /^(?:The|It|This|That|These|In|On|At|After|With|Despite|Both|Neither|Each|He|She|They|Its|His|Her|Their|A|An|By|For|Early|Voting)\b/;
const RESULT_SHAPES = [
  new RegExp('\\b(?:was|were) won by ' + NAME + '(?=[.,;(]|$| (?:in|for|with|by|after|on|at|and))'),
  new RegExp('\\b' + NAME + ',? (?:who |which )?(?:would |had |went on to )?(?:defeated|defeat|beat|beating|overcame|won against) ' + NAME + '(?: again)?(?: (\\d+[-–]\\d+(?: on penalties| after extra time| in overtime)?))?'),
  new RegExp('\\b' + NAME + ',? (?:driving|racing|riding) for [^,.]{2,40},? (?:took|won|claimed|secured|scored|achieved)[^.]{0,60}?\\b(?:victory|win)\\b'),
  new RegExp('\\b' + NAME + ' (?:won|took|claimed) (?:the |his |her |their )?(?:\\d+-lap |race |first |second |third |fourth |fifth |\\w+th )?(?:race|title|final|match|election|championship|tournament|victory|win|gold medal|gold)\\b'),
  new RegExp('\\b' + NAME + ' (?:was|were) (?:re-)?elected\\b'),
];
function cleanLead(lead) { return String(lead || '').replace(/ /g, ' ').replace(/\s+/g, ' '); }
function sentencesOf(lead) { return cleanLead(lead).split(/(?<=[a-z0-9\)”"])\.\s+(?=[A-Z])/); }
function firstMatch(re, lead) {
  const parts = sentencesOf(lead);
  for (let k = 0; k < parts.length; k++) {
    const m = re.exec(parts[k]);
    if (!m) continue;
    // "the ticket of Donald Trump and JD Vance defeated the Democratic ticket": a name that is the tail of a list,
    // or a party's ticket, is not the winner
    if (/\band $/.test(parts[k].slice(0, m.index)) || /^ (?:ticket|candidate|party|nominee)\b/.test(parts[k].slice(m.index + m[0].length))) continue;
    return m;
  }
  return null;
}
function resultInLead(lead) {
  // The result is often in the third or fourth sentence ("Felipe Massa, driving for Ferrari, took ... his first
  // race victory"; "the Chiefs would defeat the 49ers again 25–22"), so every sentence of the lead is tried,
  // one at a time so a name can never run across a full stop.
  for (let i = 0; i < RESULT_SHAPES.length; i++) {
    const m = firstMatch(RESULT_SHAPES[i], lead);
    if (!m) continue;
    const a = m[1].trim().replace(/[.,;]+$/, '');
    if (NOT_A_WINNER.test(a) || a.length < 3) continue;
    if (i === 0) return a + ' wins';
    if (i === 1) {
      const b = m[2].trim().replace(/[.,;]+$/, '');
      if (NOT_A_WINNER.test(b) || b.length < 4) continue;              // "Iv" is a name the summary cut short
      return (a + ' beat ' + b + (m[3] ? ' ' + m[3].replace(/-/g, '–') : '')).trim();
    }
    return a + (i === 4 ? ' elected' : ' wins');
  }
  return '';
}
// With no result in the lead, who was in it: "contested by Argentina and defending champions France" -> "Argentina v France"
function contestants(lead) {
  const m = firstMatch(new RegExp('\\b(?:contested|played) (?:by|between) ' + NAME + ' and (?:(?:the )?(?:defending |reigning )?champions? )?' + NAME), lead)
        || firstMatch(new RegExp('\\bbetween (?:the )?(?:[A-Z][\\w ()]*? champion )?' + NAME + ' and (?:the )?(?:[A-Z][\\w ()]*? champion )?(?:and defending [A-Z][\\w ]*? champion )?' + NAME), lead);
  if (!m || NOT_A_WINNER.test(m[1]) || NOT_A_WINNER.test(m[2])) return '';
  const a = m[1].trim().replace(/[.,;]+$/, ''), b = m[2].trim().replace(/[.,;]+$/, '');
  if (a.length < 3 || b.length < 4) return '';
  return a + ' v ' + b;
}
// An election with no result in the lead still has a country and a purpose: "Germany votes for the 16th Bundestag"
function electionLine(lead) {
  const t = cleanLead(lead);
  const where = /\b(?:were|was) held in (?:the )?([A-Z][\w'’.-]*(?: (?:[A-Z][\w'’.-]*|of|the|and))*)/.exec(t);
  if (!where) return '';
  const what = /\bto elect (?:all |a |the )?(?:\d+ )?(?:members (?:of|to) )?((?:the )?[^.,;]{3,40}?)(?=[.,;]| in accordance| following| under| after| on \d| to serve| for a| for the|$)/.exec(t);
  const kind = /\b(presidential|parliamentary|general|federal|legislative|local|mayoral|gubernatorial|senate|state)\b/i.exec(t);
  if (what) return where[1] + ' votes for ' + what[1].replace(/\s+$/, '');
  if (kind) return where[1] + ' votes' + (/presidential/i.test(kind[1]) ? ' for president' : '');
  return '';
}
// Year-page rows are already sentences an editor wrote, but some run to forty words and two clauses. Keep the
// first independent clause and cap the length; a card has room for about a dozen words.
function trimSentence(text) {
  let s = String(text || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  s = s.split(/;\s+/)[0];
  s = s.replace(/\.\s*$/, '');
  const words = s.split(' ');
  if (words.length <= 16) return s;
  // cut at the last comma inside the first sixteen words, so the clause still reads whole
  const head = words.slice(0, 16).join(' ');
  const comma = head.lastIndexOf(',');
  return (comma > 30 ? head.slice(0, comma) : head.replace(/[,\s]+$/, '')) + '…';
}
// Last pass over every generated headline: no dangling function word before an ellipsis ("reduced from…"), no
// doubled punctuation, and a hard cap so a card never has to shrink its type to fit.
const DANGLING = /\s+(?:with|from|of|in|to|as|and|for|by|at|on|into|over|after|before|between|against|the|a|an|its|his|her|their|that|which|who)$/i;
function polish(text) {
  let s = String(text || '').replace(/\s+/g, ' ').trim();
  s = s.replace(/\s*[,;:]\s*…$/, '…').replace(/…+$/, '…');
  if (/…$/.test(s)) {
    let body = s.slice(0, -1).replace(/[,\s]+$/, '');
    while (DANGLING.test(body)) body = body.replace(DANGLING, '');
    s = body.replace(/[,\s]+$/, '') + '…';
  } else if (s.length > 104) {
    let body = s.slice(0, 104).replace(/\s+\S*$/, '');
    while (DANGLING.test(body)) body = body.replace(DANGLING, '');
    s = body.replace(/[,\s]+$/, '') + '…';
  }
  return s;
}
// Wikidata's one-line description is worth appending only when it tells the reader something the title does not.
// "EuroBasket 2003 Women — 2003 edition of EuroBasket Women" restates the name; "2003 Vuelta a España — cycling
// race" names the category the icon already shows. Both are worse than the bare title, so both are refused.
function addsSomething(title, short) {
  const s = short.trim();
  if (/^(?:the\s+)?(?:\d+(?:st|nd|rd|th)|\d{4}|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|[a-z]+th)\s+(?:edition|season|running|instal?ment)\b/i.test(s)) return false;
  const words = s.split(/\s+/);
  // a bare category: no proper noun, no number, only a few words ("cycling race", "judo competition")
  if (words.length <= 4 && !/\d/.test(s) && !words.some(w => /^[A-Z]/.test(w))) return false;
  const inTitle = new Set(title.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/));
  const content = words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(w => w.length > 3);
  if (!content.length) return false;
  // a suffix that opens by repeating the title ("2003 FIFA Confederations Cup Final — 2003 FIFA Confederations
  // Cup association football match") is a restatement however it ends
  const opening = content.slice(0, 3);
  if (opening.length === 3 && opening.every(w => inTitle.has(w))) return false;
  const repeated = content.filter(w => inTitle.has(w)).length;
  return repeated / content.length < 0.6;
}
// Wikidata names a winner the long way ("Argentina men's national football team"); a headline says "Argentina"
function shortName(name) {
  return String(name).replace(/\s+(?:men's|women's)?\s*national (?:football|basketball|cricket|rugby union|rugby league|ice hockey|hockey|volleyball|handball|baseball)? ?team$/i, '')
                     .replace(/\s+national team$/i, '').replace(/\s+\(.*\)$/, '').trim();
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
  if (f.winner && /final|cup|championship|grand prix|super bowl|open|masters|derby|race|bowl|series|tournament|olympic|games\b/.test(lower)) return shortName(f.winner) + ' wins ' + title.replace(/^the /i, '');
  if (f.elected && /election/.test(lower)) return shortName(f.elected) + ' wins ' + title.replace(/^the /i, '');
  if (f.winner && /battle|siege|war\b/.test(lower)) return title + ': ' + f.winner + ' victorious';
  // facts.json had no result: read one out of the lead before falling back to "what this thing was"
  if (/final|cup|championship|grand prix|super bowl|open\b|masters|derby|\brace\b|bowl|series|tournament|olympic|games\b|election|referendum|primary|leadership contest/.test(lower)) {
    const res = resultInLead(lead);
    if (res) return title.replace(/^the /i, '') + ': ' + res;
    if (/election/.test(lower)) { const line = electionLine(lead); if (line) return line + ' — ' + title.replace(/^the /i, ''); }
    const who = contestants(lead);
    if (who) return title.replace(/^the /i, '') + ': ' + who;
  }
  if (f.magnitude && /earthquake/.test(lower)) return 'M' + f.magnitude + ' ' + title + (f.deaths ? ', ' + fmtNum(f.deaths) + ' killed' : '');
  if (f.deaths && /flight|crash|air|ferry|sinking|disaster|derail|collision/.test(lower)) return title + (/flight/.test(lower) ? (/shot down|shootdown/i.test(lead) ? ' shot down, ' : ' crashes, ') : ': ') + fmtNum(f.deaths) + ' killed';
  if (f.deaths && /attack|bombing|shooting|massacre|stampede|fire|flood|cyclone|hurricane|typhoon|storm|tsunami|explosion|landslide|heat wave|avalanche/.test(lower)) return title + ': ' + fmtNum(f.deaths) + ' killed';
  if (/^(birth|death) of /i.test(title)) { const p = predicateOf(title, lead); return p ? title + ', ' + p.replace(/^(?:the|an?)\s+/i, '') : title; }
  if (/^(discovery|invention) of /i.test(title) || / introduced$/.test(title) || /^constellation /i.test(title)) {
    const did = whatItDid(lead);
    return did ? title + ' — ' + did : title;
  }
  if (DULL.test(title)) {
    const did = whatItDid(lead);
    if (did) return title + ' — ' + did;
  }
  const p = predicateOf(title, lead);
  if (p) return title + ': ' + p;
  // no lead paragraph, only Wikidata's one-line description ("North American trade bloc"): use it rather than
  // leaving a bare name that says nothing
  const short = String(lead || '').trim();
  if (short && short.length < 90 && !/^no description/i.test(short) && title.toLowerCase().indexOf(short.toLowerCase()) < 0 && addsSomething(title, short)) {
    return title + ' — ' + short.charAt(0).toLowerCase() + short.slice(1);
  }
  return title;
}
for (const r of out) {
  const f = facts[r[9]] || {};
  while (r.length < 14) r.push(null);
  r[13] = r[0];                                   // the article name, for search and for the panel
  // year-page rows already read as headlines — they only need shortening
  if (r._yearpage) r[0] = polish(trimSentence(r[0]));
  else if (!r._curated) r[0] = polish(written[r[9]] ? written[r[9]] : headline(r));
  delete r._curated; delete r._yearpage;
  if (!r[10] && f.start) r[10] = f.start;         // exact start when the class query only had a year
  r[12] = f.end && f.end !== r[10] ? f.end : null; // exact end: the event persists over its whole span
}

// Weight by rank among Wikidata rows: top 8% -> 4, next 17% -> 3, next 30% -> 2, rest 1.
const wd = out.filter(r => r._sitelinks !== undefined).sort((a, b) => b._sitelinks - a._sitelinks);
wd.forEach((r, i) => { const q = i / wd.length; r[6] = q < 0.08 ? 4 : q < 0.25 ? 3 : q < 0.55 ? 2 : 1; delete r._sitelinks; });
// Sitelinks count how many Wikipedias carry an article, which for bot-created astronomy stubs says nothing about
// whether the discovery was news: every language has "Euporie", so fifteen small moons of Jupiter were taking
// weight-4 cards away from events people remember. Demote a discovery whose own lead calls the thing a satellite,
// a minor planet or an asteroid. Comets, dwarf planets and exoplanets are left alone — those get reported.
const SMALL_BODY = /\b(natural satellite|irregular satellite|moon of (?:Jupiter|Saturn|Uranus|Neptune)|minor planet|asteroid|trans-Neptunian object|main-belt)\b/i;
let demoted = 0;
for (const r of out) {
  if (/^discovery of /i.test(r[0]) && SMALL_BODY.test(r[8] || '') && r[6] > 1) { r[6] = 1; demoted++; }
}
// Hand-set weights win over the sitelink rank: boost.json names the events everyone remembers (9/11, the 2004
// tsunami, COVID-19, the Ukraine invasion, World Cup finals) so they are never outranked by a routine race.
// In the other direction, a Formula One race is never more than weight 3 and a sub-event of a games or a
// championship ("Fencing at the 2020 Summer Olympics – men's team foil") never more than 2.
let boost = {};
try { boost = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'boost.json'), 'utf8')); } catch (e) { /* optional */ }
let boosted = 0, capped = 0;
for (const r of out) {
  const slug = r[9];
  if (slug && typeof boost[slug] === 'number') { if (r[6] !== boost[slug]) boosted++; r[6] = boost[slug]; continue; }
  if (/\bGrand Prix\b/i.test(r[13] || r[0]) && r[6] > 3) { r[6] = 3; capped++; }
  if (/ – | at the \d{4} (?:Summer|Winter) (?:Olympics|Paralympics)/.test(r[13] || r[0]) && r[6] > 2) { r[6] = 2; capped++; }
}
out.sort((a, b) => a[3] - b[3]);
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('curated', out.length - wikidataKept, '| wikidata kept', wikidataKept, 'dropped as duplicate', wikidataDropped, 'dropped as not-an-event', notEvents, 'routine launches', routineLaunches, 'catalogue objects', catalogObjects, 'deaths folded into assassinations', mergedDeaths, 'small bodies demoted', demoted, 'boosted', boosted, 'capped', capped, '| total', out.length);
