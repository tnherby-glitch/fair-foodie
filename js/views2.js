/* Views: map, feed, notifications, profile, vendor dashboard, admin console */
/* global S, save, uid, me, getUser, getFood, getVendor, getList, getReview, foodReviews, foodRating, listCountForFood, trendingFoods, notify, myNotifications, logActivity, esc, timeAgo, toast, pushToast, openModal, closeModal, pups, ratingLine, avatarHtml, userName, foodPills, foodCardHtml, updateBell, updateAvatarBtn, readImage, render, resetState, avatarInline */

/* ================= MAP (real lat/long projection + street routing) =================
   Every vendor carries real coordinates from the official database; street lines
   are derived from those coordinates (CATALOG.geo). The SVG is a straight
   equirectangular projection of the actual fairgrounds. */
const mapState = { listId: '', vendorSel: '', amen: { restroom: true, atm: false, firstaid: false } };

const GEO = CATALOG.geo;
const MAPW = 760, MAPH = 900;          // portrait: the grounds are taller N-S than wide E-W
const MX = 66, MY = 84;                // margins for parking/labels
const LATSPAN = GEO.maxLat - GEO.minLat;
const LONSPAN = GEO.maxLon - GEO.minLon;
function gx(lon) { return MX + (lon - GEO.minLon) / LONSPAN * (MAPW - 2 * MX); }
function gy(lat) { return MY + (GEO.maxLat - lat) / LATSPAN * (MAPH - 2 * MY); }

const STREETS = {
  vert:  GEO.streets.map(s => ({ x: Math.round(gx(s.lon)), name: s.name })),
  horiz: GEO.avenues.map(a => ({ y: Math.round(gy(a.lat)), name: a.name })),
};
const XS = STREETS.vert.map(s => s.x);
const YS = STREETS.horiz.map(s => s.y);

const _dp = STREETS.horiz.find(s => /Dan Patch/.test(s.name));
const ENTRANCE = { x: MX, y: _dp ? _dp.y : Math.round(MAPH / 2) };  // Main Gate: Snelling at Dan Patch
const MPP = (LATSPAN * 111320) / (MAPH - 2 * MY);                    // meters per pixel from real span
const WALK = 74;                                                     // meters/minute, fair-crowd pace

/* labeled zones (text only — pins carry the detail at this density) */
function zoneLabels() {
  const sx = n => { const s = STREETS.vert.find(t => t.name.indexOf(n) === 0); return s ? s.x : null; };
  const sy = n => { const s = STREETS.horiz.find(t => t.name.indexOf(n) === 0); return s ? s.y : null; };
  const mid = (a, b) => (a + b) / 2;
  const out = [];
  const und = sx('Underwood'), coop = sx('Cooper'), lig = sx('Liggett'), cham = sx('Chambers'), nel = sx('Nelson');
  const dan = sy('Dan Patch'), car = sy('Carnes'), jud = sy('Judson'), ran = sy('Randall'), wri = sy('Wright'), mur = sy('Murphy');
  if (und && dan && car) out.push({ x: und + 30, y: mid(dan, car), t: 'Food Building' });
  if (coop && jud) out.push({ x: coop + 6, y: jud + 34, t: 'Int’l Bazaar' });
  if (lig && cham && dan && car) out.push({ x: mid(lig, cham) - 30, y: mid(dan, car), t: 'Grandstand' });
  if (lig && car && jud) out.push({ x: lig - 34, y: mid(car, jud), t: 'West End' });
  if (cham && ran && wri) out.push({ x: cham - 20, y: mid(ran, wri), t: 'Mighty Midway' });
  if (und && mur) out.push({ x: und + 20, y: mur - 26, t: 'North End' });
  if (nel && jud) out.push({ x: nel, y: jud + 40, t: 'Livestock / Coliseum' });
  return out;
}

/* grounds outline + surrounding parking, scaled to the projected viewBox */
const GROUNDS = [
  [MX - 20, MY - 16], [MAPW - MX + 20, MY - 16], [MAPW - MX + 20, MAPH * 0.42],
  [MAPW - MX + 44, MAPH * 0.45], [MAPW - MX + 44, MAPH * 0.72], [MAPW - MX + 20, MAPH * 0.75],
  [MAPW - MX + 20, MAPH - MY + 18], [MAPW * 0.38, MAPH - MY + 18], [MAPW * 0.22, MAPH - MY + 44],
  [MX - 20, MAPH - MY + 6], [MX - 20, MY - 16],
].map(p => Math.round(p[0]) + ',' + Math.round(p[1])).join(' ');
const PARKING = [
  { name: 'North Purple Lot', x: MX, y: 10, w: (MAPW - 2 * MX) / 2 - 10, h: 42, fill: '#e8e2f0', tc: '#6a5a8c' },
  { name: 'North Yellow Lot', x: MAPW / 2 + 10, y: 10, w: (MAPW - 2 * MX) / 2 - 10, h: 42, fill: '#f2edcd', tc: '#8a7a26' },
  { name: 'West Blue Lot', x: 6, y: MAPH * 0.22, w: 36, h: MAPH * 0.3, fill: '#dfe8f3', tc: '#456a8c', rot: true },
  { name: 'Transit Hub', x: 6, y: MAPH * 0.62, w: 36, h: MAPH * 0.2, fill: '#e2ecf2', tc: '#456a8c', rot: true },
  { name: 'South Red Lot', x: MAPW * 0.4, y: MAPH - 48, w: MAPW * 0.45, h: 40, fill: '#f3dede', tc: '#8c3838' },
  { name: 'Stella-Como Lot', x: MX, y: MAPH - 48, w: MAPW * 0.26, h: 40, fill: '#e9e6de', tc: '#79736a' },
  { name: 'East Lots', x: MAPW - 40, y: MAPH * 0.22, w: 34, h: MAPH * 0.3, fill: '#e7e6de', tc: '#69675c', rot: true },
];
const BOUNDS = [
  { name: 'LARPENTEUR AVE', x: MAPW / 2, y: 8, a: 'middle' },
  { name: 'COMO AVE', x: MAPW / 2, y: MAPH - 2, a: 'middle' },
  { name: 'SNELLING AVE', x: 12, y: MAPH * 0.12, rot: true },
  { name: 'COMMONWEALTH AVE', x: MAPW - 8, y: MAPH * 0.12, rot: true },
];

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

