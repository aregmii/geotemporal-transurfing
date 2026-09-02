"""
Chrono Geography Transfusion — Wikidata extraction script (v0.6).
v0.6 adds the wide pull: every item with a day-precision point in time (P585), coordinates and enough language editions,
and every person with a day-precision birth or death and a located birth/death place, in adaptive date slices.

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
       [title, lat, lon, start_year, end_year, category, weight, place, description, wikipedia_slug,
        confidence, sitelinks, source, exact_date (YYYY-MM-DD or null), discoverer_or_author (or null)]

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
import datetime
import json
import os
import re
import sys
import time

import requests

ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "AtlasOfWhen/0.1 (personal history-map prototype; contact: amishregmi.brt@gmail.com)"
CACHE_DIR = "wdqs_cache"
PAUSE_SECONDS = 2.0
MAX_EVENTS = 250000
PERSON_MIN_SITELINKS = 150
EVENT_MIN_SITELINKS = 25
# v0.6 wide pull — "everything with a date". Lower these for more rows; each query is capped at SLICE_LIMIT rows
# and a slice that hits the cap or times out is split in half and retried (down to SLICE_MIN_DAYS).
DATED_MIN_SITELINKS = 25        # items with a day-precision point in time (P585)
PERSON_DEEP_MIN_SITELINKS = 60  # people with a day-precision birth or death
SLICE_LIMIT = 4000
SLICE_MIN_DAYS = 14

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

# Discoveries and inventions: anything with a "time of discovery or invention" (P575).
# Location, in order of trust: the item's own coordinate, its location (P276), its location of discovery (P189),
# then where the discoverer worked (P937 work location, or the headquarters P159 of their employer P108).
DISCOVERY_QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?when ?coord ?placeLabel ?placeCoord ?siteLabel ?siteCoord
       ?who ?whoLabel ?workLabel ?workCoord ?orgLabel ?orgCoord ?article ?sitelinks WHERE {
  ?item wdt:P575 ?when . hint:Prior hint:rangeSafe true .
  FILTER(?when >= "%(date_from)s"^^xsd:dateTime && ?when < "%(date_to)s"^^xsd:dateTime)
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= %(min_sitelinks)d)
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P276 ?place . ?place wdt:P625 ?placeCoord . }
  OPTIONAL { ?item wdt:P189 ?site . ?site wdt:P625 ?siteCoord . }
  OPTIONAL { ?item wdt:P61 ?who .
             OPTIONAL { ?who wdt:P937 ?work . ?work wdt:P625 ?workCoord . }
             OPTIONAL { ?who wdt:P108 ?org . ?org wdt:P159 ?hq . ?hq wdt:P625 ?orgCoord . } }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT %(limit)d
"""
DISCOVERY_DATE_SLICES = [(-4000, 1700), (1700, 1850), (1850, 1900), (1900, 1930), (1930, 1960), (1960, 1990), (1990, 2030)]
DISCOVERY_MIN_SITELINKS = 12

# Spacecraft launches: anything with a launch date (P619). Located by launch site (P?) is unreliable, so: own coordinate,
# then the operator's headquarters, then the country.
LAUNCH_QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?when ?coord ?orgLabel ?orgCoord ?countryCoord ?article ?sitelinks WHERE {
  ?item wdt:P619 ?when . hint:Prior hint:rangeSafe true .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= %(min_sitelinks)d)
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P137 ?org . ?org wdt:P159 ?hq . ?hq wdt:P625 ?orgCoord . }
  OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P625 ?countryCoord . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
