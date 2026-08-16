# MN Fair Foodie Finder — Design Direction

Drop this file into the repo (suggest saving as `DESIGN.md`) and reference it in your CLAUDE.md so Claude Code applies it on every screen.

## Brand in one paragraph

Foodie Finder helps Minnesota State Fair attendees find, rate, and share the best food at the Great American Get-Together. The visual language is Airbnb's discipline with fair-food warmth: a white, photo-forward canvas where big food imagery does the talking, punctuated by batter gold, ketchup red, and a blue-ribbon badge that only the best foods earn. Ratings are given in prontopups, 1 to 5.

## Logo

The mark is the "Pin-Pup": a prontopup whose stick tapers into a map-pin point, so one silhouette reads as both fair food and find-it. The drizzle traces a subtle M for Minnesota, rotated 4 degrees so it reads as poured sauce. Files provided: primary mark, horizontal lockup, app icon (SVG). Clearspace equals half the body width; minimum height 24px; use the cream-on-dark variant over photos with a scrim, never the color mark on busy imagery.

## Design tokens

```css
:root {
  /* Color */
  --gold: #E89C31;        /* primary actions, rating fills */
  --gold-deep: #C97F1B;   /* pressed states, gradient end */
  --gold-soft: #F6C778;   /* highlights, subtle fills */
  --ketchup: #D64533;     /* accents, notification dots, destructive */
  --ribbon: #2B4C9B;      /* Blue Ribbon badge ONLY */
  --ink: #211A16;         /* primary text, warm near-black */
  --ink-60: #6E655C;      /* secondary text */
  --ink-30: #B9B0A5;      /* disabled, placeholders */
  --cream: #FFF7EC;       /* soft section backgrounds */
  --paper: #FFFFFF;       /* canvas and cards */
  --line: #EFE8DD;        /* hairline borders */

  /* Shape */
  --r-card: 20px;
  --r-input: 14px;
  --r-pill: 999px;

  /* Elevation */
  --shadow: 0 1px 2px rgba(33,26,22,.06), 0 8px 24px rgba(33,26,22,.08);
  --shadow-lift: 0 2px 4px rgba(33,26,22,.08), 0 16px 40px rgba(33,26,22,.14);

  /* Spacing scale (px): 4, 8, 12, 16, 24, 32, 48, 64 */
}
```

## Typography

- Display and headings: Bricolage Grotesque (Google Fonts), weights 600 and 800, tight letter-spacing (-0.01 to -0.02em) on sizes above 28px.
- Body and UI: Plus Jakarta Sans, weights 400 to 800. All buttons, labels, and captions.
- Scale: 12.5 caption / 14.5 secondary / 16 body / 18 card title / 22 section / 30 screen title / 40+ display.
- Captions and eyebrows: Jakarta 600, uppercase, 0.06em tracking, ink-60.

## Layout (the Airbnb rules)

1. White canvas, roughly 80% of every screen. Color lives in photos, the gold CTA, and rating rows.
2. Big photo tiles: full-bleed images at 20px radius, no borders on photo cards, one soft shadow at rest.
3. One column of large cards on mobile; 2 to 3 columns on tablet and up. 24px gutters, 16 to 24px screen margins.
4. Sticky bottom nav on mobile with 4 tabs: Explore, Map, My Lists, Profile. Search lives in a pill at the top of Explore.
5. Horizontal filter chips under search (pill radius, ink fill when active).
6. Sections are separated by whitespace, not lines. Hairlines appear only on utility surfaces (settings, forms).

## Signature components

### Prontopup rating (the one thing people remember)
- Five miniature pup glyphs (simplified mark: capsule + stick, no drizzle). Filled = gold body, brown stick; empty = warm gray outline.
- Display mode: 16px tall, score in bold tabular figures, count in ink-60, e.g. 4.7 (1.8k).
- Input mode: 32px tall tap targets (44px hit area), single spring animation (~1.1x, 180ms) on tap.
- Copy always says "pups": "Rate it in pups", "4.7 pups".

### Blue Ribbon badge
- Ribbon-blue pill, white 700-weight text, awarded only to foods rated 4.8+ with 100+ ratings. Never use ribbon blue anywhere else; scarcity is the point.

### Food card
- Photo (16:10, full bleed) with optional Blue Ribbon badge top-left, then name (700), vendor + location (ink-60), rating row. Whole card is tappable; hover/press lifts 4px with --shadow-lift.

### Buttons
- Primary: gold fill, ink text, pill, soft gold shadow. One per screen.
- Secondary: white with 1.5px ink border, pill.
- Ghost: hairline border, ink-60 text. Verbs on every button: "Add to my list", "Share list", "Save".

## Motion

- 200 to 250ms ease-out on card lift and screen transitions.
- One spring on rating taps. Skeleton shimmer (cream to line) while photos load.
- Nothing loops, nothing bounces twice. Respect prefers-reduced-motion.

## Voice

- Warm, plain, midwestern. "Add to my list", not "Curate". "New for 2026", not "Just dropped".
- Empty states invite action: "Your list is empty. Go find something on a stick."
- Errors say what happened and what to do next; they never apologize.

## Don'ts

- No coral or pink (too close to Airbnb). Ketchup red is the only warm accent.
- No gold text on white body copy (fails contrast); gold is for fills and glyphs.
- No decorative use of ribbon blue, no star icons anywhere (stars compete with pups).
- No heavy borders, no gradients on content surfaces (gradient is reserved for the app icon and splash).

## Accessibility floor

- Text contrast AA minimum: ink on paper, white on ribbon, ink on gold (large text and buttons only).
- 44px minimum tap targets, visible keyboard focus (2px ink outline, 2px offset), alt text on food photos, rating control operable without drag.
