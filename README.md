# Geotemporal Transurfing

Roll the Earth, slide time, pick a moment. Every event stands where it happened; the strip under the globe says what else happened that same day on the other side of the world.

![The globe turning with event cards on it, the time slider moving, and an event panel opening](docs/demo.gif)

**[Try it](#)** · 71,000 events, 2000–2025 · three.js, no build step · MIT

```bash
npm run dev          # serve site/ at localhost:8000 — a fresh clone runs as-is
npm run build        # rebuild site/data from the pipeline's output (seconds)
npm run refresh      # pull everything again from Wikidata, Wikipedia and Commons (hours)
```

Events and dates come from Wikidata, descriptions from Wikipedia (CC BY-SA), photographs and clips from Wikimedia Commons under the licence shown in each panel; the Earth is NASA's Blue Marble and the sky is the real sky for the month shown. How it all fits together: [docs/internals.md](docs/internals.md). To add an event, fix a headline or add a source: [CONTRIBUTING.md](CONTRIBUTING.md).

Code is MIT; data and media keep their own terms ([LICENSE](LICENSE)).
