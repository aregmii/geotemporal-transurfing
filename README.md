# Geotemporal Transurfing

The Tesseract experience allows you to

- orbit and zoom through space
- pause, reverse or fast-forward time, and event footage
- see what's happening at a different X, Y, Z coordinate at the time of the event

**[Try it](https://geotemporal-transurfing.pages.dev/)**

![The Tesseract experience: play, pause, reverse, accelerate, and travel between events](docs/tesseract-tour.gif)

![Throw the globe, approach Stockholm, and open moving footage of the 2010 royal wedding](docs/demo.gif)

**Pause. Reverse. Accelerate.** Watch Discovery lift off, freeze the footage, then rewind into earlier history. The app supports speeds up to 60×; this walkthrough shows 16×.

![Play the Discovery launch, pause, reverse the footage, and accelerate into earlier history](docs/reverse-time.gif)

**Follow an event across the world.** Read its photographs and context, then choose “Meanwhile, elsewhere” to fly to another location.

![Open the Peru event and follow Meanwhile to Myanmar](docs/event-navigation.gif)

**Control time and space.** Slow down, speed up, reverse, and pause. Switch to independent XYZ movement, look around, and return to Earth.

![Change time direction and speed, move through XYZ, and return to Earth](docs/time-playback.gif)

The opening projects archival wedding footage among the event cards. The reverse sequence uses NASA’s archival Discovery launch footage. The navigation and XYZ walkthroughs use verified archival photographs. Period views show their date range; Moment view shows events on the selected date. [Recording and media credits](docs/demo-media-credits.md).

## How it works

Static data is collected from Wikidata, Wikipedia and Wikimedia. The logic is in [`site/app.js`](site/app.js).

## Run locally

```bash
npm run dev          # serve the existing site at localhost:8000
npm run build        # rebuild event data from existing pipeline outputs
npm run refresh      # fetch updated source data and media
npm test             # clock, event, loading, and observer checks
```

Local serving uses Python 3. [Technical details and data format](docs/internals.md).

Data and media retain their original licenses.

I’d appreciate feedback and ideas.
