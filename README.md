# Chrono Geography Transfusion

A globe with a time slider. Spin to a place, slide to a moment, click an event: a photograph, a paragraph, a source, and what was happening elsewhere in the world at the same time.

Three rails: **2000–2025** (a slider: a 5-year window you drag a year at a time), **Last 100 years** (the same with a 10-year window, photographs for most events) and **All of history** (eleven eras from the first stone tools 3.3 million years ago to today). A ticker at the bottom shows same-day coincidences on different sides of the world. With clips fetched, a **Sound** toggle plays each event's audio or video louder as you zoom toward its card.

## How it works

```
Wikidata ──SPARQL──▶ extract_events.py ──▶ events_wikidata.json
Wikipedia ──REST───▶ fetch_summaries.py ──▶ lead paragraph + lead-image URL per event
Commons ───API─────▶ fetch_images.py ────▶ site/img/<hash>.jpg + site/data/images.json (licence + credit)
curated/*.json ────▶ merge.js ───────────▶ site/data/events.json (+ data/y/<year>.json shards and data/index.json past 12,000 rows)
Commons ───API─────▶ fetch_media.py ─────▶ site/media/<hash>.opus|webm + site/data/media.json (one clip per major event; needs ffmpeg for small files)
```

`site/` is a plain static site: `index.html`, `app.js`, `styles.css`, vendored three.js and astronomy-engine, and the generated data. The sky behind the Earth is real: stars and constellations from the Yale Bright Star Catalog placed for the moment shown, the Moon at its true distance and phase, planets, and the Earth lit from the Sun's actual direction. A dated event shows the sky of that day. No build tool, no framework. Cloudflare Pages (or any static host) serves the `site/` directory as-is.

Everything the page shows comes from files in `site/`. The pipeline only runs when the data is refreshed.

## Running it

```bash
npm run dev          # serves site/ on http://localhost:8000
```

That is the whole app. `site/data` and `site/img` are committed, so a fresh clone runs without touching the pipeline.

## Refreshing the data

```bash
npm run refresh      # events + summaries + images for 1926 onward  (~30 min first time, minutes after)
npm run refresh:all  # also fetch images for every earlier era
```

Every step caches to `pipeline/*_cache/` and resumes, so re-runs are cheap. `refresh.sh` needs Python 3.9+ with `requests` and `pillow` (installed on first run) and Node 18+.

The GitHub Actions workflow in `.github/workflows/refresh-data.yml` runs the same script every Monday and on demand (Actions → Refresh data → Run workflow), then commits `site/data` and `site/img`. With Cloudflare Pages connected to the repository, that push is the deploy.

## Data model

One event is one row in `site/data/events.json`:

