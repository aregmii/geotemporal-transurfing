"""
Geotemporal Transfusion — cause-and-effect links between events, from Wikidata.

Run:   python3 fetch_links.py ../site/data/events.json --out ../site/data/links.json
Needs: pip install requests

For the events we show, asks the Wikidata Query Service (in batches of article URLs) which of them are linked to
each other by a consequence-type property, and writes [[slug_a, relation, slug_b], ...] where both ends are events
we show. The app's ticker turns these into "A — led to — B" lines instead of pairing unrelated same-year events.

Properties (ids unverified against wikidata.org in this session; a wrong id simply returns nothing):
  P1542 has effect        P828 has cause          P1536 immediate cause of     P1478 has immediate cause
  P1479 has contributing factor    P155 follows    P156 followed by    P361 part of    P527 has part
  P710 participant is NOT used (too broad)
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.parse

import requests

USER_AGENT = "GeotemporalTransfusion/0.1 (personal history-map prototype; contact: amishregmi.brt@gmail.com)"
WDQS = "https://query.wikidata.org/sparql"
CACHE_DIR = "links_cache"
RELATIONS = ["P1542", "P828", "P1536", "P1478", "P1479", "P155", "P156", "P361", "P527"]
BATCH = 150


def article_url(slug):
    return "https://en.wikipedia.org/wiki/" + urllib.parse.quote(slug.replace(" ", "_"), safe="()',!*:/@")


def query_batch(slugs):
    key = hashlib.sha1("|".join(sorted(slugs)).encode("utf-8")).hexdigest()[:16]
    path = os.path.join(CACHE_DIR, key + ".json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    values = " ".join("<" + article_url(s) + ">" for s in slugs)
    props = " ".join("wdt:" + p for p in RELATIONS)
    sparql = """
SELECT ?a ?rel ?b WHERE {
  VALUES ?artA { %s }
  VALUES ?rel { %s }
  ?artA schema:about ?itemA .
  ?itemA ?rel ?itemB .
  ?b schema:about ?itemB ; schema:isPartOf <https://en.wikipedia.org/> .
  BIND(?artA AS ?a)
}""" % (values, props)
    rows = []
    try:
        response = requests.get(WDQS, params={"query": sparql}, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}, timeout=95)
        if response.status_code == 200:
            for binding in response.json()["results"]["bindings"]:
                a = urllib.parse.unquote(binding["a"]["value"].rsplit("/", 1)[-1])
                b = urllib.parse.unquote(binding["b"]["value"].rsplit("/", 1)[-1])
                rel = binding["rel"]["value"].rsplit("/", 1)[-1]
                rows.append([a, rel, b])
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(rows, f)
        else:
            print("  HTTP " + str(response.status_code) + " for a batch — skipping", file=sys.stderr)
    except requests.RequestException as error:
        print("  batch failed: " + type(error).__name__, file=sys.stderr)
    time.sleep(1.5)
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("events")
    parser.add_argument("--out", default="../site/data/links.json")
    parser.add_argument("--min-weight", type=int, default=2, help="only look up events at or above this weight")
    args = parser.parse_args()
    with open(args.events, "r", encoding="utf-8") as f:
        rows = json.load(f)
    shown = set(r[9] for r in rows if r[9])
    slugs = sorted(set(r[9] for r in rows if r[9] and r[6] >= args.min_weight and not r[9].startswith("Q")))
    print(str(len(slugs)) + " events to look up in " + str((len(slugs) + BATCH - 1) // BATCH) + " batches", file=sys.stderr)
    links = []
    seen = set()
    for i in range(0, len(slugs), BATCH):
        for a, rel, b in query_batch(slugs[i:i + BATCH]):
            if a == b or b not in shown:
                continue
            key = a + "|" + rel + "|" + b
            if key in seen:
                continue
            seen.add(key)
            links.append([a, rel, b])
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(links, f, ensure_ascii=False)
    print("wrote " + str(len(links)) + " links to " + args.out, file=sys.stderr)


if __name__ == "__main__":
    main()
