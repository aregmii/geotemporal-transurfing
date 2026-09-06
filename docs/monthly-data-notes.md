# Monthly Earth review: scope and data limits

The required coverage is a **minimum of three events per country per calendar month and a minimum of twelve per high-income country per calendar month**. These are coverage targets, not selection caps. The expanded historical catalog does not yet meet them. It is not a live feed, complete world coverage, or an independently fact-checked ranking of important events.

`site/data/monthly-catalog.json` merges all usable-date, Earth-eligible 2011 records from the base catalog and 2011 shard with independently reviewed overrides. `scripts/build_monthly_catalog.cjs` rebuilds it deterministically; `--check` detects stale output. The input files' SHA-256 hashes, per-row lineage, exclusions, source types, review status, country resolution and country/month counts are saved in the result. Nothing is manufactured to fill a coverage target.

`site/data/monthly-pilot.json` remains an 11-event reviewed override seed, not the complete displayed catalog. The optional `site/data/monthly-us-feb-2011.json` supplement adds twelve source-reviewed US February events, including the existing Discovery launch identity. After deduplication, the expanded build contains 1,603 events: 22 independently reviewed and 1,581 catalog imports. The latter retain explicit `catalog-import` status and have not been independently checked for factual dates, headlines or event locations. They must not be described as reviewed merely because their date field has day precision.

## Temporal inclusion

An event belongs to its recorded **start month**. A long-running event is not repeated in subsequent months merely because its stored end year overlaps them. Day and month precision are accepted; year-only dates, invalid dates, and explicit source-precision warnings are excluded. Month precision means the day is unknown, not that the event occurred on the first day.

This directly prevents the 2003 Asian Winter Games from persisting from February into March merely because the legacy interval has no exact end date. Its original row remains unchanged. Other source fields and headlines have not been comprehensively fact-checked.

## Geography

The model can infer country grouping by polygon containment against the bundled `countries-110m.json` map. These are present-day map regions, not historical boundaries, nationality, event participants, or verified event-country claims. Coordinates on shared boundaries receive one deterministic grouping. Unresolved offshore, small-island, and coastal coordinates remain explicitly unresolved in the generated catalog and never count toward a country's target; there is no nearest-country fallback. The low-resolution map can miss genuine terrestrial events. In reviewed rows, an explicit `metadata.monthCountry` takes precedence only when accompanied by `metadata.monthlyReview.source`; this preserves source-backed Japan and Germany associations that coarse polygon containment misses.

The public event rows do not retain a coordinate globe/body or location-confidence field. The raw extraction's `exact`, `place`, `country`, `workplace`, or `associated` confidence was dropped during the merge. A text/body guard conservatively excludes recognized spacecraft, rovers, landers, and extraterrestrial destinations; explicit launch events at named terrestrial launch sites can remain. This is a defensive POC filter, not proof that every remaining coordinate is Earth-verified. The existing year-only Mars Exploration Rover record is excluded. Durable extraction should retain each coordinate's globe and source property.

## Selection and media

Stable IDs and repeated article/date/coordinate occurrences are deduplicated. Reviewed rows override matching identities and conflicting same-article/date projections; explicitly identified wrong-date duplicates are quarantined with reasons. Unrelated occurrences on different dates remain separate. The builder never limits a country's number of records. The existing weight mostly reflects article language-edition popularity and local boosts; it is not a validated significance measure. Broad article titles and incomplete year-page subevent headlines can still misrepresent what happened on their recorded date. For example, the older catalog contains a July 2014 MH370 follow-up titled as a crash; this is not independently verified as a July crash.

The event-specific photograph manifest retains source, license, event date, photo date and precision, photo role (`contemporaneous`, `aftermath`, or `context`), location notes, and verification date. The app loads the much smaller event-specific `event-media.json`, not the legacy article-level `media.json`. A photo's capture date can differ from its event's start date; the interface must not label aftermath or contextual imagery as contemporaneous footage.

## Current coverage and reproducible checks

The expanded build includes 1,490 country-associated records and 113 with unresolved country. February has 180 records, of which 171 are country-associated across 54 countries. Only 21 countries reach three February records and only two reach twelve; one of those two is Libya, so that count must not be reported as two high-income countries meeting the target. The US has 21 February records, twelve independently reviewed and nine imported. Passing the US threshold does not establish the required minimum for all high-income countries.

The builder's coverage output contains all twelve months, explicit zero counts and `shortfallTo3`/`shortfallTo12`, rather than treating unrepresented countries as covered. Before an official income/country list is supplied, its universe is only the 177 map countries and its high-income flags remain unknown; this cannot establish complete sovereign-country or World Bank economy coverage. A classification list can add countries absent from the map to the zero-count audit. Fiscal-year income classification and historical event geography are separate assumptions and must be labeled.

