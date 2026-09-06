# Monthly recommendations — local review

Date: September 5, 2026. Local changes only; not published.

## Changes

- README and blog project listing/detail credit Three.js, Astronomy Engine, NASA Blue Marble imagery, and Natural Earth boundaries. JSON is a data format, not an upstream framework; existing data/media credits remain.
- Four translucent event recommendations sit beside Earth. Suggestions come from the selected month's eligible records, respect category/media filters, prioritize reviewed records and media, and diversify countries. With an event selected, suggestions exclude its country. Missing records are not filled with invented events.
- All event navigation uses stable identities and commits the selection before the camera flight. Interrupting movement no longer discards a click. Keyboard focus moves to the selected heading.
- Selected projections are 65% larger; other projections remain at 78% opacity. Earth occlusion remains intact, and the destination camera preserves a wider surrounding view.
- Juba and Khartoum events no longer share a generic Sudan-centre coordinate. The original identifiers and location lineage remain intact. New locations are explicitly approximate city markers, not exact venues. See `site/data/monthly-location-corrections.json` for evidence and limitations. This does not validate the remaining imported catalog.
- JSON requests revalidate on load so reviewed corrections appear after refreshing.

## Verification

- Node app suite: 128 tests passed, including recommendation eligibility/click handling, interrupted selection, clip disposal, location overrides, and monthly invariants.
- Python suite: 9 tests passed.
- Blog attribution/media/navigation suites: 25 tests passed.
- Browser: activated all four initial recommendations; switched from Discovery footage to Christchurch, Germany and Libya without changing February; selected the two reported Sudan-related events and observed distinct camera destinations at Juba (4.85 N, 31.60 E) and Khartoum (15.60 N, 32.53 E).
- Desktop and 390 × 844 layouts inspected. Mobile recommendations scroll within their panel. Viewport override reset after testing.
- Blog project detail and listing credits inspected; preview still uses the existing demo and public destination links.

## Previews

- App: http://127.0.0.1:8918/?review=monthly-recommendations-v1#month=2011-02
- Blog project: http://127.0.0.1:8917/index.html?review=project-credits-v1#projects/geotemporal-transurfing

Coverage remains incomplete. High-income countries/economies retain a 12-event monthly minimum and other countries/economies a 3-event minimum; these are targets, not a claim that the data already meets them.
