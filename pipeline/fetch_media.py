"""
Geotemporal Transfusing — find, licence-check and pack one audio or video clip per major event.

Run:   python3 fetch_media.py ../site/data/events.json --from 1926 --min-weight 3 --media-dir ../site/media --out ../site/data/media.json
Needs: pip install requests        optional: ffmpeg on PATH (clips are then cut to --seconds and re-encoded small)

Where clips come from, in order:
  1. curated_media.json — { slug: "File:Name on Commons.ogg" } hand-picked Commons files (best quality of match).
  2. Wikidata: the event's item (via its English article) with P51 audio or P10 video.
  3. Commons full-text search for the event title with filetype:audio / filetype:video (the first hit under a
     reusable licence; loose, so a --min-weight of 3 keeps this to the events people will actually zoom into).
Every candidate goes through the Commons API for licence + author (extmetadata); only Creative Commons,
CC0, public-domain and GFDL files are kept. Downloads are cached in media_cache/, safe to re-run.

Output manifest: { slug: { file, kind: "audio"|"video", title, author, license, licenseUrl, filePage, seconds } }
The app plays these through the "Sound" toggle: louder as you zoom toward the card, credit shown in the panel.

Wikidata property ids used (unverified against wikidata.org in this session): P51 audio, P10 video.
"""

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.parse

import requests

USER_AGENT = "GeotemporalTransfusing/0.1 (personal history-map prototype; contact: amishregmi.brt@gmail.com)"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
WDQS = "https://query.wikidata.org/sparql"
CACHE_DIR = "media_cache"
PAUSE_SECONDS = 0.3
ALLOWED_LICENSE = re.compile(r"(CC|Creative Commons|Public domain|PD|CC0|GFDL|No restrictions)", re.IGNORECASE)
AUDIO_EXT = (".ogg", ".oga", ".opus", ".mp3", ".wav", ".flac", ".m4a")
VIDEO_EXT = (".webm", ".ogv", ".mp4", ".mpg", ".mpeg", ".gif")   # a gif is re-encoded to webm by ffmpeg
HAVE_FFMPEG = shutil.which("ffmpeg") is not None
MAX_RAW_BYTES = 80 * 1024 * 1024     # skip originals bigger than this (a 2 GB documentary is not a hologram)
MAX_OUT_BYTES = 1500 * 1024          # clips already packed bigger than this are re-packed with the current settings


def strip_tags(text):
    if not text:
        return None
    return html.unescape(re.sub(r"<[^>]+>", "", text)).strip() or None


def cache_get(key):
    path = os.path.join(CACHE_DIR, key + ".json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def cache_put(key, value):
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(os.path.join(CACHE_DIR, key + ".json"), "w", encoding="utf-8") as f:
        json.dump(value, f)


def commons_get(params):
    params = dict(params, format="json")
    response = requests.get(COMMONS_API, params=params, headers={"User-Agent": USER_AGENT}, timeout=60)
    response.raise_for_status()
    time.sleep(PAUSE_SECONDS)
    return response.json()


def file_info(filename):
    """Licence, author, direct URL and duration for one Commons file. Cached."""
    key = "info_" + hashlib.sha1(filename.encode("utf-8")).hexdigest()[:16]
    cached = cache_get(key)
    if cached is not None:
        return cached
    data = commons_get({
        "action": "query", "titles": "File:" + filename, "prop": "imageinfo",
        "iiprop": "extmetadata|url|size|mime", "iiextmetadatafilter": "Artist|LicenseShortName|LicenseUrl|ObjectName",
    })
    info = None
    for page in data.get("query", {}).get("pages", {}).values():
        infos = page.get("imageinfo")
        if not infos:
            continue
        ii = infos[0]
        meta = ii.get("extmetadata", {})
        info = {
            "url": ii.get("url"), "mime": ii.get("mime"), "size": ii.get("size"), "duration": ii.get("duration"),
            "author": strip_tags(meta.get("Artist", {}).get("value")),
            "license": strip_tags(meta.get("LicenseShortName", {}).get("value")),
            "licenseUrl": strip_tags(meta.get("LicenseUrl", {}).get("value")),
            "title": strip_tags(meta.get("ObjectName", {}).get("value")) or filename.rsplit(".", 1)[0].replace("_", " "),
            "filePage": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(filename.replace(" ", "_")),
        }
    cache_put(key, info or {})
    return info or {}


def search_commons(title, kind):
    """First few Commons files whose text matches the event title, audio or video only. Cached."""
    key = "search_" + kind + "_" + hashlib.sha1(title.encode("utf-8")).hexdigest()[:16]
    cached = cache_get(key)
    if cached is not None:
        return cached
    data = commons_get({
        "action": "query", "list": "search", "srnamespace": "6", "srlimit": "5",
        "srsearch": '"' + title + '" filetype:' + kind,
    })
    names = [hit["title"][len("File:"):] for hit in data.get("query", {}).get("search", []) if hit.get("title", "").startswith("File:")]
    cache_put(key, names)
    return names


def wikidata_media(slugs):
    """slug -> [Commons filenames] from P51 (audio) / P10 (video) on the item behind each English article. Cached per batch."""
    key = "wd_" + hashlib.sha1("|".join(sorted(slugs)).encode("utf-8")).hexdigest()[:16]
    cached = cache_get(key)
    if cached is not None:
        return cached
    values = " ".join('<https://en.wikipedia.org/wiki/' + urllib.parse.quote(s.replace(" ", "_"), safe="()',!*:/") + '>' for s in slugs)
    sparql = """
SELECT ?article ?media WHERE {
  VALUES ?article { %s }
  ?article schema:about ?item .
  { ?item wdt:P51 ?media } UNION { ?item wdt:P10 ?media }
}""" % values
    out = {}
    try:
        response = requests.get(WDQS, params={"query": sparql}, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}, timeout=95)
        if response.status_code == 200:
            for b in response.json()["results"]["bindings"]:
                slug = urllib.parse.unquote(b["article"]["value"].rsplit("/", 1)[-1])
                name = urllib.parse.unquote(b["media"]["value"].rsplit("/", 1)[-1]).replace("_", " ")
                out.setdefault(slug, []).append(name)
        else:
            print("  Wikidata media query HTTP " + str(response.status_code) + " — skipping this batch", file=sys.stderr)
    except requests.RequestException as error:
        print("  Wikidata media query failed: " + str(error), file=sys.stderr)
    time.sleep(1.0)
    cache_put(key, out)
    return out


