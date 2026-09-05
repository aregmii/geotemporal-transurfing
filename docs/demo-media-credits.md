# Walkthrough and media credits

The 56-second walkthrough was recorded from the local release candidate at 1280 × 720, 30 fps. The README loops are 12.5, 13.5, and 20 seconds, exported at 800 × 450, 20 fps. The footage uses the production event records and verified media maps, with a deterministic clock and camera route for recording.

The current 12.5-second opening was rerecorded with a denser selection of actual catalog events and a visit to the June 19, 2010 Swedish royal wedding in Stockholm. Its projected video and event-panel video are excerpted from robindanehav’s archival recording. The original 56-second walkthrough still contains the earlier London opening. The second sequence follows the August 15, 2007 Peru event to the Saffron Revolution through the actual Meanwhile button. The Peru photograph was taken August 21; the Myanmar photograph was taken September 24, during the later protests. These are archival illustrations with dates in their panels. The final sequence demonstrates Moment view, adjustable forward/reverse playback, XYZ movement, looking away, and Return to Earth.

Period views label their date range. Their visible cards and recordings do not claim that all events happened simultaneously. Archival video is replayed in loops, rather than presented as a live broadcast. Photographs are resized, cropped to card frames, and animated within the interface. No synthetic historical imagery is used.

Full photo source, date, location, author, license, and transformation notes are in [event-photo-sources.md](event-photo-sources.md). Recording sources and transformations are in [event-media-sources.md](event-media-sources.md). These ledgers include the complete reviewed library; some entries do not appear in this walkthrough. Each source retains its listed license.

Earth texture: NASA Blue Marble. Borders: Natural Earth. Star catalog: d3-celestial, BSD, pinned source and license in `site/assets/stars-catalog-source.json` and `stars-catalog-LICENSE.txt`. Text summaries retain their source terms. Interface and walkthrough arrangement: Amish Regmi.


The Swedish wedding footage and its extracted poster retain [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/): robindanehav, [SwedishRoyalWeddingBrideAndGroomLeavesOnABoat full](https://commons.wikimedia.org/wiki/File:SwedishRoyalWeddingBrideAndGroomLeavesOnABoat_full.ogv), June 19, 2010, source seconds 78–96. The excerpt was resized, transcoded, and cropped by the interface; the motion is authentic. See [moving-media-sources.md](moving-media-sources.md) for all three new clips.

The movie recorder advances the app camera and clock at 30 fps and seeks decoded archival frames to the corresponding movie timestamp. This keeps their motion at the source playback speed regardless of how long encoding takes. Native collapsed source notes remain collapsed in the exported frames.

## Reverse-time walkthrough

The 17-second reverse-time demonstration was recorded from the local application at 1280 × 720 and 30 fps, then exported as an 800 × 450 GIF at 20 fps. It uses NASA’s February 24, 2011 [STS-133 launch recording](https://commons.wikimedia.org/wiki/File:STS-133_launch_video.ogv), with the original excerpt and source details in [moving-media-sources.md](moving-media-sources.md). NASA footage is listed as public domain on the source page. The application crops the footage into the event panel and projected card, freezes it, plays decoded frames backward, and changes playback speed. Reversal is an interface demonstration, not a claim about the historical sequence. No synthetic frames are added. The export is silent.

The recorder operates the application’s play, pause, reverse, and speed controls. A deterministic clock advances the application; recording waits for the application’s requested video frames to decode without changing their positions. Clip playback holds the known recording date. Crossing the start of the available excerpt returns to calendar rewind; clip seconds are not mapped to invented historical timestamps. The approved Stockholm opening remains unchanged.