/* ---- walkable street graph (intersections + segments) ---- */
let _graph = null;
function graph() {
  if (_graph) return _graph;
  const nodes = {};
  const id = (x, y) => x + ',' + y;
  XS.forEach(x => YS.forEach(y => { nodes[id(x, y)] = { x, y, adj: [] }; }));
  const link = (ax, ay, bx, by) => {
    const w = Math.hypot(ax - bx, ay - by);
    nodes[id(ax, ay)].adj.push({ id: id(bx, by), w });
    nodes[id(bx, by)].adj.push({ id: id(ax, ay), w });
  };
  YS.forEach(y => { for (let i = 1; i < XS.length; i++) link(XS[i - 1], y, XS[i], y); });
  XS.forEach(x => { for (let i = 1; i < YS.length; i++) link(x, YS[i - 1], x, YS[i]); });
  _graph = { nodes: nodes, id: id };
  return _graph;
}
function snap(pt) {
  const g = graph();
  let best = null, bd = Infinity;
  for (const nid in g.nodes) {
    const d = Math.hypot(g.nodes[nid].x - pt.x, g.nodes[nid].y - pt.y);
    if (d < bd) { bd = d; best = nid; }
  }
  return best;
}
/* Dijkstra shortest path between node ids -> { dist, path:[ids] } */
function shortest(aId, bId) {
  const g = graph();
  const D = {}, prev = {}, done = {};
  for (const nid in g.nodes) D[nid] = Infinity;
  D[aId] = 0;
  for (;;) {
    let u = null, ud = Infinity;
    for (const nid in g.nodes) if (!done[nid] && D[nid] < ud) { ud = D[nid]; u = nid; }
    if (u === null || u === bId) break;
    done[u] = true;
    g.nodes[u].adj.forEach(e => { const nd = D[u] + e.w; if (nd < D[e.id]) { D[e.id] = nd; prev[e.id] = u; } });
  }
  const path = [];
  let cur = bId;
  while (cur !== undefined) { path.unshift(cur); if (cur === aId) break; cur = prev[cur]; }
  return { dist: D[bId], path: path };
}

/* vendor -> projected pixel point (null when the vendor has no coordinates) */
function vpt(v) {
  if (!v || v.lat == null || v.lon == null) return null;
  return { x: gx(v.lon), y: gy(v.lat) };
}

/* ---- route optimization: nearest-neighbour ordering over street distances ---- */
function routeFor(listId) {
  const l = getList(listId);
  if (!l) return null;
  const stops = [], seen = {};
  l.foodIds.forEach(fid => {
    const f = getFood(fid);
    if (f && !seen[f.vendorId]) {
      seen[f.vendorId] = true;
      const v = getVendor(f.vendorId);
      if (v && vpt(v)) stops.push(v);
    }
  });
  if (!stops.length) return null;
  const g = graph();
  const order = [], legs = [];
  const left = stops.slice();
  let curNode = snap(ENTRANCE), curPt = ENTRANCE, meters = 0;
  while (left.length) {
    let bi = 0, bd = Infinity, bpath = null;
    for (let i = 0; i < left.length; i++) {
      const r = shortest(curNode, snap(vpt(left[i])));
      if (r.dist < bd) { bd = r.dist; bi = i; bpath = r.path; }
    }
    const v = left.splice(bi, 1)[0];
    const p = vpt(v);
    const vNode = snap(p);
    const pts = bpath.map(nid => [g.nodes[nid].x, g.nodes[nid].y]);
    legs.push([[curPt.x, curPt.y]].concat(pts).concat([[p.x, p.y]]));
    meters += (bd + dist(g.nodes[vNode], p)) * MPP;
    order.push(v);
    curNode = vNode; curPt = p;
  }
  return { order: order, legs: legs, meters: meters };
}
function walkMinFromGate(v) {
  const p = vpt(v);
  if (!p) return null;
  const r = shortest(snap(ENTRANCE), snap(p));
  return Math.max(1, Math.round((r.dist + dist(graph().nodes[snap(p)], p)) * MPP / WALK));
}

function p_boundLabel(b) {
  if (b.rot) {
    return '<text x="' + b.x + '" y="' + b.y + '" transform="rotate(-90 ' + b.x + ' ' + b.y + ')" text-anchor="middle" font-size="9" letter-spacing="1" fill="#a29e94">' + b.name + '</text>';
  }
  return '<text x="' + b.x + '" y="' + b.y + '" text-anchor="' + (b.a || 'start') + '" font-size="9" letter-spacing="1" fill="#a29e94">' + b.name + '</text>';
}

