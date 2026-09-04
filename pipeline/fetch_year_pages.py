"""
Geotemporal Transurfing — "whatever was in the news": events from Wikipedia's year-by-country pages.

Run:   python3 fetch_year_pages.py --from 2000 --to 2026 --out events_yearpages.json
Needs: pip install requests

English Wikipedia keeps a page per country per year ("2015 in India", "2015 in the United States") whose "Events"
section is a dated bullet list written by editors: "* 12 March – Text with [[links]]". That is the best even-across-
countries source of what mattered locally. This script:
  1. fetches the wikitext of every "YYYY in <country>" page for the countries in countries.json (Natural Earth
     names, mapped to Wikipedia's naming), trying "YYYY in X" then "YYYY in the X";
  2. parses dated bullets (day + month at the start of the line, or under a month heading) into events; the
     editor's sentence, markup stripped, becomes the headline;
  3. places each event at the first linked article that has coordinates (asked in batches of 50 titles), else at
     the country's centroid (confidence "country");
  4. classifies by keywords into the four categories and writes rows in the shared row shape, source "yearpage",
     slug = the first linked article (for photo and lead paragraph), so merge.js dedupes against Wikidata rows.
Every page and every coordinate batch is cached in yearpages_cache/. A full run is ~5,000 page fetches plus about
as many coordinate batches: roughly an hour, cheap to repeat.

Coverage is uneven — the pages are thorough for large English-speaking and populous countries and thin for small
ones — and the text is English Wikipedia's editorial choice. Both are stated in the README.
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.parse

import requests

USER_AGENT = "GeotemporalTransurfing/0.6 (https://github.com/aregmii/geotemporal-transurfing)"
API = "https://en.wikipedia.org/w/api.php"
CACHE_DIR = "yearpages_cache"
PAUSE_SECONDS = 0.15
HERE = os.path.dirname(os.path.abspath(__file__))

# Natural Earth name -> Wikipedia's name in "YYYY in ..." (None = skip: not a country or no such pages)
NAME_MAP = {
    "United States of America": "the United States", "United Kingdom": "the United Kingdom", "Dem. Rep. Congo": "the Democratic Republic of the Congo",
    "Congo": "the Republic of the Congo", "Dominican Rep.": "the Dominican Republic", "Central African Rep.": "the Central African Republic",
    "Czechia": "the Czech Republic", "Bosnia and Herz.": "Bosnia and Herzegovina", "S. Sudan": "South Sudan", "eSwatini": "Eswatini",
    "Côte d'Ivoire": "Ivory Coast", "Netherlands": "the Netherlands", "Philippines": "the Philippines", "Solomon Is.": "the Solomon Islands",
    "Bahamas": "the Bahamas", "Gambia": "the Gambia", "United Arab Emirates": "the United Arab Emirates", "Marshall Is.": "the Marshall Islands",
    "Eq. Guinea": "Equatorial Guinea", "Macedonia": "North Macedonia", "Timor-Leste": "East Timor", "Vatican": "Vatican City",
    "W. Sahara": None, "Falkland Is.": None, "Fr. S. Antarctic Lands": None, "Greenland": "Greenland", "Antarctica": None,
    "N. Cyprus": None, "Somaliland": None, "Puerto Rico": "Puerto Rico", "New Caledonia": None, "Palestine": "the State of Palestine",
    "Taiwan": "Taiwan", "Kosovo": "Kosovo", "Trinidad and Tobago": "Trinidad and Tobago",
}
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
MONTH_INDEX = {m: i + 1 for i, m in enumerate(MONTHS)}
MONTH_RE = "(?:" + "|".join(MONTHS) + ")"
# "* 12 March – text", "* March 12 – text", "* 12–14 March – text", "* March 12–14 – text"
BULLET = re.compile(r"^\*+\s*(?:\[\[)?(?:(\d{1,2})(?:[–-]\d{1,2})?\s+(" + MONTH_RE + r")|(" + MONTH_RE + r")\s+(\d{1,2})(?:[–-]\d{1,2})?)(?:\]\])?\s*[–—-]\s*(.+)$")
HEADING = re.compile(r"^==+\s*(" + MONTH_RE + r")\s*==+")
DAY_ONLY = re.compile(r"^\*+\s*(\d{1,2})\s*[–—-]\s*(.+)$")

CATEGORY_RULES = [
    ("dis", r"earthquake|flood|hurricane|cyclone|typhoon|tornado|storm|eruption|tsunami|wildfire|bushfire|famine|pandemic|epidemic|outbreak|crash|crashes|collision|derail|sinks|sinking|capsiz|disaster|explosion|fire kills|landslide|avalanche|drought|heat ?wave|stampede|collapse"),
    ("con", r"war|battle|attack|bombing|bomb|massacre|coup|rebel|uprising|invasion|offensive|conflict|assassinat|shooting|shot dead|riot|protest|demonstrat|election|referendum|treaty|ceasefire|genocide|insurgen|militant|terror|strike|impeach|resign|sworn in|inaugurat|prime minister|president|parliament|court|sentenced|arrested|killed|dies|death|murder"),
    ("sci", r"launch|satellite|spacecraft|rocket|discover|scientist|nobel|telescope|vaccine|research|university|first .* flight|record|patent|internet|technology|reactor|nuclear plant|mission|probe"),
]
LINK = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]")


def cache_path(key):
    return os.path.join(CACHE_DIR, key + ".json")


def cached(key):
    p = cache_path(key)
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def store(key, value):
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(cache_path(key), "w", encoding="utf-8") as f:
        json.dump(value, f, ensure_ascii=False)


def api(params):
    params = dict(params, format="json", formatversion="2")
    for attempt in range(3):
        try:
            r = requests.get(API, params=params, headers={"User-Agent": USER_AGENT}, timeout=60)
            if r.status_code == 429:
                time.sleep(30)
                continue
            r.raise_for_status()
            time.sleep(PAUSE_SECONDS)
            return r.json()
        except requests.RequestException as error:
            print("  " + type(error).__name__ + " — retrying", file=sys.stderr)
            time.sleep(5 * (attempt + 1))
    return None


def page_wikitext(title):
    """Wikitext of a page, or None if it does not exist. Cached (missing pages too)."""
    key = "page_" + hashlib.sha1(title.encode("utf-8")).hexdigest()[:20]
    c = cached(key)
    if c is not None:
        return c.get("text")
    data = api({"action": "query", "prop": "revisions", "rvprop": "content", "rvslots": "main", "titles": title, "redirects": "1"})
    text = None
    if data:
        for page in data.get("query", {}).get("pages", []):
            if "missing" in page:
                continue
            revs = page.get("revisions") or []
            if revs:
                text = revs[0].get("slots", {}).get("main", {}).get("content")
    store(key, {"text": text})
    return text


def coordinates(titles):
    """title -> [lat, lon] for the titles that have coordinates. Batches of 50, cached per batch."""
    out = {}
    titles = sorted(set(t for t in titles if t))
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        key = "coord_" + hashlib.sha1("|".join(batch).encode("utf-8")).hexdigest()[:20]
        c = cached(key)
        if c is None:
            c = {}
            data = api({"action": "query", "prop": "coordinates", "titles": "|".join(batch), "redirects": "1", "colimit": "50"})
            if data:
                norm = {}
                for r in data.get("query", {}).get("redirects", []) + data.get("query", {}).get("normalized", []):
                    norm[r["to"]] = r["from"]
                for page in data.get("query", {}).get("pages", []):
                    co = page.get("coordinates")
                    if co:
                        t = page.get("title")
                        c[t] = [co[0]["lat"], co[0]["lon"]]
                        if t in norm:
                            c[norm[t]] = c[t]
            store(key, c)
        out.update(c)
    return out


def strip_markup(text):
    text = re.sub(r"<ref[^>]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = LINK.sub(lambda m: m.group(2) if m.group(2) is not None else m.group(1), text)
    text = re.sub(r"'{2,}", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text.rstrip(".")


def category_of(text):
    low = text.lower()
    for cat, pat in CATEGORY_RULES:
        if re.search(pat, low):
            return cat
    return "cul"


def parse_page(text, year):
    """Yield (month, day, headline, links) for dated bullets in the Events part of a year page."""
    events = []
    in_events, month_ctx = False, None
    for raw in text.split("\n"):
        line = raw.strip()
        if line.startswith("=="):
            name = line.strip("= ").lower()
            m = HEADING.match(line)
            if m:
                month_ctx = MONTH_INDEX[m.group(1)]
                continue
            month_ctx = None
            in_events = name.startswith("events") or name in ("incumbents", "ongoing") or in_events and name not in ("deaths", "births", "see also", "references", "external links", "holidays", "sport", "sports", "art and entertainment", "culture", "predicted and scheduled events", "scheduled events")
            if name.startswith("deaths") or name.startswith("births") or name.startswith("see also") or name.startswith("references"):
                in_events = False
            continue
        if not in_events or not line.startswith("*") or line.startswith("**"):
            continue
        m = BULLET.match(line)
        if m:
            day = int(m.group(1) or m.group(4)); month = MONTH_INDEX[m.group(2) or m.group(3)]; body = m.group(5)
        else:
            m2 = DAY_ONLY.match(line) if month_ctx else None
            if not m2:
                continue
            day = int(m2.group(1)); month = month_ctx; body = m2.group(2)
        if not (1 <= day <= 31):
            continue
        links = [l.group(1).strip() for l in LINK.finditer(body)]
        headline = strip_markup(body)
        if len(headline) < 12:
            continue
        events.append((month, day, headline, links))
    return events


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="year_from", type=int, default=2000)
    parser.add_argument("--to", dest="year_to", type=int, default=2026)
    parser.add_argument("--out", default="events_yearpages.json")
    parser.add_argument("--countries", default=os.path.join(HERE, "countries.json"))
    parser.add_argument("--only", default=None, help="comma-separated country names, for a quick test")
    args = parser.parse_args()
    with open(args.countries, "r", encoding="utf-8") as f:
        countries = json.load(f)
    names = list(countries)
    if args.only:
        names = [n for n in names if n in args.only.split(",")]
    rows, pages_found, pages_missing = [], 0, 0
    for name in names:
        wiki = NAME_MAP.get(name, name)
        if wiki is None:
            continue
        lat, lon = countries[name]
        plain = wiki[4:] if wiki.startswith("the ") else wiki
        for year in range(args.year_from, args.year_to + 1):
            text = page_wikitext(str(year) + " in " + wiki)
            if text is None and wiki != plain:
                text = page_wikitext(str(year) + " in " + plain)
            if text is None and not wiki.startswith("the "):
                text = page_wikitext(str(year) + " in the " + wiki)
            if text is None:
                pages_missing += 1
                continue
            pages_found += 1
            events = parse_page(text, year)
            if not events:
                continue
            coords = coordinates([l for ev in events for l in ev[3][:4]])
            for month, day, headline, links in events:
                place, point, confidence = plain, [lat, lon], "country"
                for l in links[:4]:
                    if l in coords and l != plain and l != wiki:
                        place, point, confidence = l, coords[l], "place"
                        break
                slug = None
                for l in links:
                    if l not in (plain, wiki) and not l.lower().startswith(("file:", "image:", "category:")):
                        slug = l.replace(" ", "_")
                        break
                date = "%04d-%02d-%02d" % (year, month, day)
                rows.append([
                    headline[:160], round(point[0], 2), round(point[1], 2), year, year, category_of(headline), 1,
                    place, "", slug or ("yp:" + hashlib.sha1((date + headline).encode("utf-8")).hexdigest()[:10]),
                    confidence, 0, "yearpage", date, None,
                ])
        print(name + ": " + str(len(rows)) + " rows so far", file=sys.stderr)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False)
    print("wrote " + str(len(rows)) + " rows from " + str(pages_found) + " pages (" + str(pages_missing) + " missing) to " + args.out, file=sys.stderr)


if __name__ == "__main__":
    main()
