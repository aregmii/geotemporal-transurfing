#!/bin/bash
# Geotemporal Transfusing — full data refresh. Run from anywhere:
#   pipeline/refresh.sh            # events + summaries + images for the last century
#   pipeline/refresh.sh --all      # images for every event, not only the last century
# Every step caches and resumes; re-running is cheap.
set -u
cd "$(dirname "$0")"
python3 -c "import requests, PIL" 2>/dev/null || pip3 install --quiet -r requirements.txt

IMAGE_FROM=1926
if [ "${1:-}" = "--all" ]; then IMAGE_FROM=-4000000; fi

echo "== 1/5 events from Wikidata"
python3 extract_events.py || echo "   (some queries failed — continuing with what came back)"

echo "== 2/5 Wikipedia lead paragraphs"
python3 fetch_summaries.py events_wikidata.json

echo "== 3/5 licensed images from Commons (from year $IMAGE_FROM)"
python3 fetch_images.py events_wikidata.json --from "$IMAGE_FROM" --img-dir ../site/img --out ../site/data/images.json

echo "== 4/5 images for curated events that have no Wikidata row"
node -e '
const fs=require("fs");const path=require("path");
const rows=fs.readdirSync("curated").filter(f=>f.endsWith(".json")).flatMap(f=>JSON.parse(fs.readFileSync(path.join("curated",f),"utf8")));
let have={};try{have=JSON.parse(fs.readFileSync("../site/data/images.json","utf8"))}catch(e){}
const from=Number(process.argv[1]);
const slugs=[...new Set(rows.filter(r=>r[4]>=from&&r[9]&&!have[r[9]]).map(r=>r[9]))];
fs.writeFileSync("missing_slugs.json",JSON.stringify(slugs));console.log("   "+slugs.length+" curated events to look up");
' "$IMAGE_FROM"
python3 fetch_images.py events_wikidata.json --from "$IMAGE_FROM" --img-dir ../site/img --out ../site/data/images.json --slugs missing_slugs.json

echo "== build site/data/events.json"
node build.js

echo "== 4b. facts for headlines and exact spans (winner, deaths, magnitude, start/end)"
python3 fetch_facts.py ../site/data/events.json --out facts.json || echo "   (facts step failed — headlines fall back to the lead sentence)"
echo "== 4c. written headlines (only with ANTHROPIC_API_KEY in the environment or pipeline/.env)"
python3 headlines_llm.py ../site/data/events.json --out headlines.json || echo "   (headline step failed — rules only)"
node build.js

echo "== 5/6 audio and video clips for the biggest events (from year $IMAGE_FROM; needs ffmpeg for small files)"
python3 fetch_media.py ../site/data/events.json --from "$IMAGE_FROM" --min-weight 3 --media-dir ../site/media --out ../site/data/media.json || echo "   (media step failed — the site works without clips)"
echo "== 6/6 cause-and-effect links between events"
python3 fetch_links.py ../site/data/events.json --out ../site/data/links.json || echo "   (links step failed — the ticker falls back to same-day pairs)"
echo "== done"
