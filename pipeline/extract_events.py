"""
Atlas of When — Wikidata extraction script (v0.4). Adds political, attack and sport classes and a country-level location fallback.

Run:   python3 extract_events.py --out events_wikidata.json
Needs: Python 3.9+, `pip install requests`

What it does
  1. For each event class in EVENT_CLASSES, asks the Wikidata Query Service for every item of
     that class that has a date and either its own coordinate or a located place, ranked by
     how many language Wikipedias link to it (sitelinks).
  2. Separately asks for well-known people (sitelinks >= PERSON_MIN_SITELINKS) with a birth
     place and/or death place, and turns each into a place-anchored "born at" / "died at" event.
  3. Merges, dedupes, keeps the top MAX_EVENTS by sitelinks, and writes a JSON array in the
     exact row shape the prototype consumes:
       [title, lat, lon, start_year, end_year, category, weight, place, description, wikipedia_slug]

Honesty notes
  - The property and class identifiers below were written from memory in a session that could
    not reach wikidata.org. Confirm each at https://www.wikidata.org/wiki/Property:P625 etc.
    before trusting the output. If a query returns zero rows, an identifier is probably wrong.
  - The endpoint enforces a 60 s per-query timeout and roughly 60 s of query time per minute
    per client. This script runs queries one at a time with a pause, and caches every raw
    response on disk so a re-run does not re-query.
  - Dates before year 1 come back as negative years; deep prehistory is not well covered.
"""

import argparse
import json
import os
import sys
import time

import requests

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "AtlasOfWhen/0.1 (personal history-map prototype; contact: amishregmi.brt@gmail.com)"
CACHE_DIR = "wdqs_cache"
PAUSE_SECONDS = 2.0
MAX_EVENTS = 10000
PERSON_MIN_SITELINKS = 150
EVENT_MIN_SITELINKS = 25

# Wikidata class QID -> prototype category. Verify each QID before relying on it.
EVENT_CLASSES = {
    # conflict
    "Q198":      "con",   # war
    "Q178561":   "con",   # battle
    "Q188055":   "con",   # siege
    "Q131569":   "con",   # treaty
    "Q10931":    "con",   # revolution
    "Q124734":   "con",   # rebellion
    "Q3199915":  "con",   # massacre
    "Q45382":    "con",   # coup d'état
    "Q175331":   "con",   # demonstration / protest
    # disasters
    "Q7944":     "dis",   # earthquake
    "Q7692360":  "dis",   # volcanic eruption
    "Q12184":    "dis",   # pandemic
    "Q3241045":  "dis",   # epidemic
    "Q168247":   "dis",   # famine
    "Q8068":     "dis",   # flood
    "Q8070":     "dis",   # tsunami
    "Q169950":   "dis",   # wildfire
    "Q8092":     "dis",   # tropical cyclone
    "Q3839081":  "dis",   # disaster (generic)
    "Q1190554":  "cul",   # occurrence (generic; broad — keep the sitelink floor high for this one)
    # science and discovery
    "Q2401485":  "sci",   # expedition
    "Q5916":     "sci",   # spaceflight
    "Q1371849":  "sci",   # scientific experiment
    "Q12772819": "sci",   # discovery
    # culture and belief
    "Q1338037":  "cul",   # ecumenical council
    "Q209715":   "cul",   # coronation
    "Q172754":   "cul",   # world's fair
    "Q5389":     "cul",   # Olympic Games
    "Q1084566":  "cul",   # premiere
    "Q2761147":  "cul",   # summit meeting
    "Q1656682":  "cul",   # event (generic)
    # v0.4 — the kinds of thing Amish named: political turning points, attacks, sport. QIDs UNVERIFIED; a wrong one returns 0 rows.
    "Q3882219":  "con",   # assassination
    "Q2223653":  "con",   # terrorist attack
    "Q1071027":  "con",   # assassination attempt (verify)
    "Q40231":    "cul",   # election — located via the country it applies to (P1001 / P17)
    "Q19317":    "cul",   # FIFA World Cup (each tournament is an instance)
    "Q159821":   "cul",   # Summer Olympic Games
    "Q82414":    "cul",   # Winter Olympic Games
    "Q260858":   "cul",   # UEFA European Championship
    "Q42586":    "cul",   # Cricket World Cup
    "Q32096":    "cul",   # Super Bowl
    "Q744913":   "dis",   # aviation accident
}