function viewMap(el, params) {
  // Apply deep-link params ONCE, then strip them — otherwise Clear/deselect
  // gets overridden by the URL on the next render.
  if (params.get('vendor')) { mapState.vendorSel = params.get('vendor'); }
  if (params.get('list')) { mapState.listId = params.get('list'); }
  if (params.get('vendor') || params.get('list')) {
    history.replaceState(null, '', location.href.split('#')[0] + '#/map');
  }
  const u = me();
  const myLists = S.lists.filter(l => l.ownerId === u.id || l.collaborators.includes(u.id) || (l.privacy === 'public' && l.featured));
  const route = mapState.listId ? routeFor(mapState.listId) : null;
  const order = route ? route.order : [];
  const routeIds = order.map(v => v.id);
  const walkMin = route ? Math.max(1, Math.round(route.meters / WALK)) : 0;

  let svg = '<svg class="map-svg" viewBox="0 0 ' + MAPW + ' ' + MAPH + '" role="img" aria-label="Minnesota State Fairgrounds map projected from real vendor coordinates, with streets, zones, and surrounding parking lots for orientation.">' +
    '<defs><clipPath id="groundsClip"><polygon points="' + GROUNDS + '"/></clipPath></defs>' +
    '<rect width="' + MAPW + '" height="' + MAPH + '" fill="#e8e6df"/>';

  // parking lots + boundary avenues (drawn outside the grounds, for reference)
  PARKING.forEach(p => {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    svg += '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" rx="4" fill="' + p.fill + '" stroke="rgba(0,0,0,.06)"/>' +
      (p.rot
        ? '<text x="' + cx + '" y="' + cy + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" text-anchor="middle" font-size="9.5" fill="' + p.tc + '">' + p.name + '</text>'
        : '<text x="' + cx + '" y="' + (cy + 3) + '" text-anchor="middle" font-size="10" fill="' + p.tc + '">' + p.name + '</text>');
  });
  BOUNDS.forEach(b => {
    svg += p_boundLabel(b);
  });

  // grounds outline (irregular shape)
  svg += '<polygon points="' + GROUNDS + '" fill="#f8f9f5" stroke="#d8d8ce" stroke-width="1.5"/>';

  // street grid + names (clipped to the grounds outline)
  svg += '<g clip-path="url(#groundsClip)">';
  STREETS.horiz.forEach(s => {
    svg += '<line x1="' + (MX - 20) + '" y1="' + s.y + '" x2="' + (MAPW - MX + 44) + '" y2="' + s.y + '" stroke="#fff" stroke-width="11"/>';
  });
  STREETS.vert.forEach(s => {
    svg += '<line x1="' + s.x + '" y1="' + (MY - 16) + '" x2="' + s.x + '" y2="' + (MAPH - MY + 18) + '" stroke="#fff" stroke-width="10"/>';
  });
  svg += '</g>';
  STREETS.horiz.forEach(s => {
    svg += '<text x="' + (MX - 14) + '" y="' + (s.y - 7) + '" font-size="10" fill="#aca699">' + s.name + '</text>';
  });
  STREETS.vert.forEach(s => {
    svg += '<text x="' + (s.x + 3) + '" y="' + (MY + 2) + '" font-size="8.5" fill="#b6b0a4" transform="rotate(-90 ' + (s.x + 3) + ' ' + (MY + 2) + ')" text-anchor="end">' + s.name + '</text>';
  });

  // labeled zones
  zoneLabels().forEach(z => {
    svg += '<text x="' + Math.round(z.x) + '" y="' + Math.round(z.y) + '" text-anchor="middle" font-size="10" font-style="italic" fill="#a09a8c">' + z.t + '</text>';
  });

  // Main Gate
  svg += '<circle cx="' + ENTRANCE.x + '" cy="' + ENTRANCE.y + '" r="7" fill="#222"/>' +
    '<text x="' + ENTRANCE.x + '" y="' + (ENTRANCE.y + 22) + '" text-anchor="middle" font-size="10" font-weight="bold" fill="#222">Main Gate</text>';

  // route — follows the streets
  if (route) {
    route.legs.forEach(leg => {
      svg += '<polyline points="' + leg.map(p => p[0] + ',' + p[1]).join(' ') +
        '" fill="none" stroke="#c8102e" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>';
    });
  }

  // amenities (stored as lat/long, projected here)
  S.amenities.forEach(a => {
    if (!mapState.amen[a.type]) return;
    a.spots.forEach(s => {
      const ax = s.lon != null ? gx(s.lon) : s.x, ay = s.lat != null ? gy(s.lat) : s.y;
      svg += '<text x="' + Math.round(ax) + '" y="' + Math.round(ay + 6) + '" text-anchor="middle" font-size="16" aria-label="' + a.label + '">' + a.icon + '</text>';
    });
  });

  // vendor pins at real coordinates (small at this density; route stops enlarge)
  S.vendors.forEach(v => {
    const p = vpt(v);
    if (!p) return;
    const onRoute = routeIds.indexOf(v.id);
    const sel = mapState.vendorSel === v.id;
    const color = sel ? '#222222' : (onRoute >= 0 ? '#c8102e' : '#b7b1a6');
    const r = sel || onRoute >= 0 ? 12 : 5;
    svg += '<g class="map-pin" role="button" tabindex="0" aria-label="' + esc(v.name) + '" onclick="mapPick(\'' + v.id + '\')" onkeydown="if(event.key===\'Enter\')mapPick(\'' + v.id + '\')">' +
      '<circle cx="' + Math.round(p.x) + '" cy="' + Math.round(p.y) + '" r="' + r + '" fill="' + color + '" stroke="#fff" stroke-width="' + (r > 6 ? 2.5 : 1.4) + '"/>' +
      (onRoute >= 0
        ? '<text x="' + Math.round(p.x) + '" y="' + Math.round(p.y + 4) + '" text-anchor="middle" font-size="11" fill="#fff" font-weight="bold">' + (onRoute + 1) + '</text>'
        : '') +
      '</g>';
  });
  svg += '</svg>';

  const selVendor = getVendor(mapState.vendorSel);
  el.innerHTML =
    '<h1 style="font-size:21px;font-weight:700;margin:4px 0 14px">Fairgrounds map</h1>' +
    '<div class="map-wrap">' + svg +
    '<div class="map-controls">' +
    '<div class="row" style="margin-bottom:8px">' +
    '<select class="grow" aria-label="Show a list route on the map" onchange="mapState.listId=this.value;render()">' +
    '<option value="">— Route a food list —</option>' +
    myLists.map(l => '<option value="' + l.id + '" ' + (mapState.listId === l.id ? 'selected' : '') + '>' + esc(l.name) + '</option>').join('') +
    '</select>' +
    (mapState.listId ? '<button class="btn small ghost" onclick="mapState.listId=\'\';render()">Clear</button>' : '') +
    '</div>' +
    (route ? '<div class="muted" style="margin-bottom:8px">Optimized route: <b>' + order.length + ' stop' + (order.length > 1 ? 's' : '') + '</b> · ~<b>' + Math.round(route.meters).toLocaleString() + ' m</b> · ~<b>' + walkMin + ' min</b> walking from the Main Gate along the streets</div>' :
      (mapState.listId ? '<div class="muted" style="margin-bottom:8px">That list has no mapped vendors yet.</div>' : '')) +
    '<div class="chip-row" style="margin:0">' +
    S.amenities.map(a => '<button class="chip ' + (mapState.amen[a.type] ? 'on' : '') + '" aria-pressed="' + mapState.amen[a.type] + '" onclick="mapState.amen.' + a.type + '=!mapState.amen.' + a.type + ';render()">' + a.icon + ' ' + a.label + '</button>').join('') +
    '</div></div></div>' +
    (selVendor ? vendorCardHtml(selVendor, routeIds.indexOf(selVendor.id)) : '<div class="muted" style="margin:10px 4px">Tap a pin for a vendor\'s menu. Pick a list above to plot the shortest walking route (red, numbered).</div>');
}
function mapPick(vid) {
  mapState.vendorSel = mapState.vendorSel === vid ? '' : vid;
  render();
}
function vendorCardHtml(v, routeIdx, opts) {
  opts = opts || {};
  /* menu sorted by community pup score — top-rated first, unrated last */
  const menu = S.foods.filter(f => f.vendorId === v.id);
  menu.sort((a, b) => {
    const ra = foodRating(a.id), rb = foodRating(b.id);
    return (rb.avg - ra.avg) || (rb.count - ra.count);
  });
  const shown = opts.full ? menu : menu.slice(0, 10);
  const anyRated = menu.some(f => foodRating(f.id).count);
  const walk = walkMinFromGate(v);
  return '<div class="card">' +
    (v.photo ? '<div class="photo" style="background-image:url(' + v.photo + ');margin-bottom:12px"></div>' : '') +
    '<div class="row between"><h2 style="font-size:16px;margin:0;font-weight:600">' +
    (opts.full ? esc(v.name) : '<a href="#/vendor/' + v.id + '" style="text-decoration:underline;text-underline-offset:3px">' + esc(v.name) + '</a>') + '</h2>' +
    (routeIdx >= 0 ? '<span class="pill new">Stop ' + (routeIdx + 1) + '</span>' : '') + '</div>' +
    '<div class="muted" style="margin:4px 0">' + esc(v.loc || '') + (v.hours ? ' · ' + esc(v.hours) : '') + '</div>' +
    (v.specials ? '<div class="vendor-reply">Today: ' + esc(v.specials) + '</div>' : '') +
    (v.offers ? '<div class="vendor-reply">Deals: ' + esc(v.offers.length > 140 && !opts.full ? v.offers.slice(0, 137) + '…' : v.offers) + '</div>' : '') +
    '<div class="muted" style="margin:8px 0 4px">Est. wait <b>' + waitEstimate(v) + ' min</b>' + (walk ? ' · <b>' + walk + ' min</b> walk from Main Gate' : '') + '</div>' +
    (opts.full ? '<div class="action-row" style="margin:10px 0 12px"><button class="btn small" onclick="location.hash=\'#/map?vendor=' + v.id + '\'">Show on map</button></div>' : '') +
    (anyRated ? '<div class="muted" style="margin:6px 0 2px;font-size:11.5px;letter-spacing:.04em;font-weight:700;text-transform:uppercase">Menu · top rated first</div>' : '') +
    shown.map(f => {
      const r = foodRating(f.id);
      return '<a class="row between" style="padding:8px 0;border-top:1px solid var(--line);color:inherit" href="#/food/' + f.id + '">' +
        '<span class="grow" style="min-width:0">' + f.emoji + ' ' + esc(f.name) +
        (blueRibbon(f.id) ? ' <span class="pill" style="background:var(--ribbon);color:#fff">Blue Ribbon</span>' : '') +
        (f.isNew ? ' <span class="pill new">New</span>' : '') +
        (f.soldOut ? ' <span class="pill soldout">SOLD OUT</span>' : '') +
        (f.price ? ' <span class="muted">· $' + f.price.toFixed(2).replace(/\.00$/, '') + '</span>' : '') + '</span>' +
        (r.count ? '<span style="flex-shrink:0">' + ratingCompact(f.id) + '</span>' : '') +
        '</a>';
    }).join('') +
    (menu.length > shown.length ? '<a class="muted" style="display:block;padding:8px 0 0;border-top:1px solid var(--line);text-decoration:underline;text-underline-offset:3px" href="#/vendor/' + v.id + '">See all ' + menu.length + ' items</a>' : '') +
    '</div>';
}

