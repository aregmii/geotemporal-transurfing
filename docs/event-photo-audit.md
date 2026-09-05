# Event photograph audit

The production manifest contains 61 exact event associations: 23 new and 38 retained from the earlier demo. Every included image already exists in `site/img`. The new set was visually inspected as a contact sheet. The retained set had already been visually inspected for the earlier demo; its source dates, relationship, and credit were rechecked for this batch. No photos were downloaded or synthesized.

The target of about 30 new associations was not filled with uncertain images. The remaining candidate rows require better metadata, replacement photographs, or corrected chronology. This is a curated subset, not an audit of the full image archive or all event facts.

## Integration

Load `data/event-photos.json`, construct `GTEventPhotos.createIndex(manifest)`, and call `GTEventPhotos.photosFor(event, index)`. Matching uses the original source slug, ISO date (or year), latitude and longitude. Preserve `event.mediaKey` when a date or location is corrected. The helper also reads `row[14].mediaKey` on catalog arrays and `event.metadata.mediaKey` on metadata-bearing objects. A numeric display date is never substituted for a preserved source key. Do not fall back from a missing event association to `images[slug]` for verified photo cards.

Show the photo date, role, photographed location, credit, and notes with the event. An archival photograph does not assert that the pictured moment is happening at the current clock time. The source event date in this manifest is an identity field, not a replacement for the event chronology layer. Different events linked to the same article must remain separate.

Eclipse markers are source reference points on the eclipse path. A real photograph taken elsewhere under the same eclipse is valid event media, but its camera location must not be implied to equal the marker. Broad tournaments similarly have multiple venues. Group-stage photographs are labeled as individual matches within their group, not as finals.

## Exclusions and corrections

- 2012 opening ceremony: the cached image is a final rehearsal. The page says July 27 while EXIF says July 25. It is excluded from the verified event-photo set; a correctly labeled rehearsal could be added as context later.
- 2010 World Cup final: the cached image depicts Uruguay–Ghana, a different match. Excluded.
- 1954 World Cup final: the candidate is an undated historical team photograph reproduced in a modern collectible, with a 2018 file date. Excluded.
- 1966 World Cup final: Commons has an internally inconsistent United States public-domain tag claiming a pre-1931 publication for the 1966 image. Excluded pending a replacement or corrected rights provenance.
- 1958 World Cup final: source provides Sweden public-domain status but explicitly requests a United States status tag. Excluded from this release batch.
- 1974 World Cup final: file date is July 16 but the match was July 7. Excluded until the archive-date relationship is resolved.
- 1980 Winter Olympics: existing event dates exclude the photographed February 13 opening. Needs the event chronology correction before association.
- 1980 Olympic water polo: source photo is dated July 20 at the Lenin Central Stadium pool, while the existing row uses July 29 at another pool. Needs a validated competition interval and location treatment.
- 2017 eclipse: date field says August 20 while description identifies the August 21 eclipse; it is also an exposure composite with a documented prior orientation error. Excluded from this batch rather than treating it as a single unambiguous frame.
- 2021 eclipse: event and date are clear, but camera location is not; the photographer's profile location is not evidence of where the image was taken. Excluded.
- Spaceflight candidates: many launch rows use NASA headquarters, not a launch site, and several cached files show models or later mission phases. They need corrected events and launch photographs before approval.
- Cache access failed for the 1928 Winter Olympics, 1952 Olympic water polo, 1962 Eurovision, 2014 Asian Games, 2022 bobsleigh, 2022 Tour de Suisse, 2022 Group F, and 2022 Saratov eclipse candidate pages. They are not counted as verified new associations.
- From the earlier 55-image demo, Minsk, 2012 Paralympics, Expo 2010, the 2006 eclipse, Operation Anaconda, Hurricane Ivan, Java earthquake, L'Aquila and Yushu were not retained because the primary pages could not be fully rechecked during this pass.
- Spanish protests, Rose Revolution, Bam, Sumatra 2009, Boston, and Gezi had ambiguous or conflicting creation-date metadata; omitted in this batch. The Sichuan photo includes an additional permission condition for identifiable subjects. Treaty of Lisbon's GFDL-specific reuse documentation was not prepared; omitted.
- 2018 World Cup final credit corrected from uploader Morogris to photographer MX.
- 2015 eclipse credit corrected to original photographer Damien Deltenre. The downstream Penn State CC BY 2.0 label conflicts with the original CC BY-SA 3.0 license, so the manifest follows the original photograph and includes its source link.
- Air China Flight 129 credit now uses the Commons Korea Open Government License Type I label rather than the older public-domain label.
- Kashmir relief photograph credited to Tech. Sgt. Mike Buytas / U.S. Air Force, as identified by the source caption.

The regenerated curated Arab Spring and Iraq War rows retain their original year-based source identities (`Arab_Spring|2010|35.04|9.49` and `Iraq_War|2003|33.32|44.37`). Their two context-only photograph associations use those preserved keys; the photograph dates and roles are unchanged.

## Validation

`node scripts/validate-event-photos.js /path/to/repository` checks every exact association against the current base and year-shard event files, checks every JPEG exists, and tests that a shared article cannot attach a photograph to a different date or location. A preserved media key still matches after a runtime chronology correction in array, object, and metadata-object forms. Negative identity fixtures remove inherited metadata before changing a date or place. It also checks the New START signing/entry-into-force distinction and the corrected 2015 eclipse credit.

All 61 photo associations pass against the regenerated 76,359-row catalog.

The website integration and visual behavior remain the responsibility of the integrating task. The audit does not remove unreviewed source images from disk.