# Lower popularity floor for the classes added in v0.4 — recent events have fewer language editions than old wars.
MIN_SITELINKS_OVERRIDE = {"Q3882219": 15, "Q2223653": 15, "Q1071027": 10, "Q40231": 40, "Q19317": 10, "Q159821": 10, "Q82414": 10, "Q260858": 10, "Q42586": 10, "Q32096": 10, "Q744913": 20}

# Classes whose instances mostly sit under subclasses (e.g. "Summer Olympic Games" under "Olympic Games").
# For these the query walks the subclass tree. Only do this for small trees; "occurrence" would time out.
SUBCLASS_WALK = {"Q2401485", "Q5389", "Q7692360", "Q8092", "Q1338037", "Q209715", "Q5916", "Q12772819", "Q1371849", "Q1084566", "Q2761147"}

EVENT_QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?when ?start ?end ?coord ?placeLabel ?placeCoord ?article ?sitelinks WHERE {
  ?item %(class_path)s wd:%(class_qid)s .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= %(min_sitelinks)d)
  OPTIONAL { ?item wdt:P585 ?when . }
  OPTIONAL { ?item wdt:P580 ?start . }
  OPTIONAL { ?item wdt:P582 ?end . }
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P276 ?place . ?place wdt:P625 ?placeCoord . }
  OPTIONAL { ?item wdt:P1001 ?jurisdiction . ?jurisdiction wdt:P625 ?countryCoord . }
  OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P625 ?countryCoord2 . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
"""

DISCOVERY_QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?when ?coord ?placeLabel ?placeCoord ?article ?sitelinks WHERE {
  ?item wdt:P575 ?when . hint:Prior hint:rangeSafe true .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= %(min_sitelinks)d)
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P276 ?place . ?place wdt:P625 ?placeCoord . }
  OPTIONAL { ?item wdt:P189 ?site . ?site wdt:P625 ?placeCoord . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
"""