/* dedicated vendor page — one tap from any food detail */
function viewVendorPage(el, id) {
  const v = getVendor(id);
  if (!v) { el.innerHTML = '<div class="empty">Stand not found.</div>'; return; }
  el.innerHTML =
    '<h1 class="greet" style="margin:4px 0 14px">' + esc(v.name) + '</h1>' +
    vendorCardHtml(v, -1, { full: true });
}
function waitEstimate(v) {
  // deterministic pseudo-wait based on popularity
  const menu = S.foods.filter(f => f.vendorId === v.id);
  const reviews = menu.reduce((a, f) => a + foodReviews(f.id).length, 0);
  return 5 + reviews * 3;
}

/* ================= FEED / SOCIAL ================= */
let feedMode = 'following';
function viewFeed(el) {
  const u = me();
  const items = S.activity.filter(a =>
    a.userId !== u.id && (feedMode === 'everyone' || u.following.includes(a.userId)));
  const suggestions = S.users.filter(x => x.id !== u.id && !u.following.includes(x.id) && x.role !== 'admin' && x.role !== 'vendor').slice(0, 4);

  el.innerHTML =
    '<h1 style="font-size:21px;font-weight:700;margin:4px 0 14px">Community</h1>' +
    '<div class="chip-row">' +
    '<button class="chip ' + (feedMode === 'following' ? 'on' : '') + '" onclick="feedMode=\'following\';render()">Following</button>' +
    '<button class="chip ' + (feedMode === 'everyone' ? 'on' : '') + '" onclick="feedMode=\'everyone\';render()">Everyone</button>' +
    '</div>' +
    (suggestions.length ? '<div class="section-title"><span>Suggested foodies</span></div><div class="hlist">' +
      suggestions.map(x => '<div class="hcard" style="text-align:center;flex-basis:150px">' +
        '<div style="font-size:34px">' + avatarInline(x) + '</div>' +
        '<b style="font-size:13px">' + userName(x) + '</b>' +
        '<div class="muted">@' + esc(x.handle) + '</div>' +
        '<button class="btn small block" style="margin-top:6px" onclick="followUser(\'' + x.id + '\')">＋ Follow</button></div>').join('') +
      '</div>' : '') +
    '<div class="section-title"><span>Activity</span></div>' +
    (items.length ? items.map(a => {
      const au = getUser(a.userId);
      return '<a class="card list-row" href="' + a.link + '" style="align-items:flex-start">' +
        avatarHtml(au, 'list-ico') +
        '<span class="grow"><b>' + userName(au) + '</b> <span style="font-size:14px">' + esc(a.text) + '</span>' +
        '<div class="muted">' + timeAgo(a.ts) + '</div></span></a>';
    }).join('') :
      '<div class="empty"><span class="big">🦗</span>Quiet in here. Follow some foodies or switch to Everyone!</div>');
}
function followUser(id) {
  const u = me(); const t = getUser(id);
  if (u.following.includes(id)) {
    u.following = u.following.filter(x => x !== id);
    t.followers = t.followers.filter(x => x !== u.id);
    toast('Unfollowed ' + t.name);
  } else {
    u.following.push(id);
    t.followers.push(u.id);
    notify(id, u.name + ' started following you 🎉', '#/user/' + u.id);
    pushToast('You\'re now following ' + t.name);
  }
  save(); render();
}

