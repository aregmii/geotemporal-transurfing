"""
Geotemporal Transfusing — fetch a higher-resolution Earth for site/assets/earth.jpg.

Run:   python3 fetch_earth.py            (writes ../site/assets/earth.jpg at 5400x2700)
       python3 fetch_earth.py --width 4096 --quality 80
Needs: pip install requests pillow

The globe ships with a 2048x1024 Blue Marble, which is 20 km per texel: fine with the whole Earth in frame,
mush once you zoom past about 1.6 Earth radii, which is why the app caps the zoom there. This downloads NASA's
Blue Marble Next Generation with topography and bathymetry at 5400x2700 (8 km per texel) so the app can let you
come much closer — app.js reads the image width and raises its own zoom limit, so no code change is needed.

Source and resolutions: https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/
NASA's images are generally free to use with credit; the terms are at https://www.nasa.gov/nasa-brand-center/images-and-media/
The site credits "Earth: NASA Blue Marble" in its about panel.

The download is cached in earth_cache/, so a second run costs nothing.
"""

import argparse
import os
import sys

import requests
from PIL import Image

# December 2004, the month the site's existing texture came from, so coastlines and ice match what is already there.
SOURCE_URL = ("https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/"
              "bmng-topography-bathymetry/december/world.topo.bathy.200412.3x5400x2700.jpg")
CACHE_DIR = "earth_cache"
USER_AGENT = "GeotemporalTransfusing/0.6 (https://github.com/aregmii/geotemporal-transfusing) requests"


def download(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 100000:
        print("cached: " + path, file=sys.stderr)
        return
    print("downloading " + url, file=sys.stderr)
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=300, stream=True)
    response.raise_for_status()
    total = 0
    with open(path, "wb") as handle:
        for chunk in response.iter_content(chunk_size=1 << 20):
            handle.write(chunk)
            total += len(chunk)
            print("  " + str(total // 1048576) + " MB", end="\r", file=sys.stderr)
    print("\n  " + str(total // 1048576) + " MB written", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="../site/assets/earth.jpg")
    parser.add_argument("--width", type=int, default=5400, help="resize to this width; 0 keeps the original")
    parser.add_argument("--quality", type=int, default=86)
    parser.add_argument("--url", default=SOURCE_URL)
    arguments = parser.parse_args()

    os.makedirs(CACHE_DIR, exist_ok=True)
    raw_path = os.path.join(CACHE_DIR, os.path.basename(arguments.url))
    download(arguments.url, raw_path)

    image = Image.open(raw_path).convert("RGB")
    original_size = image.size
    if arguments.width and arguments.width < image.size[0]:
        height = round(image.size[1] * arguments.width / image.size[0])
        image = image.resize((arguments.width, height), Image.LANCZOS)

    output_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), arguments.out))
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    image.save(output_path, "JPEG", quality=arguments.quality, optimize=True, progressive=True)
    written_megabytes = os.path.getsize(output_path) / 1048576
    kilometres_per_texel = 40075 / image.size[0]
    print("source " + str(original_size[0]) + "x" + str(original_size[1])
          + " -> wrote " + str(image.size[0]) + "x" + str(image.size[1])
          + " (" + format(written_megabytes, ".1f") + " MB, "
          + format(kilometres_per_texel, ".1f") + " km per texel) to " + output_path, file=sys.stderr)


if __name__ == "__main__":
    main()
