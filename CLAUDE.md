# MN Fair Foodie Finder

A photo-forward web app for finding, rating, and sharing Minnesota State Fair food.
Static site (no build step): `index.html` + `css/` + `js/`, deployed to GitHub Pages
by pushing `main` and mirroring it to `gh-pages`.

## Design

**Follow `DESIGN.md` for every visual decision** — colors, type, radii, shadows,
components, motion, and voice. Key invariants:

- Ratings are **prontopups** (1–5 "pups"), never stars. The pup glyph is a
  capsule + stick (no drizzle) — see `pupSvg()` in `js/ui.js`.
- **Blue Ribbon** (#2B4C9B) appears ONLY on foods rated 4.8+ with 100+ ratings.
- No pink/coral, no gold body text on white, no decorative ribbon blue.
- Fonts: Bricolage Grotesque (display) + Plus Jakarta Sans (UI), via Google Fonts.
- Logo suite lives in `assets/` (Pin-Pup mark, lockup, app icon).

## Data

- `js/catalog.js` is **generated** from the fair's database export by
  `tools/build-catalog.ps1` — never hand-edit it. 3,777 foods / 277 vendors /
  real photos under `photos/`.
- `js/data.js` holds user-state persistence (localStorage) and demo seed content.
  Bump `DATA_VERSION` whenever the seed changes so visitors reseed.
- Vendor pins use real lat/long; the map projects them and routes along
  data-derived street lines.

## Deploy

```
git push origin main
git push -f origin main:gh-pages
```

Live at https://tnherby-glitch.github.io/fair-foodie/ (CDN caches ~10 min).