/* ================= NOTIFICATIONS ================= */
function viewNotifications(el) {
  const items = myNotifications();
  el.innerHTML =
    '<div class="row between"><h1 style="font-size:21px;font-weight:700;margin:4px 0 14px">Notifications</h1>' +
    (items.length ? '<button class="btn small ghost" onclick="markAllRead()">Mark all read</button>' : '') + '</div>' +
    (items.length ? items.map(n =>
      '<a class="card list-row" style="' + (n.read ? 'opacity:.65' : 'border-left:4px solid var(--red)') + '" href="' + (n.link || '#/home') + '" onclick="readNotif(\'' + n.id + '\')">' +
      '<span class="list-ico" aria-hidden="true">' + (n.read ? '📭' : '📬') + '</span>' +
      '<span class="grow" style="font-size:14px">' + esc(n.text) + '<div class="muted">' + timeAgo(n.ts) + '</div></span></a>').join('') :
      '<div class="empty"><span class="big">📭</span>No notifications yet.</div>');
}
function readNotif(id) {
  const n = S.notifications.find(x => x.id === id);
  if (n) { n.read = true; save(); updateBell(); }
}
function markAllRead() {
  myNotifications().forEach(n => { n.read = true; });
  save(); render();
}

/* ================= PROFILE ================= */
function viewProfile(el) {
  const u = me();
  const myReviews = S.reviews.filter(r => r.userId === u.id && !r.removed);
  const myLists = S.lists.filter(l => l.ownerId === u.id);
  const avg = myReviews.length ? myReviews.reduce((a, r) => a + r.rating, 0) / myReviews.length : 0;
  const rolePill = { attendee: '🎟️ Attendee', influencer: '🎤 Influencer', blogger: '📝 Blogger', vendor: '🏪 Vendor', admin: '🛡️ Administrator' }[u.role];

  el.innerHTML =
    '<div class="profile-head">' +
    '<div class="profile-av">' + (u.avatar.startsWith('data:') ? '<img src="' + u.avatar + '" alt="Your profile photo">' : u.avatar) + '</div>' +
    '<h1 style="font-size:20px;margin:0">' + userName(u) + '</h1>' +
    '<div class="muted">@' + esc(u.handle) + ' · ' + rolePill + '</div>' +
    '<div style="margin-top:6px">' + u.badges.map(b => '<span class="pill badge-chip">🏅 ' + esc(b) + '</span>').join(' ') + '</div>' +
    '<p class="muted" style="max-width:340px;margin:8px auto">' + esc(u.bio) + '</p>' +
    '<div class="stat-row">' +
    '<div class="stat"><b>' + u.followers.length + '</b><span>Followers</span></div>' +
    '<div class="stat"><b>' + u.following.length + '</b><span>Following</span></div>' +
    '<div class="stat"><b>' + myReviews.length + '</b><span>Reviews</span></div>' +
    '<div class="stat"><b>' + (avg ? avg.toFixed(1) + ' ' + pupOne(true) : '—') + '</b><span>Avg rating</span></div>' +
    '</div>' +
    '<div class="row" style="justify-content:center;flex-wrap:wrap">' +
    '<button class="btn small secondary" onclick="openEditProfile()">Edit profile</button>' +
    '<button class="btn small ghost" onclick="location.hash=\'#/feed\'">Community feed</button>' +
    (u.role === 'admin' ? '<button class="btn small" onclick="location.hash=\'#/admin\'">🛡️ Admin console</button>' : '') +
    (u.role === 'influencer' ? '<button class="btn small yellow" onclick="openInfluencerStats()">📊 My analytics</button>' : '') +
    '</div></div>' +

    '<div class="section-title"><span>My lists (' + myLists.length + ')</span></div>' +
    myLists.map(listRowHtml).join('') +

    '<div class="section-title"><span>My reviews</span></div>' +
    (myReviews.length ? '<div class="card">' + myReviews.slice().sort((a, b) => b.ts - a.ts).map(r =>
      '<div class="review"><div class="row between"><b><a href="#/food/' + r.foodId + '" style="color:inherit">' + getFood(r.foodId).emoji + ' ' + esc(getFood(r.foodId).name) + '</a></b>' + pups(r.rating) + '</div>' +
      '<div style="font-size:13.5px;margin-top:3px">' + esc(r.text) + '</div></div>').join('') + '</div>' :
      '<div class="empty">No reviews yet — go eat something!</div>') +

    '<div class="card" style="margin-top:16px">' +
    '<h3 style="margin:0 0 8px;font-size:14px">🧪 Demo controls</h3>' +
    '<div class="row" style="flex-wrap:wrap">' +
    '<select id="personaSel" class="grow" aria-label="Switch demo persona">' +
    S.users.filter(x => !x.banned).map(x => '<option value="' + x.id + '" ' + (x.id === u.id ? 'selected' : '') + '>' + esc(x.name) + ' (' + x.role + ')</option>').join('') +
    '</select>' +
    '<button class="btn small secondary" onclick="switchPersona()">Switch</button>' +
    '</div>' +
    '<div class="row" style="margin-top:8px">' +
    '<button class="btn small ghost grow" onclick="signOut()">Sign out</button>' +
    '<button class="btn small ghost grow" onclick="if(confirm(\'Reset all demo data?\')){resetState();location.hash=\'#/home\';render();}">Reset demo data</button>' +
    '</div></div>';
}
function switchPersona() {
  S.currentUserId = document.getElementById('personaSel').value;
  save(); render();
  toast('Now browsing as ' + me().name);
}
function signOut() {
  const done = () => { location.hash = '#/home'; render(); };
  if (typeof authIsReal === 'function' && authIsReal()) {
    authSignOut().then(done);
  } else {
    S.currentUserId = null; save(); done();
  }
}
function openEditProfile() {
  const u = me();
  openModal('<h2>✏️ Edit profile</h2>' +
    '<label class="field">Display name<input type="text" id="epName" value="' + esc(u.name) + '" maxlength="30"></label>' +
    '<label class="field">Bio<textarea id="epBio" maxlength="140">' + esc(u.bio) + '</textarea></label>' +
    '<label class="field">Profile photo <span class="muted">(max 5MB, JPEG/PNG)</span>' +
    '<input type="file" accept="image/png,image/jpeg" onchange="epPhoto(this)"></label>' +
    '<button class="btn block" onclick="saveProfile()">Save</button>');
}
function epPhoto(input) {
  readImage(input.files[0], 5, data => { me().avatar = data; save(); if (typeof syncProfile === 'function') syncProfile(); toast('Photo updated'); updateAvatarBtn(); });
}
function saveProfile() {
  const u = me();
  u.name = document.getElementById('epName').value.trim() || u.name;
  u.bio = document.getElementById('epBio').value.trim();
  save();
  if (typeof syncProfile === 'function') syncProfile();
  closeModal(); render();
  toast('Profile saved');
}
function openInfluencerStats() {
  const u = me();
  const myLists = S.lists.filter(l => l.ownerId === u.id);
  const featured = myLists.filter(l => l.featured);
  const myReviews = S.reviews.filter(r => r.userId === u.id && !r.removed);
  const avg = myReviews.length ? (myReviews.reduce((a, r) => a + r.rating, 0) / myReviews.length).toFixed(1) : '—';
  openModal('<h2>📊 Influencer analytics</h2>' +
    '<div class="stat-row">' +
    '<div class="stat"><b>' + u.followers.length + '</b><span>Followers</span></div>' +
    '<div class="stat"><b>' + featured.length + '</b><span>Featured lists</span></div>' +
    '<div class="stat"><b>' + avg + (avg === '—' ? '' : ' ' + pupOne(true)) + '</b><span>Avg rating given</span></div>' +
    '</div>' +
    '<table class="table"><tr><th>List</th><th>Score</th><th>Views</th><th>Likes</th><th>Comments</th></tr>' +
    myLists.map(l => '<tr><td>' + esc(l.name) + '</td><td>' + (listRating(l).count ? listRating(l).avg.toFixed(1) + ' (' + listRating(l).count + ')' : '—') + '</td><td>' + l.views.toLocaleString() + '</td><td>' + l.likes.length + '</td><td>' + l.comments.length + '</td></tr>').join('') +
    '</table>' +
    '<p class="muted">Share lists straight to Instagram, TikTok or X with the 🔗 Share button on any list.</p>');
}