"""

# Well-known scientific publications (Q591041, UNVERIFIED): located where the author worked.
PUBLICATION_QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?when ?who ?whoLabel ?workLabel ?workCoord ?orgLabel ?orgCoord ?article ?sitelinks WHERE {
  ?item wdt:P31 wd:Q591041 .
  ?item wikibase:sitelinks ?sitelinks .
  FILTER(?sitelinks >= %(min_sitelinks)d)
  ?item wdt:P577 ?when .
  OPTIONAL { ?item wdt:P50 ?who .
             OPTIONAL { ?who wdt:P937 ?work . ?work wdt:P625 ?workCoord . }
             OPTIONAL { ?who wdt:P108 ?org . ?org wdt:P159 ?hq . ?hq wdt:P625 ?orgCoord . } }
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

# v0.6: anything with a day-precision point in time. p:/psv: exposes the precision (11 = day), so these dates are
# exact by construction. Location: own coordinate, else the location's (P276), else the country's (P17).
DATED_QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?when ?coord ?placeLabel ?placeCoord ?countryCoord ?classLabel ?article ?sitelinks WHERE {
  ?item p:P585 ?st . ?st psv:P585 ?tv . ?tv wikibase:timePrecision 11 . ?tv wikibase:timeValue ?when .
  hint:Prior hint:rangeSafe true .
  FILTER(?when >= "%(date_from)s"^^xsd:dateTime && ?when < "%(date_to)s"^^xsd:dateTime)
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= %(min_sitelinks)d)
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P276 ?place . ?place wdt:P625 ?placeCoord . }
  OPTIONAL { ?item wdt:P17 ?country . ?country wdt:P625 ?countryCoord . }
  OPTIONAL { ?item wdt:P31 ?class . }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT %(limit)d
"""

# v0.6: people with a day-precision birth (this slice) — death handled by the same row when it is day-precise.
PERSON_DEEP_QUERY = """
SELECT ?item ?itemLabel ?itemDescription ?born ?died ?birthPlaceLabel ?birthCoord ?deathPlaceLabel ?deathCoord ?occLabel ?article ?sitelinks WHERE {
  ?item p:P569 ?bs . ?bs psv:P569 ?bv . ?bv wikibase:timePrecision 11 . ?bv wikibase:timeValue ?born .
  hint:Prior hint:rangeSafe true .
  FILTER(?born >= "%(date_from)s"^^xsd:dateTime && ?born < "%(date_to)s"^^xsd:dateTime)
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= %(min_sitelinks)d)
  OPTIONAL { ?item wdt:P19 ?birthPlace . ?birthPlace wdt:P625 ?birthCoord . }
  OPTIONAL { ?item p:P570 ?ds . ?ds psv:P570 ?dv . ?dv wikibase:timePrecision 11 . ?dv wikibase:timeValue ?died . }
  OPTIONAL { ?item wdt:P20 ?deathPlace . ?deathPlace wdt:P625 ?deathCoord . }
  OPTIONAL { ?item wdt:P106 ?occ . }
  ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT %(limit)d
"""

# class / occupation label -> category, for the wide pull
CLASS_CATEGORY = [
    ("con", r"war|battle|siege|attack|bombing|massacre|coup|rebellion|revolt|uprising|invasion|offensive|conflict|assassination|shooting|riot|protest|election|referendum|treaty|armistice|ceasefire|genocide|insurgency|mutiny|crusade|terror|military|strike"),
    ("dis", r"earthquake|flood|hurricane|cyclone|typhoon|tornado|storm|eruption|volcan|tsunami|wildfire|famine|pandemic|epidemic|outbreak|accident|crash|collision|derailment|shipwreck|sinking|disaster|explosion|fire|landslide|avalanche|drought|heat wave|blizzard"),
    ("sci", r"discover|invention|experiment|launch|spaceflight|space mission|expedition|eclipse|transit|observation|publication|scientific|patent|first flight|maiden|test|telescope|satellite|probe|rover|nobel|theorem|comet|asteroid|supernova"),
]
OCC_CATEGORY = [
    ("sci", r"scientist|physicist|chemist|biologist|mathematician|astronomer|engineer|inventor|physician|geologist|computer|economist|psychologist|explorer|astronaut|cosmonaut|aviator"),
    ("con", r"politician|military|general|admiral|soldier|revolutionary|monarch|emperor|king|queen|president|prime minister|dictator|diplomat|statesman|activist"),
]
def category_from_label(label, table, default):
    text = (label or "").lower()
    for category, pattern in table:
        if re.search(pattern, text):
            return category
    return default

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