| index | field | notes |
|---|---|---|
| 0 | title | |
| 1, 2 | lat, lon | decimal degrees |
| 3, 4 | start, end | years; negative is BCE (480 BCE is `-480`, not Wikidata's astronomical `-479`) |
| 5 | category | `con` conflict · `cul` culture & belief · `sci` science & discovery · `dis` disasters |
| 6 | weight | 1–4, by rank of Wikipedia sitelink count; drives marker size and the per-window cap |
| 7 | place | label of the resolved location |
| 8 | description | Wikipedia lead paragraph, trimmed to 80 words; curated rows carry their own text |
| 9 | slug | English Wikipedia article name; also the key into `images.json` |
| 10 | date | exact date `YYYY-MM-DD` when Wikidata records one, else `null`. For the class queries a date on 1 January is treated as year-precision and dropped (the `wdt:` value carries no precision flag); the wide pull checks precision and keeps them; `pipeline/curated_dates.json` fills in checked dates for curated rows |
| 11 | who | discoverer, inventor or author, when known |

`site/data/images.json` maps slug → `{ file, author, license, licenseUrl, source, filePage }`. Only files under Creative Commons, CC0, public-domain or GFDL terms are kept; the app shows the credit in every panel. `site/data/media.json` does the same for clips (`{ file, kind, title, author, license, licenseUrl, filePage, seconds }`), found via `pipeline/curated_media.json`, the item's Wikidata audio/video (P51/P10), then a Commons search; same licence rule.

### What qualifies as an event

An event is included if it **happened somewhere a reader can be shown**. Battles and earthquakes carry a coordinate; a birth resolves to the birthplace; an album release has no place and is excluded. This one rule is what keeps founders and turning points and drops celebrity milestones. Details in `docs/spec.html`, Sections 06–07.

**v0.6 wide pull.** Besides the class queries, `extract_events.py` now asks for every item with a *day-precision* point in time (P585, precision checked through `p:`/`psv:` so these dates are exact by construction), coordinates and at least `DATED_MIN_SITELINKS` language editions, plus every person above `PERSON_DEEP_MIN_SITELINKS` with a day-precision birth or death. Queries run in date slices that split themselves in half when they time out or hit the row cap. Expect the first run to take a few hours and to multiply the row count; `--no-wide` skips it.

`pipeline/events_wikidata.json` (the extractor's output, not committed) carries five more columns: 10 confidence, 11 sitelinks, 12 source (`event`, `discovery`, `launch`, `publication`, `person`), 13 exact date, 14 discoverer or author, 15 Wikipedia lead-image URL (written by `fetch_summaries.py`, read by `fetch_images.py`).

`merge.js` also drops routine launches (fewer than 30 sitelinks — every Shuttle and Soyuz flight has an item), events dated after the current year, and "Death of X" rows that duplicate an "Assassination of X" in the same year; discovery rows are titled "Discovery of", "Invention of" or "Constellation … charted" from what the first sentence of the article says the thing is.

### Ranking

"Major" means the number of language editions of Wikipedia with an article. Each window shows the top N by that rank; N grows as you zoom in.

## Layout

```
pipeline/
  extract_events.py   Wikidata SPARQL, one class at a time, plus births/deaths of well-known people
  fetch_summaries.py  Wikipedia REST summaries
  fetch_images.py     Commons licence check + thumbnails → site/img
  fetch_media.py      one licensed audio/video clip per major event → site/media (curated_media.json first)
  merge.js            curated + Wikidata rows, dedupe, clean-up, weight by rank
  curated_dates.json  exact dates for curated rows (slug → YYYY-MM-DD)
  build.js            runs merge into site/data/events.json
  refresh.sh          all of the above, in order
  curated/            342 hand-written rows: prehistory, founders, and well-known events (checked, but not Wikidata-sourced)
site/
  index.html app.js styles.css
  assets/             earth.jpg (NASA Blue Marble), countries-110m.json (Natural Earth), sky.jpg (baked star map, equatorial coordinates)
  vendor/             three.min.js r128, astronomy.browser.min.js (astronomy-engine 2.1.19, MIT)
  build_sky.js        exports star/Milky Way data from the d3-celestial package; mw_mask.js + bake_sky.py render assets/sky.jpg from it (npm run build:sky)
  data/               generated: events.json, images.json, media.json, and y/<year>.json + index.json when sharded
  img/                generated: photographs
  media/              generated: clips
docs/
  spec.html           product spec — decisions, requirements, wireframes, open questions
```

## Known gaps

- Wikidata's coverage is strongest for Europe, North America, and the last two centuries. Prehistory and the ancient eras rely mostly on the curated rows.
- Three class identifiers (Olympic Games, ecumenical councils, premieres) return nothing and need checking against wikidata.org.
- Date precision is inferred, not queried: a real 1 January event loses its day. Querying `p:`/`psv:` with `wikibase:timePrecision` would fix it.
- The Wikidata class and property identifiers were written without live access to wikidata.org and have only been validated by what they returned.
- No clustering yet: dense windows show the top N markers and hide the rest until you zoom. The wide pull will make this the next problem.
- Time of day does not exist in Wikidata (its time type stops at day precision in practice), so "simultaneous" means same calendar day; hours and minutes would need other sources (USGS for earthquakes, launch logs, aviation databases).
- Desktop only. A phone-sized viewport works but is not designed for.

## Deploying to Cloudflare Pages

Create a Pages project from this repository with **no build command** and **output directory `site`**. Every push to `main` — including the scheduled data commits — deploys.

## Licences

Code is MIT. Data and images have their own terms; see `LICENSE`.
