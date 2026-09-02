"""
Bake a photographic-looking sky as an equirectangular texture in equatorial coordinates.

  python3 pipeline/bake_sky.py            -> site/assets/sky.jpg (4096 x 2048)

x runs right ascension -180..+180 degrees (left to right), y runs declination +90 (top) to -90 (bottom),
so the file drops straight onto a sphere with the same mapping the Earth texture uses.

What is real: every star to magnitude 6 (Yale Bright Star Catalog via d3-celestial) at its catalog
position, sized by brightness and tinted by its B-V colour; the Milky Way from d3-celestial's five
brightness contours, filled and blurred. What is not: a faint random dusting of stars below magnitude 6
to give the black between real stars some grain. It never competes with a real star.

Needs: pip install pillow   and   pipeline/skybake_in.json + pipeline/mw_mask.pgm (see pipeline/mw_mask.js)
"""

import json
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

W, H = 4096, 2048
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "skybake_in.json")
OUT = os.path.join(HERE, "..", "site", "assets", "sky.jpg")


def to_xy(ra_deg, dec_deg):
    x = (ra_deg + 180.0) / 360.0 * W
    y = (90.0 - dec_deg) / 180.0 * H
    return x, y


def bv_to_rgb(bv):
    # blue-white for hot stars (B-V < 0), white near 0.6, orange-red beyond 1.4
    bv = max(-0.4, min(2.0, bv))
    if bv < 0.0:
        return (170 + int(60 * (bv + 0.4) / 0.4), 190 + int(45 * (bv + 0.4) / 0.4), 255)
    if bv < 0.6:
        t = bv / 0.6
        return (230 + int(25 * t), 235 + int(15 * t), 255 - int(35 * t))
    if bv < 1.4:
        t = (bv - 0.6) / 0.8
        return (255, 250 - int(60 * t), 220 - int(110 * t))
    t = (bv - 1.4) / 0.6
    return (255, 190 - int(60 * t), 110 - int(50 * t))


def main():
    data = json.load(open(SRC))
    img = Image.new("RGB", (W, H), (2, 3, 8))

    # --- Milky Way: fill each contour level, brighter inward, then blur into a soft band ---
    # Milky Way brightness mask, rasterised on the sphere by pipeline/mw_mask.js (d3-geo handles the RA seam and poles);
    # upscaled and blurred here into a soft band.
    from PIL import ImageChops
    mw = Image.open(os.path.join(HERE, "mw_mask.pgm")).convert("L").resize((W, H), Image.BILINEAR)
    mw = mw.filter(ImageFilter.GaussianBlur(radius=26))
    tint = Image.new("RGB", (W, H), (150, 165, 205))
    img = Image.composite(tint, img, mw.point(lambda v: min(255, int(v * 1.15))))
    warm = Image.new("RGB", (W, H), (205, 180, 150))
    core = mw.point(lambda v: max(0, v - 90) * 2)
    img = Image.composite(warm, img, core.filter(ImageFilter.GaussianBlur(radius=40)))

    # --- faint background grain: random dim stars, never brighter than a real magnitude-6 star ---
    random.seed(7)
    grain = ImageDraw.Draw(img)
    for _ in range(38000):
        x = random.random() * W
        dec = math.degrees(math.asin(random.random() * 2 - 1))
        y = (90.0 - dec) / 180.0 * H
        v = random.randint(22, 70)
        grain.point((x, y), fill=(v, v, v + 8))

    # --- real stars: gaussian blobs sized by magnitude, coloured by B-V; bright ones get a glow ---
    glow = Image.new("RGB", (W, H), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    core_layer = Image.new("RGB", (W, H), (0, 0, 0))
    cd = ImageDraw.Draw(core_layer)
    for ra, dec, mag, bv in data["stars"]:
        x, y = to_xy(ra, dec)
        r = max(0.55, 2.7 - mag * 0.38)
        col = bv_to_rgb(bv)
        if mag < 2.0:
            gr = r * 2.6
            gd.ellipse((x - gr, y - gr, x + gr, y + gr), fill=tuple(int(c * 0.35) for c in col))
        cd.ellipse((x - r, y - r, x + r, y + r), fill=col)
        # the texture wraps horizontally: repeat anything near the seam on the other side
        if x < 40 or x > W - 40:
            x2 = x + W if x < 40 else x - W
            cd.ellipse((x2 - r, y - r, x2 + r, y + r), fill=col)
    glow = glow.filter(ImageFilter.GaussianBlur(radius=5))
    core_layer = core_layer.filter(ImageFilter.GaussianBlur(radius=0.8))
    from PIL import ImageChops
    img = ImageChops.add(img, glow)
    img = ImageChops.add(img, core_layer)

    img.save(OUT, "JPEG", quality=86, optimize=True, progressive=True)
    print("wrote " + OUT + " " + str(os.path.getsize(OUT) // 1024) + " KB")


if __name__ == "__main__":
    main()