The import currently quarantines the Lorca May 1 duplicate in favor of the reviewed May 11 earthquake and the `Biathlon World Championships 2021` row incorrectly dated in 2011. Other imported errors may remain. The dataset also excludes 23 records with unusable month precision/source warnings and three rejected by the Earth/location guard. These explicit exclusions are safer than assigning invented dates or quietly padding counts.

Run `node scripts/build_monthly_catalog.cjs`, then `node scripts/build_monthly_catalog.cjs --check` and `node --test tests/monthly-catalog.test.cjs`. The tests cover no-cap retention, reviewed overrides, optional supplements, stable/media identity, duplicate lineage, date/space exclusions, unresolved-country gaps and twelve-event high-income targets.

Primary-source spot checks on September 5, 2026:

- [NASA's STS-133 mission page](https://www.nasa.gov/mission/sts-133/) verifies Discovery's February 24, 2011 launch at Kennedy Space Center, Pad 39A. It supports the Kennedy launch row, not the duplicate row plotted at NASA headquarters.
- [Japan Meteorological Agency's earthquake summary](https://www.jma.go.jp/jma/en/2011_Earthquake/Information_on_2011_Earthquake.html) verifies March 11, 2011 and the offshore northeastern Japan location. The pilot uses the source's hypocenter coordinates with explicit provenance, retaining the event's stable ID and media key. Country grouping by affected Japan is a reviewed event association, not polygon containment of an offshore point.
- [GeoNet's Christchurch account](https://www.geonet.org.nz/earthquake/story/3468575) verifies February 22, 2011. Its heading gives M6.2 and its description ML6.3; neither supports the catalog headline's M6.8. A reviewed title can simply say "Christchurch earthquake" without asserting a magnitude.
- [FIS's official 2011 championship results](https://medias4.fis-ski.com/pdf/2011/AL/0073/2011AL0073.pdf) identify February 7–20 and Garmisch-Partenkirchen, Germany. The current catalog coordinate groups this event into Austria, demonstrating that inferred country is not verified event location.
- [Human Rights Watch's firsthand report](https://www.hrw.org/news/2011/01/27/egypt-end-crackdown-peaceful-demonstrations) identifies the January 25 demonstrations at Tahrir Square in Cairo.
- [IAEA's Fukushima lessons-learned portal](https://gnssn.iaea.org/FukushimaLessonsLearned/SitePages/default.aspx) dates the accident at Japan's Fukushima Daiichi Nuclear Power Station to March 11, 2011.
- [Westminster Abbey's wedding account](https://www.westminster-abbey.org/abbey-news/abbey-hosts-royal-wedding) verifies the April 29 wedding of Prince William and Catherine Middleton at the Abbey.
- [Spain's IGN Lorca anniversary account](https://www.ign.es/web/gl/decimo-aniversario-lorca) verifies May 11 and the earthquake near Lorca, Murcia. The original approximate catalog marker is retained.
- [The 22 July Centre](https://www.22julisenteret.no/en) verifies the July 22 attacks in Oslo and on Utøya. The retained Utøya marker does not represent the Oslo camera location of the linked photograph.
- [The UK Government's response to the riots report](https://assets.publishing.service.gov.uk/media/5a7cc9d9e5274a34d8d32f31/Govt_Response_to_the_Riots_-_Final_Report.pdf) records the August 6 Tottenham protest and disorder. The pilot corrects the inherited place label Bristol to Tottenham, where the retained coordinates already point.
- [New York City Council Resolution 1125-2011](https://legistar.council.nyc.gov/LegislationDetail.aspx?GUID=A7DA630D-C460-437C-A50C-8206F6DC72F8&ID=1014486&Options=&Search=) dates the beginning of Occupy Wall Street at Zuccotti Park to September 17.

Run `node --test tests/monthly-model.test.cjs` for calendar boundaries, retained month precision, source warnings, non-Earth exclusions, polygon holes/dateline/islands, actual problematic records, and exact 10/5/1-second playback tests.

## API integration

The generated catalog retains compact rows compatible with `GTEvents.parseRow`. Per-row `metadata.monthlyCatalog` contains `status`, `independentlyReviewed`, `sourceFiles`, `country`, `countryMethod`, event-media flags and a fact-checking caveat. `summary` counts reviewed/imported/source types and exclusions. `coverage.months` contains `availableByCountry` entries with available/reviewed/imported counts and explicit `unmetMinimums`. These coverage denominators are the full imported dataset, not the current camera view, category filter, or a display-selection cap.

`stepIndex(index, elapsed, dt, direction, secondsPerMonth, count)` returns `{index, elapsed, direction, ended}`. Carry its elapsed seconds forward between frames, and reset elapsed on a manual month jump, speed change, or direction change. A paused call preserves elapsed. Playback stops upon reaching the first or last available month; it never advances beyond those bounds.
