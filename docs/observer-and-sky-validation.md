# Observer and sky validation

The observer moves within 140 Earth radii of Earth's center. Scene units are mean Earth radii (6,371 km); the Earth-fixed axes are X toward Greenwich at the equator, Y toward the north pole, and Z toward 90°W at the equator. Orbiting moves the camera. Free movement stores its position independently of viewing direction.

## Calculations

The clock supplies one UTC Date to the sky. Unsupported or absent dates show an unavailable sky; no modern fallback date is substituted. The modeled range is 1900–2100, while the application's clock limits exploration to the present.

The star field contains 5,044 actual catalog stars from [d3-celestial](https://raw.githubusercontent.com/ofrohn/d3-celestial/7e720a3de062059d4c5400a379146a601d9010e0/data/stars.6.json). Catalog points and labels undergo the same J2000-to-equator-of-date precession/nutation and Greenwich apparent sidereal rotation. The sky remains centered on the observer, so translation introduces no false stellar parallax. The source commit, SHA256 and BSD license are retained in `site/assets/stars-catalog-source.json` and `stars-catalog-LICENSE.txt`.

[Astronomy Engine](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md) supplies simultaneous geometric positions: `BaryState(body) − BaryState(Earth)`. Each position is transformed into the Earth-fixed frame, and the physical observer position is subtracted before the direction is rendered. The Moon keeps its physical distance/radius. The Sun uses a nearer render position while preserving angular size. Planet points are enlarged visibility symbols. Earth depth and ray tests provide occlusion.

This is a geometric educational view. It omits light-time, aberration, atmospheric refraction and stellar proper motion. Earth is spherical and brightness is adapted for screens. It does not model interstellar travel or claim telescope-grade apparent sky accuracy.

## Numerical checks

Run from the repository root:

```sh
node tests/observer.test.cjs
node tests/jpl-reference.test.cjs
```

The observer tests cover axis signs and inverse rotations; Greenwich observer transformations at historical and modern dates; physical Sun/Moon distance bounds; Earth occlusion; surface facing; analytical momentum at 30, 60 and 120 fps; date limits; and invariant star directions under observer translation.

Independent reference values come from archived [JPL Horizons DE441 vector tables](https://github.com/cosinekitty/astronomy/tree/865d3da7d8112bbc7911238052c6af4aaf877181/generate/barystate). Their source URLs, checksums, coordinate frame, barycentric center and TDB epochs are retained with the fixtures under `tests/references/`. The comparison uses geometric ICRF values. TDB is approximated by TT, a periodic difference below 2 ms.

At four observer positions (Earth's center, near orbit, and two distant positions), 24,844 comparisons passed a one-arcminute geometric-direction tolerance:

| Body | Epochs | Observer comparisons | Maximum direction error |
| --- | ---: | ---: | ---: |
| Moon | 365 | 1,460 | 5.635 arcseconds |
| Venus | 2,923 | 11,692 | 19.904 arcseconds |
| Sun | 2,923 | 11,692 | 2.423 arcseconds |

Moon and Venus use exact shared epochs with independent Earth positions from 1980–2019. Solar reference samples use cubic Hermite interpolation with JPL velocities to the exact Earth epochs. A separate 40-day withheld-point interpolation check measured 4.809 km maximum error, under 0.007 arcseconds at 1 AU. Detailed samples and methodology are in `tests/jpl-comparison-results.json`.

These are sampled geometric-direction checks, not certification of every date, viewing location, apparent sky, or stellar motion. All 493 named-star labels are within 25.004 arcseconds of a corresponding magnitude-6 catalog point; both pass through the same frame transform.

## Interaction review

The integrated application was checked in a browser: independent X/Y/Z movement, turning the view without moving the observer, forward/reverse playback updating the sky with the visible clock, pause, and Return to Earth. The return view restored 22°N 18°E at 18,476 km altitude. Pinch handling is implemented but still needs a physical touch-device check.

Card positions remain geographically anchored. Their collision and picking rectangles use their actual camera-space depth, including stack height, so oblique free views retain appropriate hitboxes.
