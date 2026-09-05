# Internals

How the data is built and the globe is rendered. The [README](../README.md) is the short version.

## How it works

```text
Wikidata + Wikipedia + curated rows
    → pipeline extraction, summaries, facts and merge
    → site/data/events.json + optional year shards and index.json

Commons image/clip candidates + source review
    → event-photos.json + event-media.json
    → local photographs and clips associated with specific events

One simulation clock + event intervals + observer position
    → visible events, geographic cards, panels and the modeled sky
```

`site/` is a static site using vendored Three.js and Astronomy Engine. It runs from the supplied files without a live data API or frontend build step. The pipeline runs separately when refreshing data.

## Running and checking it

Run from the repository root:

```sh
npm run dev                            # http://localhost:8000
npm test                               # time, events, shards, observer and JPL comparisons
python3 tests/test_event_precision.py   # extractor date-precision regression checks
node scripts/validate-event-photos.js   # event identities, files and attribution metadata
node scripts/validate-event-media.js    # identities, dates, tracks, duration and full decoding
```

The Python test requires `requests`; pipeline dependencies are listed in `pipeline/requirements.txt`. The media validator requires `ffmpeg` and `ffprobe` on `PATH`. The validators check the recorded associations and local files; source review remains necessary when adding media.

The sky tests use pinned, archived JPL Horizons vectors, with no network request during the test. See [observer and sky validation](observer-and-sky-validation.md) for the tested dates, observer positions, interpolation method and accuracy limits, and the [fixture source ledger](../tests/references/upstream-source.json) for URLs and checksums. Passing those samples does not establish accuracy for every date or an apparent, telescope-grade sky.

## Data model

Each event is a compact row in `site/data/events.json` or `site/data/y/<year>.json`:

| Index | Field | Meaning |
| --- | --- | --- |
| 0 | title | Display headline |
| 1, 2 | latitude, longitude | Decimal degrees |
| 3, 4 | start, end year | Historical numbering: `-480` means 480 BCE |
| 5 | category | `con` conflict, `cul` culture, `sci` science, `dis` disasters |
| 6 | weight | Relative prominence, derived from source ranking or curated values |
| 7, 8 | place, description | Display location and summary |
| 9 | slug | English Wikipedia article name; an article may describe multiple events |
| 10 | start date | ISO calendar date when available, otherwise `null` |
| 11 | who | Discoverer, inventor or author, when known |
| 12 | end date | Interval end when available, otherwise `null` |
| 13 | article name | Original source title, retained separately from the headline |
| 14 | metadata | Stable ID, source identity, media key, point/interval kind, start/end precision and provenance |

`pipeline/event-metadata.js` produces the metadata; `site/event-model.js` interprets it. Dates carry day, month or year precision. The extractor reads the Wikidata statement value and its matching `wikibase:timePrecision`: a documented January 1 survives, while a padded year or month value is not promoted to an exact day. Legacy records without retained precision remain marked for verification. Checked corrections live in `pipeline/event_overrides.json` and `pipeline/curated_dates.json`.

A day-precision point occupies one calendar day. An interval includes its stated end day; internally, bounds are start-inclusive and end-exclusive. Month/year precision describes the known period, with uncertainty shown to the reader. A signing ceremony and the treaty it establishes can therefore have different temporal behavior even when they share an article.

`site/time.js` owns calendar conversion and arithmetic. Its internal astronomical year zero is 1 BCE; row parsing converts the historical numbering above. `app.js` holds one `nowT` for playback, selection, the timeline and sky. Direction and speed are independent. Moment view tests interval containment; period views include events overlapping the displayed period. The clock and event eligibility stop at the actual present, with bounds refreshed while the tab remains open. Deep time stays numeric when a JavaScript `Date` cannot represent it.

## Photographs, clips and density

The renderer uses the reviewed [event-photo manifest](../site/data/event-photos.json) through `site/event-photos.js`, and the [event-media map](../site/data/event-media.json) for clips. Associations identify the event by article, source date and location, with a preserved `mediaKey` across corrections. They do not inherit an unrelated birth, death or later event's media simply because the article slug matches.

Photo records include capture date, role, location, credit, license and Commons source page. Globe photographs require a known day at or before the simulation clock; contextual photos are reserved for the panel. Automatic clips require an approved contemporaneous role and recording date at or before the clock. Panels show source credits and contextual information. See [event media sources](event-media-sources.md) for the reviewed clips. Legacy `images.json` and `media.json` remain harvest inventories, not automatic proof that an image or clip depicts a particular event.

Cards are ranked after temporal, camera-facing and viewport checks, so an unseen hemisphere cannot consume the visible-card budget. Density and zoom change that budget. Nearby cards fold into anchored groups; records without a verified photograph use text and markers. `site/shard-loader.js` tracks loading, success and failure separately, prefetches nearby years and permits retries after a failed request.

## Observer and sky

`site/observer.js` handles physical observer coordinates, frame transformations, sky directions, occlusion and elapsed-time momentum. Scene units are mean Earth radii. Orbit moves the camera around Earth; free movement separates X/Y/Z position from viewing direction. Return to Earth restores an orbit view. Geographic projection, card stacking and picking use the same camera frame.

Stars come from the pinned magnitude-6 catalog in `site/assets/stars-catalog.json`, with its source ledger and BSD license alongside it. The renderer uses catalog points, not the legacy baked `sky.jpg`. Stars and labels share precession, nutation and sidereal rotation. Solar-system geometric positions use Astronomy Engine and subtract the physical observer position; the Moon preserves its physical distance and radius. Planet points are enlarged for visibility.

The modeled sky supports 1900–2100, subject to the application's present-time limit. Unsupported dates show an unavailable sky, never a substituted modern date. This educational view omits light-time, aberration, atmospheric refraction and stellar proper motion; Earth is spherical and display brightness is adapted. [Observer and sky validation](observer-and-sky-validation.md) documents the calculations and their limits.

## Refreshing the data

```sh
npm run build        # merge available local source files and regenerate event shards
npm run refresh      # fetch events; harvest images/clips from 1926 onward
npm run refresh:all  # expand media harvesting to earlier eras
```

The refresh script requires Python, Node and network access. It fetches Wikidata records, Wikipedia year-by-country pages, summaries, facts, media candidates and event links. Curated rows supplement those sources. Optional generated headlines require the configured API credentials. The script uses caches but can continue after failed queries; inspect its errors and coverage before treating a refresh as complete. A build without local extracted source files uses the curated rows, so it does not reproduce the full supplied dataset by itself.

Fresh harvesting does not approve photographs or clips for the renderer. Review their event association, date, source and license, update the event-specific maps, and run the validators. Review the workflow in `.github/workflows/refresh-data.yml` before enabling automated refresh publication.

## Known gaps

- Coverage reflects Wikidata, English Wikipedia and curated choices; geographic and historical density is uneven.
- Many dates and locations are coarse or uncertain. Same-day context does not establish simultaneous occurrence within that day.
- Headline and summary rules still need editorial review, and only reviewed media associations become photographic cards or automatic clips.
- The camera stays within the Earth neighborhood. Physical touch-device testing remains outstanding.

## Deployment and licenses

Serve `site/` with any static host. For Cloudflare Pages, use no build command and set the output directory to `site`. Deployment behavior depends on the connected repository and branch settings.

Code is MIT. Data, photographs, clips and catalog assets retain their own terms and source credits; see [LICENSE](../LICENSE) and their manifests.
