#!/bin/bash
# Atlas of When — full data refresh. Run from anywhere:
#   pipeline/refresh.sh            # events + summaries + images for the last century
#   pipeline/refresh.sh --all      # images for every event, not only the last century
# Every step caches and resumes; re-running is cheap.
set -u
cd "$(dirname "$0")"
python3 -c "import requests, PIL" 2>/dev/null || pip3 install --quiet -r requirements.txt

IMAGE_FROM=1926
if [ "${1:-}" = "--all" ]; then IMAGE_FROM=-4000000; fi

echo "== 1/4 events from Wikidata"
python3 extract_events.py || echo "   (some queries failed — continuing with what came back)"

echo "== 2/4 Wikipedia lead paragraphs"
python3 fetch_summaries.py events_wikidata.json

echo "== 3/4 licensed images from Commons (from year $IMAGE_FROM)"
python3 fetch_images.py events_wikidata.json --from "$IMAGE_FROM" --img-dir ../site/img --out ../site/data/images.json

echo "== 4/4 images for curated events that have no Wikidata row"
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
echo "== done"
