"""
Atlas of When — enrich events_wikidata.json with a real first paragraph from English Wikipedia.

Run:   python3 fetch_summaries.py events_wikidata.json
Needs: Python 3.9+, `pip install requests`

Wikidata descriptions are one-liners ("battle of the Napoleonic Wars"). This replaces the
description field (row index 8) with the article's lead paragraph from the Wikipedia REST
summary endpoint, caching each response on disk. About 10 requests per second; 10,000 events
take roughly 20 minutes. Safe to interrupt and re-run — cached rows are skipped.

Endpoint (verify): https://en.wikipedia.org/api/rest_v1/page/summary/{title}
"""

import json
import os
import sys
import time
import urllib.parse

import requests

USER_AGENT = "AtlasOfWhen/0.1 (personal history-map prototype; contact: amishregmi.brt@gmail.com)"
CACHE_DIR = "wiki_cache"
PAUSE_SECONDS = 0.1
MAX_WORDS = 80


def fetch_summary(slug):
    if not os.path.isdir(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    safe_name = urllib.parse.quote(slug, safe="")
    cache_path = os.path.join(CACHE_DIR, safe_name + ".json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as cache_file:
            return json.load(cache_file)
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(slug, safe="")
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    if response.status_code != 200:
        payload = {"extract": None, "thumbnail": None, "status": response.status_code}
    else:
        body = response.json()
        thumbnail = None
        if "thumbnail" in body and body["thumbnail"] is not None:
            thumbnail = body["thumbnail"].get("source")
        payload = {"extract": body.get("extract"), "thumbnail": thumbnail, "status": 200}
    with open(cache_path, "w", encoding="utf-8") as cache_file:
        json.dump(payload, cache_file)
    time.sleep(PAUSE_SECONDS)
    return payload


def trim_words(text, max_words):
    words = text.split(" ")
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]).rstrip(",;:") + "…"


def main():
    if len(sys.argv) < 2:
        print("usage: python3 fetch_summaries.py events_wikidata.json", file=sys.stderr)
        sys.exit(1)
    path = sys.argv[1]
    with open(path, "r", encoding="utf-8") as input_file:
        rows = json.load(input_file)

    enriched = 0
    for index in range(len(rows)):
        row = rows[index]
        slug = row[9]
        if slug is None or slug.startswith("Q"):
            continue
        summary = fetch_summary(slug)
        if summary["extract"]:
            row[8] = trim_words(summary["extract"], MAX_WORDS)
            enriched += 1
        # index 13 holds the thumbnail URL for the image pipeline (indexes 10-12 are confidence, sitelinks, source)
        while len(row) < 13:
            row.append(None)
        if len(row) == 13:
            row.append(summary["thumbnail"])
        else:
            row[13] = summary["thumbnail"]
        if index % 200 == 0:
            print(str(index) + "/" + str(len(rows)) + " enriched " + str(enriched), file=sys.stderr)
            with open(path, "w", encoding="utf-8") as output_file:
                json.dump(rows, output_file, ensure_ascii=False)

    with open(path, "w", encoding="utf-8") as output_file:
        json.dump(rows, output_file, ensure_ascii=False)
    print("done: " + str(enriched) + " of " + str(len(rows)) + " rows enriched", file=sys.stderr)


if __name__ == "__main__":
    main()