LAST_FAILURE = {"kind": None}   # "timeout" splits a slice; "connection" stops the wide pull


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
            LAST_FAILURE["kind"] = "timeout"
            time.sleep(PAUSE_SECONDS)
            return {"results": {"bindings": []}}
        payload = response.json()
    except requests.Timeout:
        print("  FAILED " + cache_key + ": read timeout — skipping", file=sys.stderr)
        LAST_FAILURE["kind"] = "timeout"
        return {"results": {"bindings": []}}
    except requests.RequestException as error:
        print("  FAILED " + cache_key + ": " + type(error).__name__ + " (no connection to the query service) — skipping", file=sys.stderr)
        LAST_FAILURE["kind"] = "connection"
        return {"results": {"bindings": []}}
    LAST_FAILURE["kind"] = None
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


def date_of(iso_date_string):
    # "1945-08-06T00:00:00Z" -> "1945-08-06". The truthy wdt: value carries no precision, and Wikidata pads
    # year-only and month-only dates to the 1st, so a date on the 1st of January is treated as year precision
    # and dropped (a real 1 January event loses its day; a query on p:/psv: with wikibase:timePrecision
    # would fix both). Returns None if missing.
    if iso_date_string is None:
        return None
    date = iso_date_string.split("T")[0]
    if date.endswith("-01-01"):
        return None
    return date


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
                "date": date_of(value_of(binding, "when")) or date_of(value_of(binding, "start")),
            })
    return rows


def first_point(binding, keys):
    for key in keys:
        point = parse_point(value_of(binding, key))
        if point is not None:
            return point, key
    return None, None


def collect_discoveries():
    rows = []
    for date_slice in DISCOVERY_DATE_SLICES:
        print("discoveries: P575 " + str(date_slice[0]) + " to " + str(date_slice[1]), file=sys.stderr)
        key = "discoveries_P575_" + str(date_slice[0]) + "_" + str(date_slice[1])
        sparql = DISCOVERY_QUERY % {"min_sitelinks": DISCOVERY_MIN_SITELINKS,
                                    "date_from": iso_date(date_slice[0]), "date_to": iso_date(date_slice[1]), "limit": 100000}
        payload = run_query(key, sparql)
        bindings = payload["results"]["bindings"]
        if not bindings and not os.path.exists(os.path.join(CACHE_DIR, key + ".json")) and date_slice[0] >= 1000:
            # the whole slice timed out (1850-1900 and 1960-2030 did in the first runs): retry in adaptive smaller slices
            if LAST_FAILURE["kind"] == "connection":
                continue
            print("  retrying " + key + " in smaller slices", file=sys.stderr)
            bindings = list(run_sliced(DISCOVERY_QUERY, "discoveries_P575", {"min_sitelinks": DISCOVERY_MIN_SITELINKS},
                                       datetime.date(date_slice[0], 1, 1), datetime.date(min(date_slice[1], 2027), 1, 1), 365 * 5))
        for binding in bindings:
            when_year = year_of(value_of(binding, "when"))
            if when_year is None:
                continue
            point, key = first_point(binding, ["coord", "placeCoord", "siteCoord", "workCoord", "orgCoord"])
            if point is None:
                continue
            confidence = {"coord": "exact", "placeCoord": "place", "siteCoord": "place", "workCoord": "workplace", "orgCoord": "workplace"}[key]
            place = value_of(binding, "placeLabel") or value_of(binding, "siteLabel") or value_of(binding, "workLabel") or value_of(binding, "orgLabel") or ""
            rows.append({
                "qid": value_of(binding, "item").rsplit("/", 1)[-1],
                "title": value_of(binding, "itemLabel"), "lat": point[0], "lon": point[1],
                "start": when_year, "end": when_year, "category": "sci",
                "sitelinks": int(value_of(binding, "sitelinks")), "place": place,
                "description": value_of(binding, "itemDescription") or "", "slug": slug_of(value_of(binding, "article")),
                "confidence": confidence, "source": "discovery",
                "date": date_of(value_of(binding, "when")), "who": value_of(binding, "whoLabel"),
            })
    return rows