/* ---- other user's profile ---- */
function viewUser(el, id) {
  const t = getUser(id);
  if (!t) { el.innerHTML = '<div class="empty">User not found.</div>'; return; }
  if (t.id === S.currentUserId) { viewProfile(el); return; }
  const u = me();
  const following = u.following.includes(id);
  const theirLists = S.lists.filter(l => l.ownerId === id && (l.privacy === 'public' || (l.privacy === 'friends' && t.followers.includes(u.id))));
  const theirReviews = S.reviews.filter(r => r.userId === id && !r.removed).sort((a, b) => b.ts - a.ts).slice(0, 5);

  el.innerHTML =
    '<div class="profile-head">' +
    '<div class="profile-av">' + (t.avatar.startsWith('data:') ? '<img src="' + t.avatar + '" alt="">' : t.avatar) + '</div>' +
    '<h1 style="font-size:20px;margin:0">' + userName(t) + '</h1>' +
    '<div class="muted">@' + esc(t.handle) + ' · ' + t.role + '</div>' +
    '<div style="margin-top:6px">' + t.badges.map(b => '<span class="pill badge-chip">🏅 ' + esc(b) + '</span>').join(' ') + '</div>' +
    '<p class="muted" style="max-width:340px;margin:8px auto">' + esc(t.bio) + '</p>' +
    '<div class="stat-row">' +
    '<div class="stat"><b>' + t.followers.length + '</b><span>Followers</span></div>' +
    '<div class="stat"><b>' + t.following.length + '</b><span>Following</span></div>' +
    '<div class="stat"><b>' + S.reviews.filter(r => r.userId === id && !r.removed).length + '</b><span>Reviews</span></div>' +
    '</div>' +
    '<button class="btn ' + (following ? 'secondary' : '') + '" onclick="followUser(\'' + id + '\')">' + (following ? '✓ Following' : '＋ Follow') + '</button>' +
    '</div>' +
    '<div class="section-title"><span>Lists</span></div>' +
    (theirLists.length ? theirLists.map(listRowHtml).join('') : '<div class="empty">No visible lists.</div>') +
    '<div class="section-title"><span>Recent reviews</span></div>' +
    (theirReviews.length ? '<div class="card">' + theirReviews.map(r =>
      '<div class="review"><div class="row between"><b><a href="#/food/' + r.foodId + '" style="color:inherit">' + getFood(r.foodId).emoji + ' ' + esc(getFood(r.foodId).name) + '</a></b>' + pups(r.rating) + '</div>' +
      '<div style="font-size:13.5px;margin-top:3px">' + esc(r.text) + '</div></div>').join('') + '</div>' :
      '<div class="empty">No reviews yet.</div>');
}

