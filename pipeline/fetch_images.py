"""
Atlas of When — fetch, license-check and pack event images from Wikimedia Commons.

Run:   python3 fetch_images.py events_wikidata.json --from 1926 --img-dir ../site/img --out ../site/data/images.json
Needs: pip install requests pillow

For every event in range that has a Commons lead image (recorded by fetch_summaries.py), or any slug in --slugs:
  1. Ask the Commons API, 50 files at a time, for the license and author (extmetadata) and a thumbnail URL.
  2. Keep only files under a licence that allows reuse: Creative Commons, public domain, CC0, GFDL.
  3. Download the thumbnail, re-encode to JPEG (TARGET_WIDTH px wide), and write it to --img-dir as <sha1>.jpg.
Writes the manifest --out: { wikipedia_slug: { file, author, license, licenseUrl, source, filePage } }.
Cached per file in img_cache/, safe to interrupt and re-run; already-written images are skipped.

Endpoint (verify): https://commons.wikimedia.org/w/api.php  action=query prop=imageinfo iiprop=extmetadata|url iiurlwidth=320
"""

import argparse
import hashlib
import html
import io
import json
import os
import re
import sys
import time
import urllib.parse

import requests

USER_AGENT = "AtlasOfWhen/0.1 (personal history-map prototype; contact: amishregmi.brt@gmail.com)"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
CACHE_DIR = "img_cache"
PAUSE_SECONDS = 0.15
TARGET_WIDTH = 320
JPEG_QUALITY = 74
ALLOWED_LICENSE = re.compile(r"(CC|Creative Commons|Public domain|PD|CC0|GFDL|No restrictions)", re.IGNORECASE)

try:
    from PIL import Image
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False


def filename_from_thumb_url(url):
    # .../commons/thumb/1/16/Official_Portrait.jpg/330px-Official_Portrait.jpg?... -> Official_Portrait.jpg
    path = urllib.parse.urlparse(url).path
    parts = path.split("/")
    if "thumb" in parts:
        index = parts.index("thumb")
        if len(parts) > index + 3:
            return urllib.parse.unquote(parts[index + 3])
    return urllib.parse.unquote(parts[-1])


def strip_tags(text):
    if text is None:
        return ""
    return html.unescape(re.sub(r"<[^>]+>", "", text)).strip()


def lookup_batch(filenames):
    titles = "|".join(["File:" + name for name in filenames])
    params = {
        "action": "query", "format": "json", "titles": titles,
        "prop": "imageinfo", "iiprop": "extmetadata|url", "iiurlwidth": str(TARGET_WIDTH + 20),
        "iiextmetadatafilter": "Artist|LicenseShortName|LicenseUrl|Credit",
    }
    response = requests.get(COMMONS_API, params=params, headers={"User-Agent": USER_AGENT}, timeout=60)
    response.raise_for_status()
    pages = response.json().get("query", {}).get("pages", {})
    result = {}
    for page_id in pages:
        page = pages[page_id]
        title = page.get("title", "")
        name = title[len("File:"):] if title.startswith("File:") else title
        infos = page.get("imageinfo")
        if not infos:
            continue
        info = infos[0]
        meta = info.get("extmetadata", {})
        result[name] = {
            "thumburl": info.get("thumburl"),
            "author": strip_tags(meta.get("Artist", {}).get("value")),
            "license": strip_tags(meta.get("LicenseShortName", {}).get("value")),
            "licenseUrl": strip_tags(meta.get("LicenseUrl", {}).get("value")),
        }
    time.sleep(PAUSE_SECONDS)
    return result


def encode_image(raw_bytes):
    # Returns JPEG bytes at most TARGET_WIDTH wide. Without pillow the original bytes are passed through.
    if not HAVE_PIL:
        return raw_bytes
    image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    width, height = image.size
    if width > TARGET_WIDTH:
        image = image.resize((TARGET_WIDTH, int(height * TARGET_WIDTH / width)), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True)
    return buffer.getvalue()


def summary_thumbnail(slug):
    # Wikipedia REST summary for one article; returns the lead image thumbnail URL or None. Cached.
    cache_path = os.path.join(CACHE_DIR, "summary_" + hashlib.sha1(slug.encode("utf-8")).hexdigest() + ".json")
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as cached:
            return json.load(cached).get("thumbnail")
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(urllib.parse.unquote(slug), safe="")
    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    except requests.RequestException:
        return None
    time.sleep(PAUSE_SECONDS)
    thumb = None
    if response.status_code == 200:
        body = response.json()
        if body.get("thumbnail"):
            thumb = body["thumbnail"].get("source")
    with open(cache_path, "w", encoding="utf-8") as cached:
        json.dump({"thumbnail": thumb}, cached)
    return thumb


