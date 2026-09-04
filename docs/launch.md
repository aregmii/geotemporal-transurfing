# Launch notes

Working notes for sharing Geotemporal Transurfing. Facts about each channel were checked on 3 Sep 2026 where a link is given; anything without a link is experience, not a rule.

## What has to be true before posting

1. **One URL that works on a phone.** The playground is a 10 MB single file behind a login-free but unusual domain; people on LinkedIn tap links from phones. Cloudflare Pages gives `geotemporal.pages.dev` (or a domain you own), loads the data in pieces, and shows the clips.
2. **A link preview.** LinkedIn, Reddit and Slack show the page's `og:image` and `og:description`. The site now carries them (`site/index.html`); the image is `site/assets/og.jpg` (1200×630, the globe with a few cards).
3. **A 15–25 s recording**, no narration, that shows the three things nobody guesses from a screenshot: the globe turning with the cards on it, the time slider moving with NOW changing, and a click opening a clip with "concurrent events elsewhere". Record at 1280×720; LinkedIn plays MP4 inline and autoplays muted, so the first two seconds must already be moving. `docs/demo.gif` is the version for GitHub and Reddit comments (GIF autoplays in a README).
4. **A public repo with a README that a stranger understands in a minute**: what it is, a screenshot, the URL, how to run it, how to contribute. Licence: MIT for code; data and media carry their own terms (already in LICENSE).
5. **A "share this moment" button** so people post specific views ("look at April 1994") rather than the home page. The URL hash already encodes mode, month and event; the button copies it.

## Channels, in the order to use them

| Channel | Why | Gate | How to post |
|---|---|---|---|
| **LinkedIn** (your network) | Where the career upside is; visual posts with a native video do best in your own feed | None | Native MP4 upload (not a YouTube link), first line is the hook, the URL in the first comment *and* in the text (LinkedIn de-prioritises external links less than it used to, but a comment link is the habit people expect), 3–5 hashtags at the end |
| **Show HN** (news.ycombinator.com) | The one place a link with no marketing can reach 50k developers in a day; no karma requirement, just an account | Must be something people can try; no signups, no landing page ([Show HN rules](https://news.ycombinator.com/showhn.html)) | Title "Show HN: Geotemporal Transurfing – spin the Earth, slide through time, hear what was happening"; post the site URL, then add a first comment explaining the data (Wikidata + Wikipedia + Commons, the sky is real, the licences) and what you would like feedback on. Post Tue–Thu, 8–10 am US Eastern |
| **r/InternetIsBeautiful** | Made for exactly this: interactive sites people play with | Reddit blocks new accounts by karma/age in many subs; this one filters heavily by account age (direct rule fetch was blocked from here — read the sidebar before posting) | Title is the site, not you; no "I made"; post the URL; answer every comment for the first hour |
| **r/dataisbeautiful** | Big; likes maps and time | OC posts must state tool and data source in a comment ([wiki](https://en.wikipedia.org/wiki/R/dataisbeautiful)) | Post the GIF as media with `[OC]` in the title, source + tool in the first comment, link in that comment |
| **r/webdev** | Developers who might contribute | Self-promotion only on **Showoff Saturday**, technical focus ([r/webdev guide](https://www.redditgrowthdb.com/database/subreddits/webdev)) | Saturday; lead with the technical angle (three.js, no build step, sky from the Yale catalogue, 1 MB of data per window) |
| r/MapPorn, r/history, r/threejs, r/GraphicsProgramming | Smaller, focused | Varies; several require karma | Same GIF, subject-specific first line |
| **Hacker News "Ask HN" / lobste.rs / dev.to / Bluesky / Mastodon** | Overflow; dev.to and Mastodon have no gates | None | A short write-up: "what I learned building a real-sky globe in three.js" — the technical story gets shared by people who would never share a product post |
| Product Hunt | Optional; needs a maker profile and images; worth it only once the site has a domain and works on mobile | Account | Launch on a Tuesday |
| Wikimedia community (Wikidata project chat, Commons village pump) | They love licensed re-use of their data; may fix your data upstream | None | A short thank-you post with the URL and what you pull |

### The Reddit karma problem

New accounts can't post in most large subreddits. Two honest routes: spend a week commenting usefully in the subs you plan to post in (that is how the "engage first" advice from the r/webdev guide reads in practice), or ask a friend with an aged account to post it and be named in the comments as the author. Don't buy karma and don't cross-post the same link in five subs on the same day; both get accounts shadow-banned.

## Post drafts

**LinkedIn (hook first, then the ask).**

> Spin the Earth. Slide to a month. Every event that was in the news is standing on the globe where it happened — and when you click one, you see what else was going on elsewhere in the world that same day.
>
> I built this over a few weeks with Claude as the engineer. Wikidata and Wikipedia supply ~N events with exact dates, Wikimedia Commons the photos and clips (all licensed), and the sky behind the Earth is the real sky for that moment — Yale Bright Star Catalog, Moon at its true phase.
>
> What I want to find out: do same-day coincidences across the world reveal patterns, or just make good stories? Try 11 September 2001, then 2 May 2011.
>
> Open source, MIT. Link in the first comment. If you want to add your country's events, the CONTRIBUTING file is one page.
>
> #dataviz #history #opensource #threejs #wikidata

**Show HN first comment.** What it is in two sentences; the data pipeline in four (sources, licences, the weekly refresh); the two things that were hard (the sky, and headlines from lead paragraphs); what feedback you want (density per country, mobile).

**Reddit title (r/InternetIsBeautiful).** "A globe you spin and a time slider you drag — every event stands where it happened, with what was happening elsewhere that day."

## Measuring

Cloudflare Web Analytics is free and needs no cookie banner; turn it on in the Pages project. Watch two numbers: sessions, and the share of sessions that open an event panel (the hash changes to `&e=`; the analytics script can count that as a page view).

## What to expect

A Show HN that lands on the front page brings 20–60k visits in a day and a handful of GitHub stars per hundred visitors; most Show HNs don't land, and that is normal — post it once, well, and move on. LinkedIn traffic is smaller but is the audience that leads to conversations about work. Reddit is the least predictable and the most sensitive to how the post reads (site first, you second).
