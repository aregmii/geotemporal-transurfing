# Moving archival media for the globe

Three excerpts and three poster frames are ready for local integration. The proposal map is `event-media-additions.json`; media files are in `site/media/`. No application files, repository license, or published artifact were changed.

The sources were checked on September 5, 2026. Raw Commons metadata snapshots are retained beside this ledger. Excerpts were selected from actual downloaded footage, visually inspected with contact sheets, decoded in full, and tested for changing frames. MP4 files use H.264 video; the wedding and launch retain original sound as AAC. No synthetic history, fabricated motion, or added sound was used.

| Event | Recording date and location | Excerpt and role | Credit and rights |
|---|---|---|---|
| Victoria and Daniel's wedding | June 19, 2010; Stockholm waterfront, camera 59.328208, 18.090383 | Source 78–96 seconds; 18-second contemporaneous excerpt. The couple walks onto the royal barge and waves. | robindanehav; [Commons source](https://commons.wikimedia.org/wiki/File:SwedishRoyalWeddingBrideAndGroomLeavesOnABoat_full.ogv); [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The excerpt and poster retain that license. |
| Discovery's final launch, STS-133 | February 24, 2011; Kennedy Space Center, Pad 39A, Florida | Source 12–32 seconds; 20-second contemporaneous launch excerpt with original sound. | NASA; [Commons source](https://commons.wikimedia.org/wiki/File:STS-133_launch_video.ogv), [NASA mission date and site](https://www.nasa.gov/mission/sts-133/); public domain according to the source. |
| May 20, 2012 annular eclipse | May 20, 2012; Chico Community Observatory, California | Source 6–30 seconds; 24-second contemporaneous telescope sequence. The source already plays at approximately double speed. Motion is subtle. | Kenneth Crawford; [Commons source](https://commons.wikimedia.org/wiki/File:Ring_of_Fire_Eclipse_-_May_20,_2012.ogv), [original Vimeo recording](https://vimeo.com/42734166); [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). |

The wedding excerpt was resized from 768×576 to 640×480. Discovery retains 512×288. The eclipse was resized from 1280×720 to 640×360 and omits the introductory title overlay. Poster frames come from source seconds 90, 17, and 11 respectively. Original camera cuts and source speed are retained. The credit and source-license links must accompany redistributed excerpts; these third-party media licenses remain distinct from the project code license.

## Exact associations

- The hero belongs to `Wedding_of_Victoria%2C_Crown_Princess_of_Sweden%2C_and_Daniel_Westling|2010-06-19|59.33|18.07`. It must never replace media on the London wedding record. The existing London photograph remains separately verified.
- Discovery belongs to `STS-133|2011-02-24|28.58|-80.65`. The duplicate article-linked record at NASA headquarters in Washington is excluded. NASA confirms the actual launch at 4:53:24 p.m. EST; the catalog association currently has day precision.
- The eclipse belongs to `Solar_eclipse_of_May_20%2C_2012|2012-05-20|46.09|176.28`. The northern Pacific marker is an eclipse reference point, while the camera was in California. Keep the camera location visible in the recording notes.

## William and Catherine feasibility

No wedding video exists in the project's legacy media map. Publicly viewable [BBC procession footage](https://www.youtube.com/watch?v=EEASes55zfg) and [Royal Family streaming information](https://www.royal.uk/wedding-hrh-prince-william-wales-and-miss-catherine-middleton-update-royal-wedding-online) establish authentic footage exists, but a license for making local projection clips or GIF derivatives was not verified. Those broadcasts were not downloaded or added. Commons video searches for the 2011 wedding and Catherine Middleton did not yield a suitable licensed eyewitness recording in this bounded pass.

The Stockholm wedding is a different event with usable motion and explicit reuse terms. It is the proposed hero replacement, preserving the camera interaction style while changing the selected event and destination accurately.

## Other candidates excluded from the hero

- [2012 Olympic flypast](https://commons.wikimedia.org/wiki/File:2012_Olympic_Flypast_from_E14.ogv), Richard Symonds, July 27, 2012, CC BY-SA 3.0: authentic and date-matched to the London opening ceremony, but inspected frames are mostly trees and buildings with distant aircraft. This does not meet the requested visual quality, so it was not added.
- [San Francisco eclipse recording](https://commons.wikimedia.org/wiki/File:Solar_Eclipse_from_San_Francisco,_2012.webm): file metadata gives May 27 rather than the May 20 eclipse date. The Chico recording has an explicit matching capture date and was preferred.
- [2010 Lake Nakuru eclipse](https://commons.wikimedia.org/wiki/File:Annular_Solar_Eclipse_2010_Lake_Nakuru,_Kenya.webm): source date is a 2016 publication, and Commons marks the external-license review incomplete. Not added.

`node work/moving-media-review/validate.js work/geotemporal-implementation` writes `validation.json` with exact catalog matches, codec/duration checks, clean full decoding, poster existence, and sampled frame differences. Frame differences confirm changing images; semantic motion was checked visually in the contact sheets. Browser playback and the final GIF composition remain integration checks.