def download(url):
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60)
    time.sleep(PAUSE_SECONDS)
    if response.status_code != 200:
        return None
    return response.content


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("events")
    parser.add_argument("--from", dest="year_from", type=int, default=1926)
    parser.add_argument("--out", default="images.json", help="manifest path")
    parser.add_argument("--img-dir", dest="img_dir", default="img", help="directory to write <sha1>.jpg files into")
    parser.add_argument("--slugs", default=None, help="JSON list of Wikipedia slugs to look up directly (thumbnail via the REST summary endpoint)")
    arguments = parser.parse_args()

    if not HAVE_PIL:
        print("pillow not installed — images will be packed at original size (larger file). pip install pillow", file=sys.stderr)
    if not os.path.isdir(CACHE_DIR):
        os.makedirs(CACHE_DIR)
    if not os.path.isdir(arguments.img_dir):
        os.makedirs(arguments.img_dir)

    with open(arguments.events, "r", encoding="utf-8") as events_file:
        rows = json.load(events_file)

    # slug -> filename, for rows in range with a Commons thumbnail (index 10 in the current data)
    wanted = {}
    for row in rows:
        if row[4] < arguments.year_from:
            continue
        thumb = row[10] if len(row) > 10 else None
        if len(row) > 13 and isinstance(row[13], str):
            thumb = row[13]
        if not isinstance(thumb, str) or "/wikipedia/commons/" not in thumb:
            continue
        slug = row[9]
        if slug and slug not in wanted:
            wanted[slug] = filename_from_thumb_url(thumb)

    if arguments.slugs:
        with open(arguments.slugs, "r", encoding="utf-8") as slug_file:
            extra_slugs = json.load(slug_file)
        looked_up = 0
        for slug in extra_slugs:
            if slug in wanted:
                continue
            thumb = summary_thumbnail(slug)
            looked_up += 1
            if isinstance(thumb, str) and "/wikipedia/commons/" in thumb:
                wanted[slug] = filename_from_thumb_url(thumb)
        print("looked up " + str(looked_up) + " extra slugs", file=sys.stderr)

    print("events in range with a Commons image: " + str(len(wanted)), file=sys.stderr)

    output = {}
    if os.path.exists(arguments.out):
        with open(arguments.out, "r", encoding="utf-8") as existing:
            output = json.load(existing)

    slugs = list(wanted.keys())
    pending = [slug for slug in slugs if slug not in output]
    rejected_license = 0
    failed = 0

    for start in range(0, len(pending), 50):
        batch_slugs = pending[start:start + 50]
        batch_files = [wanted[slug] for slug in batch_slugs]
        try:
            info_by_name = lookup_batch(batch_files)
        except requests.RequestException as error:
            print("  batch lookup failed: " + str(error), file=sys.stderr)
            failed += len(batch_slugs)
            continue
        for slug in batch_slugs:
            name = wanted[slug]
            info = info_by_name.get(name)
            if info is None:
                # Commons normalises underscores/first letter; try a loose match
                for candidate in info_by_name:
                    if candidate.replace(" ", "_").lower() == name.replace(" ", "_").lower():
                        info = info_by_name[candidate]
                        break
            if info is None or not info.get("thumburl"):
                failed += 1
                continue
            if not ALLOWED_LICENSE.search(info["license"] or ""):
                rejected_license += 1
                continue
            cache_path = os.path.join(CACHE_DIR, hashlib.sha1(name.encode("utf-8")).hexdigest() + ".bin")
            if os.path.exists(cache_path):
                with open(cache_path, "rb") as cached:
                    raw = cached.read()
            else:
                raw = download(info["thumburl"])
                if raw is None:
                    failed += 1
                    continue
                with open(cache_path, "wb") as cached:
                    cached.write(raw)
            file_name = hashlib.sha1(name.encode("utf-8")).hexdigest()[:16] + ".jpg"
            file_path = os.path.join(arguments.img_dir, file_name)
            if not os.path.exists(file_path):
                try:
                    jpeg_bytes = encode_image(raw)
                except Exception as error:
                    print("  could not encode " + name + ": " + str(error), file=sys.stderr)
                    failed += 1
                    continue
                with open(file_path, "wb") as image_file:
                    image_file.write(jpeg_bytes)
            output[slug] = {
                "file": file_name,
                "author": info["author"][:120],
                "license": info["license"],
                "licenseUrl": info["licenseUrl"],
                "source": name,
                "filePage": "https://commons.wikimedia.org/wiki/File:" + urllib.parse.quote(name.replace(" ", "_")),
            }
        with open(arguments.out, "w", encoding="utf-8") as out_file:
            json.dump(output, out_file)
        print(str(min(start + 50, len(pending))) + "/" + str(len(pending)) + " processed — kept " + str(len(output)) + ", licence rejected " + str(rejected_license) + ", failed " + str(failed), file=sys.stderr)

    total_bytes = 0
    for slug in output:
        path = os.path.join(arguments.img_dir, output[slug]["file"])
        if os.path.exists(path):
            total_bytes += os.path.getsize(path)
    print("done: " + str(len(output)) + " images, " + str(round(total_bytes / 1024 / 1024, 1)) + " MB in " + arguments.img_dir + ", manifest " + arguments.out, file=sys.stderr)


if __name__ == "__main__":
    main()
