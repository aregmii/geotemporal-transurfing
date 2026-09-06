# Monthly Earth POC — local review

Local preview: http://127.0.0.1:8918/?review=monthly-earth-v1

Status: local, uncommitted; not published. Based on f894966 in a separate review worktree. The original checkout is unchanged.

## Implemented

- Earth only, January–December 2011; starts in February.
- Discrete calendar-month steps at 10, 5 or 1 seconds per month in either direction.
- Up to three selected records per country, with a country-filtered monthly event list.
- Eleven reviewed records, not comprehensive coverage. See `monthly-data-notes.md` for sources, corrections and limits.
- A selected event holds the world month. Its recording has independent play, pause, reverse, seek and speed controls.
- Verified audio plays only from the selected recording at normal forward speed. Silent, unknown-audio and reverse playback states are explicitly labelled. No synthetic ambience.
- Present-day country geometry, with source-backed event-country overrides where a coarse map cannot resolve a coastal or offshore location.
- Historical imagery retains its date and attribution. Still photographs are not presented as generated live footage.
- Visible prototype/data-accuracy disclaimer. No live-feed or other-planet claim.

## Checks completed

- `node --test tests/*.test.js tests/*.test.cjs`: 101 passed.
- `python3 -m unittest discover -s tests -p 'test_*.py'`: 9 passed, including local HTTP byte-range serving.
- `git diff --check`: passed.
- Browser initial-state inspection: February 2011, three selected events in three countries, disabled audio before event selection, monthly rail, speeds and disclaimer rendered.
- The page and all requested app/data/Earth-texture files returned HTTP 200. The browser requested a missing optional favicon; no functional dependency was missing in that load.

The bundled Python runtime lacks `requests`; the existing system Python completed all nine Python checks. Browser automation repeatedly timed out and a native browser fallback was interrupted. Desktop/mobile visual review and audible playback are therefore **not signed off** solely on the passing automated tests.

## Review next

1. Open **Browse Feb 2011**, then select the STS-133 launch. Enable sound and press Play. Confirm the recording is audible and February stays fixed.
2. Pause, seek and reverse the recording. Confirm reverse is silent; return to 1× forward playback to hear audio again.
3. Close the event. Select 1 second per month and play forward/reverse. Confirm whole-month changes, no daily drift and no wrap beyond January/December.
4. Select January's Tahrir event: the recording is silent and the UI should say so.
5. Select June: an empty selection is explicitly incomplete coverage, not a claim that no events happened.
6. Check country filtering, keyboard navigation, the smallest target mobile viewport and selected-event deep links.

Do not publish until these browser checks and the user review are complete. Expanding the dataset is a separate step; the POC does not promise three events for every country/month.