def collect_launches():
    rows = []
    print("launches: P619", file=sys.stderr)
    payload = run_query("launches_P619", LAUNCH_QUERY % {"min_sitelinks": 20})
    for binding in payload["results"]["bindings"]:
        when_year = year_of(value_of(binding, "when"))
        if when_year is None:
            continue
        point, key = first_point(binding, ["coord", "orgCoord", "countryCoord"])
        if point is None:
            continue
        rows.append({
            "qid": value_of(binding, "item").rsplit("/", 1)[-1],
            "title": "Launch of " + (value_of(binding, "itemLabel") or ""), "lat": point[0], "lon": point[1],
            "start": when_year, "end": when_year, "category": "sci",
            "sitelinks": int(value_of(binding, "sitelinks")), "place": value_of(binding, "orgLabel") or "",
            "description": value_of(binding, "itemDescription") or "", "slug": slug_of(value_of(binding, "article")),
            "confidence": {"coord": "exact", "orgCoord": "workplace", "countryCoord": "country"}[key], "source": "launch",
            "date": date_of(value_of(binding, "when")), "who": None,
        })
    return rows


def collect_publications():
    rows = []
    print("publications: Q591041 (unverified class id)", file=sys.stderr)
    payload = run_query("publications_Q591041", PUBLICATION_QUERY % {"min_sitelinks": 25})
    for binding in payload["results"]["bindings"]:
        when_year = year_of(value_of(binding, "when"))
        if when_year is None:
            continue
        point, key = first_point(binding, ["workCoord", "orgCoord"])
        if point is None:
            continue
        rows.append({
            "qid": value_of(binding, "item").rsplit("/", 1)[-1],
            "title": (value_of(binding, "itemLabel") or "") + " published", "lat": point[0], "lon": point[1],
            "start": when_year, "end": when_year, "category": "sci",
            "sitelinks": int(value_of(binding, "sitelinks")), "place": value_of(binding, "workLabel") or value_of(binding, "orgLabel") or "",
            "description": value_of(binding, "itemDescription") or "", "slug": slug_of(value_of(binding, "article")),
            "confidence": "workplace", "source": "publication",
            "date": date_of(value_of(binding, "when")), "who": value_of(binding, "whoLabel"),
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
                    "date": date_of(value_of(binding, "born")), "who": None,
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
                    "date": date_of(value_of(binding, "died")), "who": None,
                })
    return rows


def iso_of(day):
    # datetime.date -> Wikidata xsd:dateTime; only used for years >= 1 (the wide pull starts at 1000)
    return day.strftime("%Y-%m-%dT00:00:00Z")