STOPWORDS = set("the of a an in on at and or to for by from with de la le du des von der die das el los las war battle attack death birth launch".split())


def title_tokens(title):
    return [t for t in re.sub(r"[^\w\s-]", " ", title.lower()).split() if len(t) >= 3 and t not in STOPWORDS]


def article_title(slug):
    return re.sub(r"\s*\(.*?\)\s*", " ", urllib.parse.unquote(slug).replace("_", " ")).strip()


def name_matches(title, filename):
    """A search hit counts only if the file NAME carries the event's words (the full-text search also matches
    descriptions, which is how "Elizabeth II" once returned the edge of a one-pound coin)."""
    tokens = title_tokens(title)
    if not tokens:
        return False
    name = filename.lower().replace("_", " ")
    hits = sum(1 for t in tokens if t in name)
    return hits >= max(1, int(round(len(tokens) * 0.7)))


def kind_of(filename):
    lower = filename.lower()
    if lower.endswith(AUDIO_EXT):
        return "audio"
    if lower.endswith(VIDEO_EXT):
        return "video"
    return None


def pack(raw_path, out_path, kind, seconds):
    """Cut to `seconds` and re-encode small with ffmpeg (opus 40 kbps mono / vp9 360p); copy through without it."""
    if not HAVE_FFMPEG:
        shutil.copyfile(raw_path, out_path)
        return
    if kind == "audio":
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", raw_path, "-t", str(seconds), "-vn", "-ac", "1", "-c:a", "libopus", "-b:a", "40k", out_path]
    elif raw_path.lower().endswith(".gif"):
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-ignore_loop", "0", "-i", raw_path, "-t", str(seconds), "-vf", "scale=-2:240:flags=lanczos,fps=12", "-c:v", "libvpx-vp9", "-b:v", "260k", "-an", out_path]
    else:
        # small on purpose: the clip plays inside a hologram card a few hundred pixels wide, and hundreds of clips ship with the site
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", raw_path, "-t", str(seconds), "-vf", "scale=-2:240,fps=15", "-c:v", "libvpx-vp9", "-b:v", "300k", "-c:a", "libopus", "-b:a", "40k", "-ac", "1", out_path]
    subprocess.run(cmd, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("events")
    parser.add_argument("--from", dest="year_from", type=int, default=1926)
    parser.add_argument("--min-weight", type=int, default=3)
    parser.add_argument("--media-dir", default="../site/media")
    parser.add_argument("--out", default="../site/data/media.json")
    parser.add_argument("--seconds", type=int, default=30, help="clip length after cutting (needs ffmpeg)")
    parser.add_argument("--max", type=int, default=400, help="at most this many events looked up per run")
    parser.add_argument("--curated", default="curated_media.json")
    args = parser.parse_args()

    with open(args.events, "r", encoding="utf-8") as f:
        rows = json.load(f)
    manifest = {}
    if os.path.exists(args.out):
        with open(args.out, "r", encoding="utf-8") as f:
            manifest = json.load(f)
    # entries found by search under the old, looser rule (no "via" recorded, or a name that does not carry the title) go
    for slug in list(manifest):
        entry = manifest[slug]
        if entry.get("via") in ("curated", "wikidata"):
            continue
        name = entry.get("name") or urllib.parse.unquote(entry.get("filePage", "").split("File:")[-1]).replace("_", " ")
        if not name or not name_matches(article_title(slug), name):
            print("  dropping " + slug + " (loose match: " + str(entry.get("name") or entry.get("title")) + ")", file=sys.stderr)
            del manifest[slug]
    curated = {}
    if os.path.exists(args.curated):
        with open(args.curated, "r", encoding="utf-8") as f:
            curated = {k: v for k, v in json.load(f).items() if not k.startswith("_")}
    os.makedirs(args.media_dir, exist_ok=True)

    # clips packed by an earlier, larger setting: re-pack from the cached original
    if HAVE_FFMPEG:
        for slug, entry in list(manifest.items()):
            out_path = os.path.join(args.media_dir, entry["file"])
            if not os.path.exists(out_path) or os.path.getsize(out_path) <= MAX_OUT_BYTES or not entry.get("name"):
                continue
            digest = hashlib.sha1(entry["name"].encode("utf-8")).hexdigest()[:16]
            raw_path = os.path.join(CACHE_DIR, digest + os.path.splitext(entry["name"])[1].lower())
            if os.path.exists(raw_path):
                try:
                    pack(raw_path, out_path, entry["kind"], args.seconds)
                    print("  re-packed " + slug + " -> " + str(os.path.getsize(out_path) // 1024) + " KB", file=sys.stderr)
                except subprocess.CalledProcessError as error:
                    print("  re-pack failed for " + slug + ": " + str(error), file=sys.stderr)

    wanted = []
    seen = set()
    for row in sorted(rows, key=lambda r: -r[6]):
        slug = row[9]
        if not slug or slug in seen or slug in manifest:
            continue
        if row[3] < args.year_from or (row[6] < args.min_weight and slug not in curated):
            continue
        seen.add(slug)
        wanted.append((slug, row[0]))
    wanted = wanted[: args.max]
    print(str(len(wanted)) + " events to look up (" + ("ffmpeg found" if HAVE_FFMPEG else "no ffmpeg: clips copied whole") + ")", file=sys.stderr)

    # candidates: curated, then Wikidata, then Commons search
    candidates = {slug: [] for slug, _ in wanted}          # slug -> [(filename, via)]
    for slug, _ in wanted:
        if slug in curated:
            name = curated[slug]
            candidates[slug].append((name[len("File:"):] if name.startswith("File:") else name, "curated"))
    slugs = [s for s, _ in wanted]
    for i in range(0, len(slugs), 80):
        for slug, names in wikidata_media(slugs[i:i + 80]).items():
            if slug in candidates:
                candidates[slug].extend((n, "wikidata") for n in names)
    for slug, title in wanted:
        if candidates[slug]:
            continue
        clean = article_title(slug)      # the article name, not our display title ("Salt March", not "Salt March reaches Dandi")
        # video first: a moving hurricane or a launch says more on the globe than a sound; audio for speeches and the rest
        for kind in ("video", "audio"):
            candidates[slug].extend((n, "search") for n in search_commons(clean, kind) if name_matches(clean, n))

    added = 0
    for slug, title in wanted:
        for name, via in candidates[slug]:
            kind = kind_of(name)
            if not kind:
                continue
            info = file_info(name)
            if not info.get("url") or not ALLOWED_LICENSE.search(info.get("license") or ""):
                continue
            if info.get("size") and info["size"] > MAX_RAW_BYTES:
                continue
            digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:16]
            raw_path = os.path.join(CACHE_DIR, digest + os.path.splitext(name)[1].lower())
            ext = (".opus" if kind == "audio" else ".webm") if HAVE_FFMPEG else os.path.splitext(name)[1].lower()
            out_name = digest + ext
            out_path = os.path.join(args.media_dir, out_name)
            try:
                if not os.path.exists(raw_path):
                    with requests.get(info["url"], headers={"User-Agent": USER_AGENT}, timeout=120, stream=True) as r:
                        r.raise_for_status()
                        with open(raw_path, "wb") as f:
                            for chunk in r.iter_content(1 << 16):
                                f.write(chunk)
                    time.sleep(PAUSE_SECONDS)
                if not os.path.exists(out_path):
                    pack(raw_path, out_path, kind, args.seconds)
            except (requests.RequestException, subprocess.CalledProcessError, OSError) as error:
                print("  " + slug + ": " + name + " failed — " + str(error), file=sys.stderr)
                continue
            manifest[slug] = {
                "file": out_name, "kind": kind, "name": name, "via": via, "title": info.get("title"), "author": info.get("author"),
                "license": info.get("license"), "licenseUrl": info.get("licenseUrl"), "filePage": info.get("filePage"),
                "seconds": min(args.seconds, int(float(info.get("duration") or args.seconds))) if HAVE_FFMPEG else info.get("duration"),
            }
            added += 1
            print("  + " + slug + " <- " + name + " (" + (info.get("license") or "?") + ")", file=sys.stderr)
            break
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=0)

    print("done: " + str(added) + " new clips, " + str(len(manifest)) + " in " + args.out, file=sys.stderr)


if __name__ == "__main__":
    main()
