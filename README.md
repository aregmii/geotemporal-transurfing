# Geotemporal Transurfing

Roll the Earth, slide time, pick a moment. Every event stands where it happened; the line under the globe says what else happened that same day on the other side of the world.

**[Try it](#)** · 72,000 events, 2000–2025 · three.js, no build step · MIT

![The film: the globe turning, time running from August to September 2001, New York lighting up, the 9/11 panel opening](docs/demo.gif)

*Zoom out until the Moon is in frame, in until a country fills it — more events appear the closer you come.*

![Zooming from far out down onto Europe and back](docs/zoom.gif)

*Time runs like a film: play, pause, 2× to 16×, forward or back. Cards rise as their day approaches and sink as it passes.*

![Fast-forward through 2020 and rewind](docs/time.gif)

*Click a line under the globe and you fly there: the globe turns, the camera comes down, the panel opens with what else happened that day.*

![Clicking the Tōhoku earthquake line: the globe turns to Japan and the camera descends](docs/click.gif)

```bash
npm run dev          # serve site/ at localhost:8000 — a fresh clone runs as-is
npm run build        # rebuild site/data from the pipeline's output (seconds)
npm run refresh      # pull everything again from Wikidata, Wikipedia and Commons (hours)
```

Events and dates come from Wikidata, descriptions from Wikipedia (CC BY-SA), photographs and clips from Wikimedia Commons under the licence shown in each panel; the Earth is NASA's Blue Marble and the sky is the real sky for the moment shown. How it fits together: [docs/internals.md](docs/internals.md). To add an event, fix a headline or add a source: [CONTRIBUTING.md](CONTRIBUTING.md).

Code is MIT; data and media keep their own terms ([LICENSE](LICENSE)).