def run_sliced(query, key_prefix, params, day_from, day_to, days):
    """Run `query` over [day_from, day_to) in slices of `days`; a slice that times out (empty payload with no cache)
    or hits SLICE_LIMIT is split in half, down to SLICE_MIN_DAYS. Yields bindings."""
    cursor = day_from
    while cursor < day_to:
        end = min(day_to, cursor + datetime.timedelta(days=days))
        key = key_prefix + "_" + cursor.isoformat() + "_" + end.isoformat()
        cache_path = os.path.join(CACHE_DIR, key + ".json")
        had_cache = os.path.exists(cache_path)
        payload = run_query(key, query % dict(params, date_from=iso_of(cursor), date_to=iso_of(end), limit=SLICE_LIMIT))
        bindings = payload["results"]["bindings"]
        failed = not had_cache and not os.path.exists(cache_path)      # run_query only caches successes
        if failed and LAST_FAILURE["kind"] == "connection":
            raise ConnectionError("query service unreachable")
        if (failed or len(bindings) >= SLICE_LIMIT) and days > SLICE_MIN_DAYS:
            print("  splitting " + key + (" (timed out)" if failed else " (hit the row cap)"), file=sys.stderr)
            for b in run_sliced(query, key_prefix, params, cursor, end, max(SLICE_MIN_DAYS, days // 2)):
                yield b
        else:
            for b in bindings:
                yield b
        cursor = end


def wide_slices():
    # (from, to, initial slice in days): coarse before 1800, yearly to 1990, quarterly after
    D = datetime.date
    return [
        (D(1000, 1, 1), D(1800, 1, 1), 3650 * 5),
        (D(1800, 1, 1), D(1900, 1, 1), 3650),
        (D(1900, 1, 1), D(1990, 1, 1), 365),
        (D(1990, 1, 1), D(2027, 1, 1), 92),
    ]


def collect_dated():
    """v0.6 wide pull: every non-human item with a day-precision point in time."""
    rows = []
    best = {}
    for day_from, day_to, days in wide_slices():
        print("dated: " + str(day_from.year) + " to " + str(day_to.year), file=sys.stderr)
        for binding in run_sliced(DATED_QUERY, "dated", {"min_sitelinks": DATED_MIN_SITELINKS}, day_from, day_to, days):
            qid = value_of(binding, "item").rsplit("/", 1)[-1]
            point, point_key = first_point(binding, ["coord", "placeCoord", "countryCoord"])
            if point is None:
                continue
            when = value_of(binding, "when")
            year = year_of(when)
            if year is None:
                continue
            category = category_from_label(value_of(binding, "classLabel"), CLASS_CATEGORY, None)
            if qid in best:
                if category and not best[qid]["_cat"]:
                    best[qid]["category"] = category; best[qid]["_cat"] = True
                continue
            row = {
                "qid": qid, "title": value_of(binding, "itemLabel"), "lat": point[0], "lon": point[1],
                "start": year, "end": year, "category": category or "cul",
                "sitelinks": int(value_of(binding, "sitelinks")), "place": value_of(binding, "placeLabel") or "",
                "description": value_of(binding, "itemDescription") or "", "slug": slug_of(value_of(binding, "article")),
                "confidence": {"coord": "exact", "placeCoord": "place", "countryCoord": "country"}[point_key], "source": "dated", "date": when.split("T")[0], "who": None, "_cat": bool(category),
            }
            best[qid] = row
            rows.append(row)
    for row in rows:
        del row["_cat"]
    return rows


def collect_people_deep():
    """v0.6: births and deaths at day precision for everyone above PERSON_DEEP_MIN_SITELINKS."""
    rows = []
    seen = set()
    for day_from, day_to, days in wide_slices():
        print("people (deep): born " + str(day_from.year) + " to " + str(day_to.year), file=sys.stderr)
        for binding in run_sliced(PERSON_DEEP_QUERY, "peopledeep", {"min_sitelinks": PERSON_DEEP_MIN_SITELINKS}, day_from, day_to, days):
            qid = value_of(binding, "item").rsplit("/", 1)[-1]
            if qid in seen:
                continue
            seen.add(qid)
            name = value_of(binding, "itemLabel")
            description = value_of(binding, "itemDescription") or ""
            sitelinks = int(value_of(binding, "sitelinks"))
            slug = slug_of(value_of(binding, "article"))
            category = category_from_label(value_of(binding, "occLabel"), OCC_CATEGORY, "cul")
            for kind, when_key, place_key, coord_key in (("Birth", "born", "birthPlaceLabel", "birthCoord"), ("Death", "died", "deathPlaceLabel", "deathCoord")):
                when = value_of(binding, when_key)
                point = parse_point(value_of(binding, coord_key))
                year = year_of(when)
                if when is None or point is None or year is None:
                    continue
                rows.append({
                    "qid": qid, "title": kind + " of " + name, "lat": point[0], "lon": point[1],
                    "start": year, "end": year, "category": category, "sitelinks": sitelinks,
                    "place": value_of(binding, place_key) or "", "description": description, "slug": slug,
                    "confidence": "associated", "source": "person", "date": when.split("T")[0], "who": None,
                })
    return rows


def sort_key(row):
    return -row["sitelinks"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="events_wikidata.json")
    parser.add_argument("--max", type=int, default=MAX_EVENTS)
    parser.add_argument("--no-wide", action="store_true", help="skip the v0.6 wide pull (everything with a day-precision date)")
    arguments = parser.parse_args()

    all_rows = collect_events() + collect_discoveries() + collect_launches() + collect_publications() + collect_people()
    if not arguments.no_wide:
        try:
            all_rows += collect_dated()
            all_rows += collect_people_deep()
        except ConnectionError as error:
            print("wide pull stopped: " + str(error) + " — keeping what came back", file=sys.stderr)

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
            row.get("date"), row.get("who"),
        ])

    with open(arguments.out, "w", encoding="utf-8") as output_file:
        json.dump(output_rows, output_file, ensure_ascii=False)

    print("wrote " + str(len(output_rows)) + " events to " + arguments.out, file=sys.stderr)
    print("raw rows before dedupe: " + str(len(all_rows)), file=sys.stderr)


if __name__ == "__main__":
    main()
