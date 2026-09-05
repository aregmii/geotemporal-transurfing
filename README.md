# Geotemporal Transurfing

Roll the Earth, slide time, pick a moment. Every event stands where it happened; the line under the globe says what else happened that same day on the other side of the world.

**[Try it](https://geotemporal-transurfing.pages.dev)** · 72,000 events, 2000–2025 · three.js, no build step · MIT

![The film: the globe turning, time running from August to September 2001, New York lighting up, the 9/11 panel opening](docs/demo.gif)

*Zoom out until the Moon is in frame, in until a country fills it — more events appear the closer you come.*

![Zooming from far out down onto Europe and back](docs/zoom.gif)

*Time runs like a film: play, pause, 2× to 16×, forward or back. Cards rise as their day approaches and sink as it passes.*

![Fast-forward through 2020 and rewind](docs/time.gif)

*Click a line under the globe and you fly there: the globe turns, the camera comes down, the panel opens with what else happened that day.*

![Clicking the Tōhoku earthquake line: the globe turns to Japan and the camera descends](docs/click.gif)

## How it works

**The data** is built once, offline, and committed. `pipeline/extract_events.py` asks Wikidata for every item with a day-precision date, coordinates and enough language editions (that count is the importance rank), plus the "2015 in India"-style year pages from Wikipedia so small countries are not empty. `fetch_facts.py` pulls the winner, the death toll, the magnitude and the exact start and end of each event; `merge.js` turns those into a headline ("Argentina wins 2022 FIFA World Cup Final") and writes `site/data/events.json`. `fetch_images.py` and `fetch_media.py` take one photograph and one clip per event from Wikimedia Commons, keeping only files under CC, public-domain or GFDL terms, with the credit shown in the panel.

**The page** is three files — `index.html`, `app.js`, `styles.css` — and vendored three.js. Time is a clock that runs continuously; each event has a prominence curve (fades in over three days, holds, fades out; a war stays lit while it runs), and the globe shows the top-ranked events for the moment, more of them the closer the camera. Cards are sprites on beams along the surface normal, so a hologram stands upright wherever the globe is turned. "Meanwhile" is strict: the same calendar day, at least 1,200 km away. Where events cluster, the ground glows, and the glow leaks over the limb so you can find it from the far side. The sky is real for the moment shown — Yale Bright Star Catalog stars, the Moon at its true distance and phase, the Earth lit from the Sun's actual direction — and hovering a star tells you what it is and how far.

```bash
npm run dev          # serve site/ at localhost:8000 — a fresh clone runs as-is
npm run build        # rebuild site/data from the pipeline's output (seconds)
npm run refresh      # pull everything again from Wikidata, Wikipedia and Commons (hours)
```

The full description of the pipeline, the row format and the known gaps: [docs/internals.md](docs/internals.md). To add an event, fix a headline or add a source: [CONTRIBUTING.md](CONTRIBUTING.md).

## Next steps

- Headlines with an angle: the rule-based titles say what happened; a model pass (`pipeline/headlines_llm.py`) would say why it mattered.
- Time of day: Wikidata stops at the day, so "meanwhile" means the same date. Earthquakes (USGS), launches and flights have exact times elsewhere.
- Wars and long events with month- or year-precision end dates currently end after a month; the next refresh carries the real span.
- The Earth of that day: NASA's daily satellite imagery so clouds, storms and seasons match the moment.
- Sound: each event's own clip louder as you approach, the silence of space far out.
- Before 2000, and a phone layout. Both are data and design work, not engineering.

## What this is

A proof of concept, nothing more: an idea about what it would feel like to be unbound by space and time and look at the Earth's recent past all at once. It was prototyped quickly with Claude (Anthropic's model) doing most of the coding from spoken direction, over a few days, so expect rough edges — headlines written by rules, uneven coverage between countries, a desktop-only layout. The design decisions worth keeping are written down in [docs/internals.md](docs/internals.md); everything else is up for grabs.

Code is MIT; data and media keep their own terms ([LICENSE](LICENSE)).
