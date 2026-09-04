"""
Geotemporal Transurfing — the few structured facts that turn an article name into a headline, from Wikidata.

Run:   python3 fetch_facts.py ../site/data/events.json --out facts.json
Needs: pip install requests

For every event we show (by its English article), in batches: winner (P1346), successful candidate (P991),
number of deaths (P1120), earthquake magnitude (P2528), start (P580) and end (P582) dates at day precision.
merge.js reads facts.json to write headlines ("Argentina wins 2022 FIFA World Cup Final") and to give
long-running events their real span (a war shows for every month it ran, not only its start year).

Property ids (unverified against wikidata.org in this session): P1346 winner, P991 successful candidate,
P1120 number of deaths, P2528 magnitude, P580 start time, P582 end time.
"""

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.parse

import requests

USER_AGENT = "GeotemporalTransurfing/0.1 (personal history-map prototype; contact: amishregmi.brt@gmail.com)"
WDQS = "https://query.wikidata.org/sparql"
CACHE_DIR = "facts_cache_v2"   # v2: end dates at month and year precision are kept (the v1 cache stored only day-precision ends)
BATCH = 60

QUERY = """
SELECT ?article ?winnerLabel ?electedLabel ?deaths ?magnitude ?start ?startPrec ?end ?endPrec WHERE {
  VALUES ?article { %s }
  ?article schema:about ?item .
  OPTIONAL { ?item wdt:P1346 ?winner . }
  OPTIONAL { ?item wdt:P991 ?elected . }
  OPTIONAL { ?item wdt:P1120 ?deaths . }
  OPTIONAL { ?item wdt:P2528 ?magnitude . }
  OPTIONAL { ?item p:P580/psv:P580 ?sv . ?sv wikibase:timeValue ?start ; wikibase:timePrecision ?startPrec . }
  OPTIONAL { ?item p:P582/psv:P582 ?ev . ?ev wikibase:timeValue ?end ; wikibase:timePrecision ?endPrec . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""


def article_url(slug):
    return "https://en.wikipedia.org/wiki/" + urllib.parse.quote(slug.replace(" ", "_"), safe="()',!*:/@")


def query_batch(slugs):
    key = hashlib.sha1("|".join(sorted(slugs)).encode("utf-8")).hexdigest()[:16]
    path = os.path.join(CACHE_DIR, key + ".json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    sparql = QUERY % " ".join("<" + article_url(s) + ">" for s in slugs)
    out = {}
    try:
        response = requests.get(WDQS, params={"query": sparql}, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}, timeout=95)
        if response.status_code == 429:
            print("  rate limited; sleeping 60 s", file=sys.stderr)
            time.sleep(60)
            response = requests.get(WDQS, params={"query": sparql}, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}, timeout=95)
        if response.status_code == 200:
            for b in response.json()["results"]["bindings"]:
                slug = urllib.parse.unquote(b["article"]["value"].rsplit("/", 1)[-1])
                f = out.setdefault(slug, {})
                def val(k):
                    return b[k]["value"] if k in b else None
                if val("winnerLabel") and not f.get("winner") and not val("winnerLabel").startswith("Q"):
                    f["winner"] = val("winnerLabel")
                if val("electedLabel") and not f.get("elected") and not val("electedLabel").startswith("Q"):
                    f["elected"] = val("electedLabel")
                if val("deaths") and not f.get("deaths"):
                    try:
                        f["deaths"] = int(float(val("deaths")))
                    except ValueError:
                        pass
                if val("magnitude") and not f.get("magnitude"):
                    try:
                        f["magnitude"] = round(float(val("magnitude")), 1)
                    except ValueError:
                        pass
                if val("start") and val("startPrec") == "11" and not f.get("start"):
                    f["start"] = val("start").split("T")[0]
                # An end date is worth having at month or year precision too: a war that "ended in 2021" must
                # stay on the globe until 2021, not vanish the month it began. Month precision -> the 28th of
                # that month, year precision -> 31 December, so the event lasts to the end of what is known.
                if val("end") and not f.get("end"):
                    end_precision = val("endPrec")
                    end_date = val("end").split("T")[0]
                    if end_precision == "11":
                        f["end"] = end_date
                    elif end_precision == "10":
                        f["end"] = end_date[:7] + "-28"
                    elif end_precision == "9":
                        f["end"] = end_date[:4] + "-12-31"
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(out, f)
        elif len(slugs) > 8:
            print("  HTTP " + str(response.status_code) + " for a batch of " + str(len(slugs)) + " — splitting", file=sys.stderr)
            time.sleep(3)
            half = len(slugs) // 2
            a = query_batch(slugs[:half]); a.update(query_batch(slugs[half:])); return a
        else:
            print("  HTTP " + str(response.status_code) + " for a batch — skipping", file=sys.stderr)
    except requests.RequestException as error:
        print("  batch failed: " + type(error).__name__, file=sys.stderr)
    time.sleep(2.0)
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("events")
    parser.add_argument("--out", default="facts.json")
    args = parser.parse_args()
    with open(args.events, "r", encoding="utf-8") as f:
        rows = json.load(f)
    facts = {}
    if os.path.exists(args.out):
        with open(args.out, "r", encoding="utf-8") as f:
            facts = json.load(f)
    slugs = sorted(set(r[9] for r in rows if r[9] and not r[9].startswith("Q") and r[9] not in facts))
    print(str(len(slugs)) + " events to look up in " + str((len(slugs) + BATCH - 1) // BATCH) + " batches", file=sys.stderr)
    for i in range(0, len(slugs), BATCH):
        batch = slugs[i:i + BATCH]
        got = query_batch(batch)
        for s in batch:
            facts[s] = got.get(s, {})
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(facts, f, ensure_ascii=False)
    print("wrote facts for " + str(len(facts)) + " events to " + args.out, file=sys.stderr)


if __name__ == "__main__":
    main()
