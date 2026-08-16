# MN Fair Foodie Finder

A community-focused, photo-forward web app for the Minnesota State Fair, built from the
*State Fair Food App V2* PRD. Find, rate (1–5 pups!), review, list, and map all 3,777 foods
across 277 stands — real 2026 data and photography. Design system: see `DESIGN.md`.

Live: https://tnherby-glitch.github.io/fair-foodie/

## Run it

No build step, no dependencies. Any static file server works:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 8787
# then open http://localhost:8787
```

(Or open `index.html` from any web server / hosting. All data persists in `localStorage`.)

Best viewed at mobile width — it's designed as a phone app (installable-style UI, bottom tab bar).

## Demo personas

The onboarding screen lets you create a real profile **or** jump in as:
- 🌟 **Allison** — the headline influencer; her real 50-item ranked 2026 list is the pinned default for every user
- 📝 **Ole's Eats** — food blogger (Blogger badge, long-form reviews)
- 🎡 **Fair Admin** — administrator (moderation, sponsorship control, push notifications)

(Maddy Munchies, Curd Nerd, and Sky Glider Sam are also switchable from Profile → Demo controls.)

Switch personas anytime from **Profile → Demo controls**, and reset all demo data there too.

## PRD coverage

**Attendee** — email/OAuth-style signup, profile photo upload (5MB JPEG/PNG limit), search with
autocomplete (after 3 chars), filters (New This Year, category, dietary, price, min rating),
1–5 Pronto Pup ratings, reviews (10–500 chars) with up to 3 photos, comments, helpful votes,
reporting, unlimited lists with privacy (private/friends/public), share links, duplication,
collaborators, and push-style notifications.

**Map** — interactive SVG fairgrounds with all vendor pins, tap-for-menu popups, amenity toggles
(restrooms/ATMs/first aid), wait-time estimates, and **optimal route generation**: pick any list and
get numbered stops with an estimated walking time from the Main Gate (nearest-neighbor routing).

**Influencer** — verified badge, featured-list submission, home-page featured carousel with
views/likes, follower notifications, engagement analytics, social share.

**Vendors (2026 scope)** — vendor stands are catalog data only (names, locations, photos, hours, deals). Vendor self-service accounts were removed to keep the app community-focused and administratively light.

**Photos** — each food's main image resolves in order: official photo (set by an admin via "Official photo" / "Add photo") → latest guest review photo → category placeholder.
Guest photos always collect in the food's "Photos from foodies" gallery.

**Admin** — moderation queue (remove/warn/dismiss), user management (ban/verify), sponsored/
featured list control with a pinned default, analytics dashboard (DAU, top searches, most
reviewed), segmented push notifications, JSON data export.

**Blogger/social** — follow/unfollow, activity feed (Following/Everyone), Blogger badge at 25
reviews, trending foods, daily challenge on home.

**Accessibility** — semantic landmarks, ARIA labels/roles on ratings, pins, filters and dialogs,
keyboard-operable map pins, visible focus rings, reduced-motion support.

## Files

- `index.html` — app shell (topbar, 4-tab bar, toast/modal roots)
- `css/styles.css` — Foodie Finder brand system (see `DESIGN.md`)
- `js/catalog.js` — **generated** food/vendor/geo catalog (`tools/build-catalog.ps1`); don't hand-edit
- `js/data.js` — user-state persistence (localStorage) + demo seed content
- `js/ui.js` — shared components (toasts, modals, pup ratings, photos)
- `js/views.js` — onboarding, explore, search, food detail, reviews, lists
- `js/views2.js` — map & routing, feed, notifications, profiles, admin console
- `js/app.js` — hash router
- `photos/`, `assets/` — real fair photography and the Pin-Pup logo suite
- `serve.ps1` — zero-dependency PowerShell static server

## Notes / next steps

This is a fully client-side demo: "push" notifications are simulated in-app, and data lives in
`localStorage` (which also gives you the PRD's offline mode for free). Production path per the PRD's
tech-stack section: keep this front end as a PWA, add a backend (auth via real OAuth 2.0, Postgres +
object storage for photos, search index), swap the SVG map for a geo-referenced fairgrounds map, and
wire real push via FCM/APNs.
