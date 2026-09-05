# Reviewed event recordings

Audited September 5, 2026. Three existing recordings have exact event associations in `site/data/event-media.json`: one radio recording, one ceremony video with sound, and one silent news clip. One local derivative was created to avoid an Opus decoding warning. No remote media was downloaded.

| Recording | Recording date | Event identity | Source and rights |
|---|---|---|---|
| Sputnik radio transmission, 4.37 seconds | 1957-10-04 | `Sputnik_1\|1957\|45.97\|63.31` | [Commons file and NASA archive link](https://commons.wikimedia.org/wiki/File:Sputnik_beep.ogg); public domain in the United States according to the source |
| Third Academy Awards ceremony, opening 30 seconds; sound | 1930-11-05 | `3rd_Academy_Awards\|1930-11-05\|34.06\|-118.3` | [Commons archive film](https://commons.wikimedia.org/wiki/File:3rd_Academy_Awards.webm), [Academy date and venue](https://www.oscars.org/oscars/ceremonies/1931); public domain in the United States according to Commons |
| Egyptian protest footage, opening 30 seconds; silent | 2011-01-28 | `Egyptian_revolution_of_2011\|2011-01-25\|30.04\|31.24` | [Al Jazeera source caption and credit](https://commons.wikimedia.org/wiki/File:Al_Jazeera_-Footage_Of_Egyptian_protests_2_-_01292011.ogv); [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |

The Egyptian footage caption dates the recorded events January 28; January 29 is retained separately as the source file date. Its exact camera location is not supplied, and the event marker must not be presented as a camera coordinate. The inspected local excerpt shows bridge and street scenes with vehicles and people at a distance. It has no sound track and is excluded from the neutral promotional route.

The Sputnik recording is a radio signal from orbit, archived by NASA. Its launch-site marker does not represent the recording station. NASA is the archive attribution; this does not assert that NASA operated in 1957. The Academy's official page confirms November 5, 1930 and the Ambassador Hotel venue, despite the page URL and heading using 1931.

The Academy WebM decoded all 30 seconds of audio but produced an Opus parsing warning. The reviewed MP4 preserves the excerpt at 320 x 240 and 15 frames per second, with H.264 video and AAC audio; the derivative decodes without warnings. No synthetic images or sound were added. Both local videos were checked at 0, 5, 10, 20, and 29 seconds; the Academy frames show a presenter on stage. Complete local files were decoded, and audio-track presence and duration were checked with FFmpeg and ffprobe.

## Runtime contract

Load the flat `event-media.json` map into `MEDIA`. Use the exact preserved `event.mediaKey` or an explicitly indexed stable ID. Missing associations must not fall back to an article slug. For globe video or proximity audio, require `autoplayApproved`, `mediaRole === 'contemporaneous'`, and `mediaDate <= current clock date`. Gate proximity audio on `hasAudio`. Event visibility remains governed by moment or period mode. These are archival recordings, not claims of a live view or sound at the globe camera position.

The panel should show recording date, location, author, license link, source link, and changes. Period mode can retain recordings of past events while its visible time-window label explains that retention. A selected panel may display the archival recording date even when the event start precedes the recording day.

## Excluded from automatic playback

The legacy slug-only map has 367 associations, including pronunciation files, retrospectives, and wrong-topic search matches. Disabling every old key initially removed live video and proximity audio as well as the invalid matches. This reviewed map restores three verified associations without restoring unrelated matches. The remaining 364 legacy keys are not approved for autoplay.

- The Arab Spring audio is a pronunciation, not an event recording.
- Fukushima commentary is from years later, not the disaster's live sound.
- A cached Apollo 10 video depicts a music performance, and a Dolly-the-sheep match depicts Dolly Parton.
- The Salt March clip contains later narration. It could be offered as clearly dated contextual media after a separate review, but not as contemporaneous event sound.
- NASA's Katrina video is a 2007 retrospective, not an August 2005 recording. It remains excluded from automatic event playback.

`node scripts/validate-event-media.js /path/to/repository` checks exact identities against the regenerated catalog, local assets, track types, duration, clean decoding, recording/file date separation, and rejection of the 2015 anniversary's shared article.


## Stockholm royal wedding, June 19, 2010

Archival footage: robindanehav, "SwedishRoyalWeddingBrideAndGroomLeavesOnABoat full", June 19, 2010. [Source](https://commons.wikimedia.org/wiki/File:SwedishRoyalWeddingBrideAndGroomLeavesOnABoat_full.ogv), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Excerpt 78–96 seconds; resized and transcoded. Poster extracted from source second 90. The excerpt and extracted frame retain CC BY-SA 3.0.

Recorded from the Stockholm waterfront; camera coordinates 59.328208, 18.090383. The globe identifies the wedding event at 59.33, 18.07.


The three new wedding, Discovery launch, and eclipse clips have a separate [source ledger](moving-media-sources.md), including author, location, date, excerpt, and license details.