/* ---- official (hero) photo: admin-curated ---- */
let heroTemp = null;
function openHeroModal(fid) {
  const f = getFood(fid);
  heroTemp = null;
  const guest = foodPhoto(f);
  openModal('<h2>Official photo</h2>' +
    '<p class="muted" style="margin:0 0 12px">The main image shown for ' + esc(f.name) + '. Guest photos always appear in the gallery, and are only used as the main image when no official photo is set.</p>' +
    (f.heroImg
      ? '<img src="' + f.heroImg + '" alt="Current official photo" style="width:100%;border-radius:12px;margin-bottom:12px">'
      : '<p class="muted" style="margin:0 0 12px">No official photo yet — currently showing ' + (guest ? 'the latest guest photo.' : 'a placeholder.') + '</p>') +
    '<label class="field">Upload photo <span class="muted">(max 5MB, JPEG/PNG)</span>' +
    '<input type="file" accept="image/png,image/jpeg" onchange="heroUpload(this)"></label>' +
    '<div id="heroPreview"></div>' +
    '<button class="btn block" onclick="saveHero(\'' + fid + '\')">Save official photo</button>' +
    (f.heroImg ? '<button class="btn ghost block" style="margin-top:8px" onclick="removeHero(\'' + fid + '\')">Remove official photo</button>' : ''));
}
function heroUpload(input) {
  readImage(input.files[0], 5, data => {
    heroTemp = data;
    document.getElementById('heroPreview').innerHTML =
      '<img src="' + data + '" alt="New official photo preview" style="width:100%;border-radius:12px;margin-bottom:12px">';
  });
}
function saveHero(fid) {
  if (!heroTemp) { toast('Choose a photo first'); return; }
  overrideFood(fid, { heroImg: heroTemp });
  closeModal(); render();
  toast('Official photo updated');
}
function removeHero(fid) {
  overrideFood(fid, { heroImg: null });
  closeModal(); render();
  toast('Official photo removed');
}