PERSON_QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?born ?died ?birthPlaceLabel ?birthCoord ?deathPlaceLabel ?deathCoord ?article ?sitelinks WHERE {
  ?item wdt:P569 ?born . hint:Prior hint:rangeSafe true .
  FILTER(?born >= "%(date_from)s"^^xsd:dateTime && ?born < "%(date_to)s"^^xsd:dateTime)
  ?item wdt:P31 wd:Q5 .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= %(min_sitelinks)d)
  OPTIONAL { ?item wdt:P19 ?birthPlace . ?birthPlace wdt:P625 ?birthCoord . }
  OPTIONAL { ?item wdt:P570 ?died . }
  OPTIONAL { ?item wdt:P20 ?deathPlace . ?deathPlace wdt:P625 ?deathCoord . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
"""

# Birth-year slices for the person query, so no single query runs long.
# Slices that returned in v0.2 are kept as-is so their cache files are reused;
# the four that timed out (1860-90, 1940-55, 1955-70, 1990-2010) are split into 5-year slices.
PERSON_YEAR_SLICES = [
    (-3000, 0), (0, 1000), (1000, 1400), (1400, 1600), (1600, 1750), (1750, 1820),
    (1820, 1860),
    (1860, 1865), (1865, 1870), (1870, 1875), (1875, 1880), (1880, 1885), (1885, 1890),
    (1890, 1910), (1910, 1925), (1925, 1940),
    (1940, 1945), (1945, 1950), (1950, 1955),
    (1955, 1960), (1960, 1965), (1965, 1970),
    (1970, 1990),
    (1990, 1995), (1995, 2000), (2000, 2005), (2005, 2010),
]


def iso_date(year):
    # Wikidata uses astronomical years: year 0 exists. Format with sign and 4+ digits.
    if year < 0:
        return "-" + str(-year).zfill(4) + "-01-01T00:00:00Z"
    return str(year).zfill(4) + "-01-01T00:00:00Z"


def run_query(cache_key, sparql):
    if not os.path.isdir(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    cache_path = os.path.join(CACHE_DIR, cache_key + ".json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as cache_file:
            return json.load(cache_file)

    headers = {"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}
    try:
        response = requests.get(ENDPOINT, params={"query": sparql}, headers=headers, timeout=95)
        if response.status_code == 429:
            print("  rate limited; sleeping 60 s", file=sys.stderr)
            time.sleep(60)
            response = requests.get(ENDPOINT, params={"query": sparql}, headers=headers, timeout=95)
        if response.status_code != 200:
            print("  FAILED " + cache_key + " with HTTP " + str(response.status_code) + " — skipping (likely a 60 s timeout)", file=sys.stderr)
            time.sleep(PAUSE_SECONDS)
            return {"results": {"bindings": []}}
        payload = response.json()
    except requests.RequestException as error:
        print("  FAILED " + cache_key + ": " + str(error) + " — skipping", file=sys.stderr)
        return {"results": {"bindings": []}}
    with open(cache_path, "w", encoding="utf-8") as cache_file:
        json.dump(payload, cache_file)
    time.sleep(PAUSE_SECONDS)
    return payload


def value_of(binding, key):
    if key in binding:
        return binding[key]["value"]
    return None


def year_of(iso_date_string):
    # Wikidata dates look like "1945-08-06T00:00:00Z" or "-0563-01-01T00:00:00Z".
    if iso_date_string is None:
        return None
    text = iso_date_string
    negative = text.startswith("-")
    if negative:
        text = text[1:]
    year_text = text.split("-")[0]
    try:
        year = int(year_text)
    except ValueError:
        return None
    if negative:
        year = -year - 1   # Wikidata's year -479 is 480 BCE; curated rows write 480 BCE as -480
    return year


def parse_point(wkt_point):
    # "Point(31.1342 29.9792)" -> (lat, lon)
    if wkt_point is None:
        return None
    inner = wkt_point[wkt_point.find("(") + 1 : wkt_point.find(")")]
    parts = inner.split(" ")
    if len(parts) != 2:
        return None
    lon = float(parts[0])
    lat = float(parts[1])
    return (lat, lon)


def slug_of(article_url):
    if article_url is None:
        return None
    return article_url.rsplit("/", 1)[-1]


def weight_of(sitelinks):
    # Observed: Battle of Stalingrad 108, Waterloo 93, Thermopylae 83. Top tier starts around 120.
    if sitelinks >= 120:
        return 4
    if sitelinks >= 70:
        return 3
    if sitelinks >= 40:
        return 2
    return 1


def collect_events():
    rows = []
    for class_qid in EVENT_CLASSES:
        category = EVENT_CLASSES[class_qid]
        min_sitelinks = EVENT_MIN_SITELINKS
        if class_qid in ("Q1190554", "Q1656682"):
            min_sitelinks = 80
        if class_qid in MIN_SITELINKS_OVERRIDE:
            min_sitelinks = MIN_SITELINKS_OVERRIDE[class_qid]
        print("events: class " + class_qid + " (" + category + ")", file=sys.stderr)
        class_path = "wdt:P31"
        cache_key = "events_" + class_qid
        if class_qid in SUBCLASS_WALK:
            class_path = "wdt:P31/wdt:P279*"
            cache_key = "events_sub_" + class_qid
        sparql = EVENT_QUERY % {"class_qid": class_qid, "class_path": class_path, "min_sitelinks": min_sitelinks}
        payload = run_query(cache_key, sparql)
        for binding in payload["results"]["bindings"]:
            when_year = year_of(value_of(binding, "when"))
            start_year = year_of(value_of(binding, "start"))
            end_year = year_of(value_of(binding, "end"))
            if when_year is not None:
                start_year = when_year
                end_year = when_year
            if start_year is None:
                continue
            if end_year is None:
                end_year = start_year
            point = parse_point(value_of(binding, "coord"))
            place_label = value_of(binding, "placeLabel")
            confidence = "exact"
            if point is None:
                point = parse_point(value_of(binding, "placeCoord"))
                confidence = "place"
            if point is None:
                point = parse_point(value_of(binding, "countryCoord")) or parse_point(value_of(binding, "countryCoord2"))
                confidence = "country"
            if point is None:
                continue
            title = value_of(binding, "itemLabel")
            description = value_of(binding, "itemDescription") or ""
            sitelinks = int(value_of(binding, "sitelinks"))
            rows.append({
                "qid": value_of(binding, "item").rsplit("/", 1)[-1],
                "title": title, "lat": point[0], "lon": point[1],
                "start": start_year, "end": end_year, "category": category,
                "sitelinks": sitelinks, "place": place_label or "",
                "description": description, "slug": slug_of(value_of(binding, "article")),
                "confidence": confidence,
            })
    return rows


def collect_discoveries():
    # Anything with a "time of discovery or invention" and a place: elements, fossils, sites, comets.
    rows = []
    print("discoveries: property P575", file=sys.stderr)
    sparql = DISCOVERY_QUERY % {"min_sitelinks": 40}
    payload = run_query("discoveries_P575", sparql)
    for binding in payload["results"]["bindings"]:
        when_year = year_of(value_of(binding, "when"))
        if when_year is None:
            continue
        point = parse_point(value_of(binding, "coord"))
        confidence = "exact"
        if point is None:
            point = parse_point(value_of(binding, "placeCoord"))
            confidence = "place"
        if point is None:
            continue
        rows.append({
            "qid": value_of(binding, "item").rsplit("/", 1)[-1],
            "title": value_of(binding, "itemLabel"), "lat": point[0], "lon": point[1],
            "start": when_year, "end": when_year, "category": "sci",
            "sitelinks": int(value_of(binding, "sitelinks")), "place": value_of(binding, "placeLabel") or "",
            "description": value_of(binding, "itemDescription") or "", "slug": slug_of(value_of(binding, "article")),
            "confidence": confidence, "source": "discovery",
        })
    return rows


def collect_people():
    rows = []
    for year_slice in PERSON_YEAR_SLICES:
        print("people: born " + str(year_slice[0]) + " to " + str(year_slice[1]), file=sys.stderr)
        sparql = PERSON_QUERY % {
            "min_sitelinks": PERSON_MIN_SITELINKS,
            "date_from": iso_date(year_slice[0]), "date_to": iso_date(year_slice[1]),
        }
        payload = run_query("people_" + str(year_slice[0]) + "_" + str(year_slice[1]), sparql)
        for binding in payload["results"]["bindings"]:
            name = value_of(binding, "itemLabel")
            description = value_of(binding, "itemDescription") or ""
            sitelinks = int(value_of(binding, "sitelinks"))
            qid = value_of(binding, "item").rsplit("/", 1)[-1]
            slug = slug_of(value_of(binding, "article"))
            born_year = year_of(value_of(binding, "born"))
            birth_point = parse_point(value_of(binding, "birthCoord"))
            if born_year is not None and birth_point is not None:
                rows.append({
                    "qid": qid, "title": "Birth of " + name,
                    "lat": birth_point[0], "lon": birth_point[1],
                    "start": born_year, "end": born_year, "category": "cul",
                    "sitelinks": sitelinks, "place": value_of(binding, "birthPlaceLabel") or "",
                    "description": description, "slug": slug, "confidence": "associated", "source": "person",
                })
            died_year = year_of(value_of(binding, "died"))
            death_point = parse_point(value_of(binding, "deathCoord"))
            if died_year is not None and death_point is not None:
                rows.append({
                    "qid": qid, "title": "Death of " + name,
                    "lat": death_point[0], "lon": death_point[1],
                    "start": died_year, "end": died_year, "category": "cul",
                    "sitelinks": sitelinks, "place": value_of(binding, "deathPlaceLabel") or "",
                    "description": description, "slug": slug, "confidence": "associated", "source": "person",
                })
    return rows


def sort_key(row):
    return -row["sitelinks"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="events_wikidata.json")
    parser.add_argument("--max", type=int, default=MAX_EVENTS)
    arguments = parser.parse_args()

    all_rows = collect_events() + collect_discoveries() + collect_people()

    # Dedupe on (qid, title) — the same item can appear under several classes.
    seen = {}
    unique_rows = []
    for row in all_rows:
        key = row["qid"] + "|" + row["title"]
        if key in seen:
            continue
        seen[key] = True
        unique_rows.append(row)

    unique_rows.sort(key=sort_key)
    kept = unique_rows[: arguments.max]

    output_rows = []
    for row in kept:
        output_rows.append([
            row["title"], round(row["lat"], 2), round(row["lon"], 2),
            row["start"], row["end"], row["category"], weight_of(row["sitelinks"]),
            row["place"], row["description"], row["slug"] or row["qid"],
            row["confidence"], row["sitelinks"], row.get("source", "event"),
        ])

    with open(arguments.out, "w", encoding="utf-8") as output_file:
        json.dump(output_rows, output_file, ensure_ascii=False)

    print("wrote " + str(len(output_rows)) + " events to " + arguments.out, file=sys.stderr)
    print("raw rows before dedupe: " + str(len(all_rows)), file=sys.stderr)


if __name__ == "__main__":
    main()
