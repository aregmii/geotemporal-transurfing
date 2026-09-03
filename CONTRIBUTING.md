# Contributing to Geotemporal Transfusing

Thanks for looking. This is a small, dependency-light project on purpose: the app is three files, the pipeline is one script per data source, and everything the page shows is a file in `site/`. Most contributions fall into one of four kinds.

## 1. Add or fix an event (no code)

Hand-checked events live in `pipeline/curated/*.json`, one row per event in the schema described in the README ("Data model"). Exact dates for curated rows go in `pipeline/curated_dates.json`, hand-picked clips in `pipeline/curated_media.json`. Rebuild with `node pipeline/build.js` and open `site/index.html` (or `npm run dev`).

Rules of thumb: an event must have a place a reader can be shown; the description is your own words (not copied from Wikipedia); the slug is the English Wikipedia article name.

## 2. Add a data source

Each source is one script in `pipeline/` that writes rows in the shared row shape and caches every remote reply in its own `*_cache/` directory, so re-runs are cheap and a failure halfway loses nothing. Look at `fetch_facts.py` (small) or `extract_events.py` (large) for the pattern. Add the step to `pipeline/refresh.sh`, document the source in the README, and keep to the Wikidata/Wikipedia/Commons etiquette already in the scripts: a descriptive User-Agent, a pause between calls, back-off on 429.

Licensing is not optional: photos and clips must come with a licence the site can show (`fetch_images.py` and `fetch_media.py` show how the credit is carried through to the panel).

## 3. Change the app

`site/app.js` is plain ES5-style JavaScript with three.js r128 and astronomy-engine vendored in `site/vendor/`; no bundler, no framework, no build. Keep it that way — a contributor should be able to open `index.html` from disk and read the whole thing top to bottom. Sections are marked with `// ---------- name ----------` comments. `pipeline/playground.js` builds the single-file version used for hosted previews; if you add a data file, add it there too.

The visual rules that took the longest to get right, and that pull requests should respect: the Earth is the real Earth (NASA Blue Marble), the sky is the real sky for the moment shown, the globe never stops turning, and nothing on the globe pretends to be more precise than the data (a year-only event covers its year; a same-day coincidence is same-day).

## 4. Report data problems

Wrong headline, wrong place, a clip that does not match its event: open an issue with the event's Wikipedia slug and what you expected. Headlines are generated (`merge.js` rules, or `headlines_llm.py` when a key is present) so the fix is usually a rule, not a one-off edit.

## Running things

```bash
npm run dev          # serve site/ locally
npm run build        # rebuild site/data from pipeline outputs (seconds)
npm run refresh      # full data refresh (hours; needs network; caches everything)
npm run playground   # single-file build for previews
```

Python 3.9+ with `requests` and `pillow`; Node 18+; `ffmpeg` optional (clips are cut small with it).

## Style

Short files, long comments where a decision was made, no abbreviations in names, and every remote call cached. Commit messages say what changed and why; the first line is a sentence.