/* ================= ADMIN CONSOLE ================= */
let adminTab = 'moderation';
function viewAdmin(el) {
  const u = me();
  if (u.role !== 'admin') { el.innerHTML = '<div class="empty"><span class="big">🚫</span>Admins only.</div>'; return; }
  const tabs = [['moderation', '🚩 Reports'], ['users', '👥 Users'], ['featured', '⭐ Featured'], ['analytics', '📈 Analytics'], ['push', '📣 Push']];
  el.innerHTML =
    '<h1 style="font-size:21px;font-weight:700;margin:4px 0 14px">Admin console</h1>' +
    '<div class="chip-row">' + tabs.map(t =>
      '<button class="chip ' + (adminTab === t[0] ? 'on' : '') + '" onclick="adminTab=\'' + t[0] + '\';render()">' + t[1] + '</button>').join('') + '</div>' +
    '<div id="adminBody">' + adminBodyHtml() + '</div>';
}
function adminBodyHtml() {
  if (adminTab === 'moderation') {
    const pending = S.reports.filter(r => r.status === 'pending');
    return pending.length ? pending.map(rep => {
      let preview = '';
      if (rep.type === 'review') {
        const r = getReview(rep.targetId);
        if (r) preview = '<div class="vendor-reply" style="background:#fdeaea">"' + esc(r.text) + '" — ' + esc(getUser(r.userId).name) + ' on ' + esc(getFood(r.foodId).name) + '</div>';
      }
      return '<div class="card"><b>🚩 ' + rep.type + ' reported</b> <span class="muted">' + timeAgo(rep.ts) + '</span>' +
        '<div class="muted">Reason: ' + esc(rep.reason) + '</div>' + preview +
        '<div class="row" style="margin-top:8px;flex-wrap:wrap">' +
        '<button class="btn small" onclick="adminRemove(\'' + rep.id + '\')">Remove content</button>' +
        '<button class="btn small yellow" onclick="adminWarn(\'' + rep.id + '\')">Warn author</button>' +
        '<button class="btn small ghost" onclick="adminDismiss(\'' + rep.id + '\')">Dismiss</button>' +
        '</div></div>';
    }).join('') : '<div class="empty"><span class="big">✅</span>Moderation queue is empty.</div>';
  }
  if (adminTab === 'users') {
    return '<div class="card" style="overflow-x:auto"><table class="table"><tr><th>User</th><th>Role</th><th>⚠️</th><th>Actions</th></tr>' +
      S.users.map(x => '<tr><td>' + avatarInline(x) + ' ' + esc(x.name) + (x.banned ? ' <span class="pill soldout">BANNED</span>' : '') + '</td>' +
        '<td>' + x.role + (x.verified ? ' ✔️' : '') + '</td><td>' + x.warned + '</td>' +
        '<td><button class="btn small ghost" onclick="adminToggleBan(\'' + x.id + '\')">' + (x.banned ? 'Unban' : 'Ban') + '</button> ' +
        '<button class="btn small ghost" onclick="adminToggleVerify(\'' + x.id + '\')">' + (x.verified ? 'Unverify' : 'Verify') + '</button></td></tr>').join('') +
      '</table></div>';
  }
  if (adminTab === 'featured') {
    const pub = S.lists.filter(l => l.privacy === 'public');
    const pending = S.vendorRequests.filter(r => r.status === 'pending' && r.isFeatureRequest);
    return '<p class="muted" style="margin:2px 2px 12px">Featured lists appear as Sponsored placements above organic results. The <b>default</b> list is pinned first for every user.</p>' +
      pending.map(r =>
        '<div class="card" style="border-color:var(--gold)"><b>⭐ Featured request</b>' +
        '<div class="muted">' + esc(r.requesterName) + ' · ' + timeAgo(r.ts) + '</div>' +
        '<div style="font-size:13.5px;margin:4px 0">' + esc(r.note) + '</div>' +
        '<div class="row"><button class="btn small" onclick="adminApprove(\'' + r.id + '\')">Approve</button>' +
        '<button class="btn small ghost" onclick="adminDeny(\'' + r.id + '\')">Deny</button></div></div>').join('') +
      pub.map(l => '<div class="card"><div class="row between"><span><b>' + esc(l.name) + '</b>' + (l.id === S.defaultListId ? ' <span class="pill new">Default</span>' : '') +
        '<div class="muted">' + esc(getUser(l.ownerId).name) + ' · ' + l.views.toLocaleString() + ' views · ' + l.likes.length + ' likes</div></span></div>' +
        '<div class="row" style="margin-top:8px">' +
        '<button class="btn small ' + (l.featured ? 'secondary' : 'ghost') + '" onclick="adminToggleFeatured(\'' + l.id + '\')">' + (l.featured ? '★ Sponsored — remove' : 'Make sponsored') + '</button>' +
        (l.featured && l.id !== S.defaultListId ? '<button class="btn small ghost" onclick="adminSetDefault(\'' + l.id + '\')">Pin as default</button>' : '') +
        '</div></div>').join('');
  }
  if (adminTab === 'analytics') {
    const max = Math.max.apply(null, S.analytics.dau);
    const mostReviewed = S.foods.slice().sort((a, b) => foodReviews(b.id).length - foodReviews(a.id).length).slice(0, 5);
    return '<div class="card"><h3 style="margin:0;font-size:14px">Daily active users</h3>' +
      '<div class="bars" role="img" aria-label="Daily active users, peaked Tuesday at 15,800">' +
      S.analytics.dau.map((d, i) => '<div class="bar" style="height:' + Math.round(d / max * 100) + '%;background:var(--blue)"><em>' + (d / 1000).toFixed(1) + 'k</em><span>' + S.analytics.days[i] + '</span></div>').join('') +
      '</div><div style="height:22px"></div></div>' +
      '<div class="card"><h3 style="margin:0 0 6px;font-size:14px">Top searches</h3><div class="chip-row">' +
      S.analytics.topSearches.map(t => '<span class="chip">' + esc(t) + '</span>').join('') + '</div></div>' +
      '<div class="card"><h3 style="margin:0 0 6px;font-size:14px">Most reviewed foods</h3><table class="table">' +
      mostReviewed.map(f => '<tr><td>' + f.emoji + ' ' + esc(f.name) + '</td><td>' + foodReviews(f.id).length + ' reviews</td><td>' + (foodRating(f.id).avg || 0).toFixed(1) + ' ' + pupOne(true) + '</td></tr>').join('') +
      '</table></div>' +
      '<button class="btn secondary block" onclick="adminExport()">⬇️ Export data (JSON)</button>';
  }
  if (adminTab === 'push') {
    return '<div class="card"><h3 style="margin:0 0 8px;font-size:14px">Send push notification</h3>' +
      '<label class="field">Audience<select id="pushSeg"><option value="all">All users</option><option value="attendee">Attendees</option><option value="influencer">Influencers</option></select></label>' +
      '<label class="field">Message<textarea id="pushMsg" maxlength="180" placeholder="e.g. Severe weather: seek shelter in the Coliseum."></textarea></label>' +
      '<button class="btn block" onclick="adminPush()">📣 Send now</button></div>' +
      (S.pushLog.length ? '<div class="section-title"><span>Sent</span></div>' + S.pushLog.map(p =>
        '<div class="card" style="font-size:13.5px">📣 ' + esc(p.msg) + '<div class="muted">to ' + p.seg + ' · ' + timeAgo(p.ts) + '</div></div>').join('') : '');
  }
  return '';
}
function adminRemove(repId) {
  const rep = S.reports.find(r => r.id === repId);
  if (rep.type === 'review') { const r = getReview(rep.targetId); if (r) r.removed = true; }
  rep.status = 'resolved';
  save(); render();
  toast('Content removed');
}
function adminWarn(repId) {
  const rep = S.reports.find(r => r.id === repId);
  if (rep.type === 'review') {
    const r = getReview(rep.targetId);
    if (r) { getUser(r.userId).warned++; notify(r.userId, '⚠️ A moderator issued a warning about one of your reviews.', ''); }
  }
  rep.status = 'resolved';
  save(); render();
  toast('Warning issued');
}
function adminDismiss(repId) {
  S.reports.find(r => r.id === repId).status = 'dismissed';
  save(); render();
}
function adminToggleBan(uidX) {
  const x = getUser(uidX);
  x.banned = !x.banned;
  save(); render();
  toast(x.banned ? x.name + ' banned' : x.name + ' unbanned');
}
function adminToggleVerify(uidX) {
  const x = getUser(uidX);
  x.verified = !x.verified;
  if (x.verified) notify(x.id, '✔️ Your account is now verified!', '');
  save(); render();
}
function adminApprove(reqId) {
  const r = S.vendorRequests.find(x => x.id === reqId);
  r.status = 'approved';
  const l = getList(r.featuredListId);
  if (l) { l.featured = true; notify(l.ownerId, '⭐ Your list "' + l.name + '" is now Featured!', '#/list/' + l.id); }
  save(); render();
  toast('Approved ✅');
}
function adminDeny(reqId) {
  const r = S.vendorRequests.find(x => x.id === reqId);
  r.status = 'denied';
  save(); render();
  toast('Denied');
}
function adminToggleFeatured(listId) {
  const l = getList(listId);
  l.featured = !l.featured;
  if (l.featured) notify(l.ownerId, '⭐ Your list "' + l.name + '" is now a Sponsored placement!', '#/list/' + listId);
  if (!l.featured && S.defaultListId === listId) S.defaultListId = (sponsoredLists()[0] || {}).id || null;
  save(); render();
}
function adminSetDefault(listId) {
  S.defaultListId = listId;
  notify(getList(listId).ownerId, '📌 Your list "' + getList(listId).name + '" is now the default list shown to every user!', '#/list/' + listId);
  save(); render();
  toast('Default list updated');
}
function adminExport() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'fairfoodie-export.json';
  a.click();
  toast('Export downloaded');
}
function adminPush() {
  const seg = document.getElementById('pushSeg').value;
  const msg = document.getElementById('pushMsg').value.trim();
  if (!msg) { toast('Write a message first'); return; }
  S.pushLog.unshift({ msg, seg, ts: Date.now() });
  S.users.forEach(x => {
    if (seg === 'all' || x.role === seg) {
      S.notifications.push({ id: uid('n'), userId: x.id, text: '📣 ' + msg, link: '', ts: Date.now(), read: false });
    }
  });
  save(); render();
  pushToast(msg);
}
