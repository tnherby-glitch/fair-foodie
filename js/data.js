/* MN Fair Foodie Guide — data layer.
   Catalog (vendors/foods/geo) comes from js/catalog.js, generated from the
   official 2026 food database by tools/build-catalog.ps1.
   localStorage persists ONLY user-generated state (profiles, reviews, lists,
   notifications) plus overrides for vendor/admin edits to catalog records. */
/* global CATALOG, localStorage */

const DB_KEY = 'fairfoodie_user_v1';
const DATA_VERSION = 15;
let S = null;      // global app state (user state + in-memory catalog)
let dataRev = 0;   // bumped on every save so cached indexes can invalidate

/* storage that degrades to in-memory when localStorage is unavailable */
const store = (() => {
  try {
    localStorage.setItem('__t', '1'); localStorage.removeItem('__t');
    return localStorage;
  } catch (e) {
    const m = {};
    return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } };
  }
})();

/* keys persisted to localStorage — catalog arrays are never persisted */
const USER_KEYS = ['version', 'currentUserId', 'defaultListId', 'users', 'reviews', 'lists', 'baseRatings',
  'reports', 'vendorRequests', 'activity', 'notifications', 'challenges', 'pushLog',
  'analytics', 'amenities', 'foodOverrides', 'vendorOverrides', 'eaten'];

let foodIdx = null, vendorIdx = null;

function save() {
  dataRev++;
  try {
    const p = {};
    USER_KEYS.forEach(k => { p[k] = S[k]; });
    store.setItem(DB_KEY, JSON.stringify(p));
  } catch (e) { console.warn('save failed', e); }
  if (typeof onSaveSync === 'function') onSaveSync(); // push owned lists for real accounts
}

function buildCatalogState() {
  const arr = x => Array.isArray(x) ? x : (x == null ? [] : [x]);
  S.foods = CATALOG.foods.map(f => Object.assign({ heroImg: null, price: null }, f, { cats: arr(f.cats), dietary: arr(f.dietary) }));
  S.vendors = CATALOG.vendors.map(v => Object.assign({ verified: false, ownerUserId: null, specials: '', desc: v.loc || '' }, v));
  foodIdx = new Map(S.foods.map(f => [f.id, f]));
  vendorIdx = new Map(S.vendors.map(v => [v.id, v]));
  for (const id in S.foodOverrides) { const f = foodIdx.get(id); if (f) Object.assign(f, S.foodOverrides[id]); }
  for (const id in S.vendorOverrides) { const v = vendorIdx.get(id); if (v) Object.assign(v, S.vendorOverrides[id]); }
}

function loadState() {
  let us = null;
  try { us = JSON.parse(store.getItem(DB_KEY)); } catch (e) { us = null; }
  if (!us || us.version !== DATA_VERSION) us = seedUserState();
  S = us;
  if (!S.foodOverrides) S.foodOverrides = {};
  if (!S.vendorOverrides) S.vendorOverrides = {};
  buildCatalogState();
  S.lists.forEach(l => { if (!l.ratings) l.ratings = {}; });
}

function resetState() {
  store.removeItem(DB_KEY);
  S = seedUserState();
  buildCatalogState();
  save();
}

/* record an edit to a catalog record so it survives reloads */
function overrideFood(id, patch) {
  const f = foodIdx.get(id);
  if (!f) return;
  Object.assign(f, patch);
  S.foodOverrides[id] = Object.assign(S.foodOverrides[id] || {}, patch);
  save();
}
function overrideVendor(id, patch) {
  const v = vendorIdx.get(id);
  if (!v) return;
  Object.assign(v, patch);
  S.vendorOverrides[id] = Object.assign(S.vendorOverrides[id] || {}, patch);
  save();
}

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

/* ---------- lookups ---------- */
const getUser   = id => S.users.find(u => u.id === id);
const getFood   = id => (foodIdx && foodIdx.get(id)) || S.foods.find(f => f.id === id);
const getVendor = id => (vendorIdx && vendorIdx.get(id)) || S.vendors.find(v => v.id === id);
const getList   = id => S.lists.find(l => l.id === id);
const getReview = id => S.reviews.find(r => r.id === id);
const me        = () => getUser(S.currentUserId);

/* User blocking (App Store Guideline 1.2: UGC apps must let users block others).
   Blocking hides the blocked user's reviews, comments, lists, and feed activity
   from YOUR view — it does not delete their content for anyone else. */
function myBlockedIds() {
  const u = me();
  return (u && u.blockedUsers) || [];
}
function isBlockedByMe(userId) { return myBlockedIds().indexOf(userId) >= 0; }

function foodReviews(foodId) {
  return S.reviews.filter(r => r.foodId === foodId && !r.removed && !isBlockedByMe(r.userId));
}

/* Ratings index — rebuilt only when data changes (dataRev), so rendering a page
   of cards is O(page) not O(page × reviews). */
let _riCache = null, _riRev = -1;
function ratingsIndex() {
  if (_riRev === dataRev && _riCache) return _riCache;
  const m = Object.create(null);
  for (const r of S.reviews) {
    // Skip display-only copies of server reviews (r.remote) and this user's own
    // reviews already counted in the live server aggregate (r.synced) — both are
    // represented in S.remoteScores, so counting them here would double-count.
    if (r.removed || r.remote || r.synced) continue;
    const e = m[r.foodId] || (m[r.foodId] = { sum: 0, n: 0 });
    e.sum += r.rating; e.n++;
  }
  _riCache = m; _riRev = dataRev;
  return m;
}
function foodRating(foodId) {
  const e = ratingsIndex()[foodId];
  const b = (S.baseRatings && S.baseRatings[foodId]) || null;
  const rs = (S.remoteScores && S.remoteScores[foodId]) || null; // live community aggregate
  let sum = e ? e.sum : 0, n = e ? e.n : 0;
  if (b)  { sum += b.avg * b.count; n += b.count; }
  if (rs) { sum += rs.avg * rs.count; n += rs.count; }
  return n ? { avg: sum / n, count: n } : { avg: 0, count: 0 };
}
/* Blue Ribbon is earned: 4.8+ with 100+ ratings. Never decorative. */
function blueRibbon(foodId) {
  const r = foodRating(foodId);
  return r.count >= 100 && r.avg >= 4.8;
}
function listCountForFood(foodId) {
  return S.lists.filter(l => l.foodIds.includes(foodId)).length;
}

/* sponsored placements: featured influencer lists, default (pinned) list first */
function sponsoredLists() {
  const ls = S.lists.filter(l => l.featured && l.privacy === 'public' && !isBlockedByMe(l.ownerId));
  ls.sort((a, b) => ((b.id === S.defaultListId) - (a.id === S.defaultListId)) || b.views - a.views);
  return ls;
}
function listRating(l) {
  const vals = Object.values(l.ratings || {});
  if (!vals.length) return { avg: 0, count: 0 };
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length };
}

function trendingFoods(n) {
  // recent review activity + list adds, weighted; official new foods break ties
  const score = Object.create(null);
  S.reviews.forEach(r => { if (!r.removed) score[r.foodId] = (score[r.foodId] || 0) + 2 + r.likes.length; });
  S.lists.forEach(l => l.foodIds.forEach(fid => { score[fid] = (score[fid] || 0) + 1; }));
  const scored = S.foods.filter(f => score[f.id]);
  scored.sort((a, b) => score[b.id] - score[a.id]);
  if (scored.length < (n || 6)) {
    const extra = S.foods.filter(f => f.official && !score[f.id]).slice(0, (n || 6) - scored.length);
    return scored.concat(extra);
  }
  return scored.slice(0, n || 6);
}

function notify(userId, text, link) {
  if (!userId || userId === S.currentUserId) return;
  S.notifications.push({ id: uid('n'), userId, text, link: link || '', ts: Date.now(), read: false });
}
function myNotifications() {
  return S.notifications.filter(n => n.userId === S.currentUserId).sort((a, b) => b.ts - a.ts);
}

function logActivity(userId, text, link) {
  S.activity.unshift({ id: uid('a'), userId, text, link: link || '', ts: Date.now() });
  if (S.activity.length > 100) S.activity.length = 100;
}

/* ---------- catalog search helpers (used by the seed) ---------- */
function findFoodId(nameQ, vendorQ) {
  const nq = nameQ.toLowerCase();
  let c = CATALOG.foods.filter(f => f.name.toLowerCase().includes(nq));
  if (vendorQ && c.length > 1) {
    const vq = vendorQ.toLowerCase();
    const vids = new Set(CATALOG.vendors.filter(v => v.name.toLowerCase().includes(vq)).map(v => v.id));
    const c2 = c.filter(f => vids.has(f.vendorId));
    if (c2.length) c = c2;
  }
  return c.length ? c[0].id : null;
}
function findVendorId(q) {
  const vq = q.toLowerCase();
  const v = CATALOG.vendors.find(x => x.name.toLowerCase().includes(vq));
  return v ? v.id : null;
}
/* first (preferring official-new) food at a vendor, for list entries that name a stand */
function findVendorFoodId(vendorQ) {
  const vid = findVendorId(vendorQ);
  if (!vid) return null;
  const f = CATALOG.foods.find(x => x.vendorId === vid && x.official) || CATALOG.foods.find(x => x.vendorId === vid);
  return f ? f.id : null;
}

/* ---------- seed: demo users + social content on top of the real catalog ---------- */
function seedUserState() {
  const now = Date.now();
  const H = 3600e3, D = 24 * H;

  const users = [
    { id: 'u_admin', name: 'Fair Admin',        handle: 'mnfairadmin',  avatar: '🎡', role: 'admin',      verified: true,  bio: 'Keeping the Great Minnesota Get-Together great.', followers: [], following: [], badges: [], banned: false, warned: 0, qualityReviews: 0 },
    { id: 'u_inf2',  name: 'Allison',           handle: 'allisoneats',  avatar: '🌟', role: 'influencer', verified: true,  bio: 'MN\'s fair food authority. My crawl list is your day-one plan.', followers: ['u_inf1', 'u_blog1', 'u_reg1', 'u_reg2'], following: [], badges: ['Verified'], banned: false, warned: 0, qualityReviews: 60 },
    { id: 'u_inf1',  name: 'Maddy Munchies',    handle: 'maddymunchies',avatar: '🎤', role: 'influencer', verified: true,  bio: '400k followers of fair food chaos. If it\'s on a stick, I\'ve rated it.', followers: ['u_reg1', 'u_reg2', 'u_blog1'], following: ['u_blog1'], badges: ['Verified'], banned: false, warned: 0, qualityReviews: 40 },
    { id: 'u_blog1', name: "Ole's Eats",        handle: 'oleseats',     avatar: '📝', role: 'blogger',    verified: false, bio: 'Twin Cities food blog. 12 fairs and counting. Uff da.', followers: ['u_inf1'], following: ['u_inf1', 'u_reg1'], badges: ['Blogger'], banned: false, warned: 0, qualityReviews: 27 },
    { id: 'u_reg1',  name: 'Curd Nerd',         handle: 'curdnerd',     avatar: '🧀', role: 'attendee',   verified: false, bio: 'Squeak connoisseur.', followers: ['u_blog1'], following: ['u_inf1'], badges: [], banned: false, warned: 0, qualityReviews: 8 },
    { id: 'u_reg2',  name: 'Sky Glider Sam',    handle: 'skygliders',   avatar: '🚡', role: 'attendee',   verified: false, bio: 'I judge the fair from above.', followers: [], following: ['u_inf1'], badges: [], banned: false, warned: 0, qualityReviews: 3 },
  ];

  /* resolve real catalog ids for seeded content */
  const F = findFoodId, V = findVendorId;
  const idPicklePie   = F('Pickle Pie', 'LuLu');
  const idLumpia      = F('Longanisa Cheese Curd Lumpia');
  const idProntoPup   = F('Pronto Pup', 'Pronto Pup') || F('corn dog');
  const idCurds       = F('cheese curds', 'Mouth Trap');
  const idCookies     = F('cookie', 'Sweet Martha');
  const idMilk        = F('milk', 'Milk');
  const idGrinder     = F('Apple Donut Ham Grinder');
  const idPeriPeri    = F('Peri-Peri Bowl');
  const idSurf        = F("Surf 'N' Turf Burger") || F('Surf');
  const idWalleye     = F('walleye', 'LuLu') || F('walleye');
  const idPretzel     = F('Butter Brew Mustache Pretzel');
  const idMiniDonut   = F('mini donut', "Tom Thumb") || F('mini donut');
  const idCornRibs    = F("Cracklin' Corn Ribs") || F('corn ribs');
  const idElote       = F('Elote Tots');
  const idHmong       = F('Hmong Corndog');
  const idSparkler    = F('Sweet Peach Lemonade Sparkler');
  const idDillCookie  = F('Dill with it');
  const idRoastCorn   = F('roasted corn') || F('corn roast') || F('sweet corn');
  const idChocChip    = F('chocolate chip cookies', 'Sweet Martha') || idCookies;

  /* No vendor accounts this year — stands are catalog data only. */
  const vendorOverrides = {};

  const reviews = [
    { id: 'r1',  foodId: idCurds,      userId: 'u_reg1',  rating: 5, text: 'The squeak is REAL. Molten cheese, perfect batter, zero regrets. I waited 20 minutes and would wait 40.', photos: [], likes: ['u_inf1', 'u_blog1'], comments: [{ id: 'c1', userId: 'u_inf1', text: 'The Food Building line is a rite of passage!', ts: now - 2 * D }], reported: false, removed: false, ts: now - 3 * D, vendorResponse: null },
    { id: 'r2',  foodId: idProntoPup,  userId: 'u_inf1',  rating: 5, text: 'The original. The icon. The reason this app rates things in Pronto Pups. Crispy batter, snappy dog — five out of five of itself.', photos: [], likes: ['u_reg1', 'u_reg2'], comments: [], reported: false, removed: false, ts: now - 2.5 * D, vendorResponse: null },
    { id: 'r3',  foodId: idPicklePie,  userId: 'u_inf1',  rating: 4, text: 'Pickle Pie is the unhinged icon 2026 deserves. Cream cheese and chopped pickle in a crust, ranch-Cholula frosting on top — it walks the line between genius and war crime and lands on genius.', photos: [], likes: ['u_blog1'], comments: [{ id: 'c2', userId: 'u_reg2', text: 'You have convinced me. Adding to my list.', ts: now - 1 * D }], reported: false, removed: false, ts: now - 1.2 * D, vendorResponse: null },
    { id: 'r4',  foodId: idChocChip,   userId: 'u_reg2',  rating: 4, text: 'Bucket of warm cookies is a top-3 fair experience. Docked one Pup because I ate too many and had to sit down for a while.', photos: [], likes: [], comments: [], reported: false, removed: false, ts: now - 2 * D, vendorResponse: null },
    { id: 'r5',  foodId: idSurf,       userId: 'u_blog1', rating: 2, text: 'The Surf N Turf Burger is a leap of faith and my wallet filed a complaint. Lobster on a fair burger is bold; the execution was uneven and the lobster got lost. Points for audacity.', photos: [], likes: ['u_reg1'], comments: [], reported: false, removed: false, ts: now - 1 * D, vendorResponse: null },
    { id: 'r6',  foodId: idCornRibs,   userId: 'u_blog1', rating: 5, text: 'Cracklin Corn Ribs are the sleeper hit of the year. Tempura crunch, candied jalapeños, and the pork rind bed is not a gimmick — it catches the butter.', photos: [], likes: ['u_inf1'], comments: [], reported: false, removed: false, ts: now - 2.2 * D, vendorResponse: null },
    { id: 'r7',  foodId: idLumpia,     userId: 'u_reg1',  rating: 5, text: 'Longanisa Cheese Curd Lumpia is my new-food winner this year. Sweet-garlicky Filipino sausage and squeaky curds in a crackly lumpia wrapper — this is what the fair does best.', photos: [], likes: ['u_inf1', 'u_blog1', 'u_reg2'], comments: [], reported: false, removed: false, ts: now - 0.5 * D, vendorResponse: null },
    { id: 'r8',  foodId: idMilk,       userId: 'u_reg2',  rating: 5, text: 'Unlimited milk. The greatest deal in American food service. I had six cups and regret nothing.', photos: [], likes: ['u_reg1'], comments: [], reported: false, removed: false, ts: now - 4 * D, vendorResponse: null },
    { id: 'r9',  foodId: idElote,      userId: 'u_reg2',  rating: 1, text: 'This booth SCAMMED me!! The portion was tiny and the guy was a total [removed]. AVOID!!!', photos: [], likes: [], comments: [], reported: true, removed: false, ts: now - 0.8 * D, vendorResponse: null },
    { id: 'r10', foodId: idWalleye,    userId: 'u_inf1',  rating: 4, text: 'Walleye at the fair is the classiest thing you can eat while standing next to a llama barn. Crispy edges, tender center.', photos: [], likes: [], comments: [], reported: false, removed: false, ts: now - 3.5 * D, vendorResponse: null },
    { id: 'r11', foodId: idPretzel,    userId: 'u_reg1',  rating: 3, text: 'The Butter Brew Mustache Pretzel is cute and the butterscotch-caramel sugar is nice, but it leans very sweet for a pretzel. The soft-serve dip carries it. Split one.', photos: [], likes: [], comments: [], reported: false, removed: false, ts: now - 0.3 * D, vendorResponse: null },
    { id: 'r12', foodId: idMiniDonut,  userId: 'u_blog1', rating: 4, text: 'Mini donuts: eternal. Hot, cinnamon-sugared, gone in minutes. The bucket format is a trap and I fall for it every year.', photos: [], likes: ['u_reg2'], comments: [], reported: false, removed: false, ts: now - 5 * D, vendorResponse: null },
  ].filter(r => r.foodId);

  const officialIds = CATALOG.foods.filter(f => f.official).map(f => f.id);
  const ids = arr => arr.filter(Boolean);

  /* Allison's real 2026 list — all 50 ranked picks from her fair spreadsheet,
     in her order, matched to the official catalog by dish name + vendor. */
  const allison2026 = ids([
    F('Super Stick', 'Spaghetti Eddie'),                 // 1
    F('Chinese Sausage and Cheese Popper', 'Saturday Dumpling'),
    F('Bao Belly', "RC's"),
    F('Shakshuka Lamb Meatballs', 'French Meadow'),
    F('Cherry Bigfoot Limeade Float', 'Tasti Whip'),     // 5
    F('Hmong Corndog', 'Union Hmong'),
    F('Pickle Pizza', "Rick's"),
    F('Pork Schnitzel Sandwich', 'Farmers Union'),
    F('Elote Tots', 'Tot Boss'),
    F('Hot Honey Pizza Ballzz', 'Green Mill'),           // 10
    F('Uncrustaburger', 'Coasters'),
    F('Crack-n-Cheese', 'Jive Turkey'),
    F('BBQ pulled pork mac savory waffle cone', 'Roon'), // "Dealer's Choice"
    F('Apple Donut Ham Grinder', 'Farmers Union'),
    F('Chocolate Strawberry Cup'),                       // 15
    F('Walking Chopped Italian Grinder', 'Mancini'),
    F('Honey Brisket Battered Potatoes', 'Australian'),
    F('Battered Deep-Fried Cheese Curds', 'Mouth Trap'),
    F('Bacon On-A-Stick', 'Big Fat Bacon'),
    F('Frozen Cider Pop', 'Agriculture'),                // 20
    F('Blue Moon Crunch', 'Minnesnowii'),
    F('Hawaiian shaved ice', 'Hawaiian'),
    F('Sweet Corn On-The-Cob', 'Corn Roast'),
    F('MR. PEG', 'The Peg'),
    F('Blueberry Basil Lemonade', 'Blue Barn'),          // 25
    F('The Amish Doughnut', 'Peachey'),
    F('Jamaican Jerk Chicken Loaded Fries', 'Irie'),
    F('Birria Crunch Bomb', 'Taco Torro'),
    F('Tanghulu', 'Iemochi'),
    F('Apple Fries', 'Apple Fries'),                     // 30
    F('Peri-Peri Bowl', 'Afro Deli'),
    F('Garlic Cream Cheese Wontons', 'Que Viet'),
    F('When Pigs Fly', 'Sausage Sister'),
    F('Tacos de Mole', 'El Burrito'),
    F('Chorizo Manchego Croquettes', 'Paella'),          // 35
    F('Butter Brew Mustache Pretzel', 'Blue Moon'),
    F('Longanisa Cheese Curd Lumpia', 'Lumpia City'),
    F('French Chouxnut Sundae', 'Bridgeman'),
    F('Sligo Slider Bites', "O'Gara"),
    F("Athena's Whipped Feta", 'Dino'),                  // 40
    F('Sweet Peach Lemonade Sparkler', 'Quench'),
    F('Garlic Fries', 'Ball Park'),
    findVendorFoodId('Nitro Ice Cream'),
    F('Mango Sticky Rice Refresher', 'Chan'),
    F('Brandy Old Fashioned Cookie Dough', 'Kora'),      // 45
    F('Pickle Pie', 'LuLu'),
    F('Milk', 'All You Can Drink Milk'),
    F('Chocolate Chip Cookies', 'Sweet Martha'),
    F('Dill with it', 'Urban Glow'),
    F("Surf 'N' Turf Burger", 'Caribe'),                 // 50
  ]);

  /* Community baseline ratings (aggregate texture; Blue Ribbon = 4.8+ & 100+ only).
     Exactly three foods earn the ribbon at seed time. */
  const baseRatings = {};
  const setBase = (id, avg, count) => { if (id) baseRatings[id] = { avg, count }; };
  setBase(idProntoPup, 4.9, 2100);                       // 🏆 ribbon
  setBase(F('Sweet Corn On-The-Cob', 'Corn Roast'), 4.8, 1150); // 🏆 ribbon
  setBase(idLumpia, 4.9, 320);                            // 🏆 ribbon — new-food winner
  setBase(idCurds, 4.7, 1800);
  setBase(idChocChip, 4.5, 3400);
  setBase(idMilk, 4.6, 2600);
  setBase(idPicklePie, 4.6, 540);
  setBase(F('Bacon On-A-Stick', 'Big Fat Bacon'), 4.4, 610);
  setBase(F('Apple Fries', 'Apple Fries'), 4.5, 480);
  setBase(idElote, 4.3, 390);
  setBase(idHmong, 4.7, 210);
  setBase(F('Garlic Fries', 'Ball Park'), 4.1, 500);
  setBase(F('Original Minneapple Pie'), 4.4, 700);
  setBase(F('Dole Soft Serve Cup', 'Tasti Whip'), 4.3, 450);
  setBase(F('The Amish Doughnut', 'Peachey'), 4.6, 820);

  const lists = [
    { id: 'l0', slug: 'allisons-2026-fair-list', name: 'Allison\'s 2026 Fair List', ownerId: 'u_inf2', foodIds: allison2026, privacy: 'public', featured: true, likes: ['u_inf1', 'u_blog1', 'u_reg1', 'u_reg2'], ratings: { u_reg1: 5, u_reg2: 5, u_blog1: 5, u_inf1: 4 }, views: 9214, comments: [], collaborators: [], ts: now - 7 * D },
    { id: 'l1', slug: 'maddys-top-10-must-eats-2026', name: 'Maddy\'s Top 10 Must-Eats 2026', ownerId: 'u_inf1', foodIds: ids([idProntoPup, idCurds, idCornRibs, idChocChip, idLumpia, idWalleye, idRoastCorn, idMiniDonut, idPicklePie, idMilk]), privacy: 'public', featured: true, likes: ['u_reg1', 'u_reg2', 'u_blog1'], ratings: { u_reg1: 5, u_reg2: 5, u_blog1: 4 }, views: 4821, comments: [{ id: 'lc1', userId: 'u_reg1', text: 'Used this list all day Saturday — flawless routing!', ts: now - 1 * D }], collaborators: [], ts: now - 6 * D },
    { id: 'l2', slug: 'new-this-year-worth-the-hype', name: '8 New Foods Worth the Hype 🔥', ownerId: 'u_inf1', foodIds: ids([idPicklePie, idCornRibs, idLumpia, idHmong, idElote, idPeriPeri, idSparkler, idDillCookie]).length >= 4 ? ids([idPicklePie, idCornRibs, idLumpia, idHmong, idElote, idPeriPeri, idSparkler, idDillCookie]) : officialIds.slice(0, 8), privacy: 'public', featured: true, likes: ['u_blog1'], ratings: { u_blog1: 4, u_reg2: 4 }, views: 2214, comments: [], collaborators: [], ts: now - 4 * D },
    { id: 'l3', name: 'Ole\'s Classic Circuit', ownerId: 'u_blog1', foodIds: ids([idProntoPup, idMilk, idRoastCorn, idCurds, idMiniDonut]), privacy: 'public', featured: false, likes: ['u_reg1'], ratings: { u_reg1: 4 }, views: 640, comments: [], collaborators: [], ts: now - 3 * D },
    { id: 'l4', name: 'Kids Will Love', ownerId: 'u_reg1', foodIds: ids([idChocChip, idMilk, idMiniDonut, F('lemonade')]), privacy: 'friends', featured: false, likes: [], ratings: {}, views: 25, comments: [], collaborators: [], ts: now - 2 * D },
  ];

  const reports = reviews.some(r => r.id === 'r9')
    ? [{ id: 'rep1', type: 'review', targetId: 'r9', reason: 'Harassment / inappropriate language toward vendor', reporterId: 'u_blog1', status: 'pending', ts: now - 0.5 * D }]
    : [];

  const activity = [
    { id: 'a1', userId: 'u_inf1',  text: 'reviewed Pickle Pie — 4 Pups', link: '#/food/' + idPicklePie, ts: now - 1.2 * D },
    { id: 'a2', userId: 'u_reg1',  text: 'reviewed Longanisa Cheese Curd Lumpia — 5 Pups', link: '#/food/' + idLumpia, ts: now - 0.5 * D },
    { id: 'a3', userId: 'u_blog1', text: 'created list "Ole\'s Classic Circuit"', link: '#/list/l3', ts: now - 3 * D },
    { id: 'a4', userId: 'u_inf1',  text: 'published featured list "8 New Foods Worth the Hype 🔥"', link: '#/list/l2', ts: now - 4 * D },
  ];

  /* amenity markers in real lat/long (approximate spots inside the grounds) */
  const amenities = [
    { type: 'restroom', label: 'Restrooms', icon: '🚻', spots: [
      { lat: 44.9805, lon: -93.1755 }, { lat: 44.9800, lon: -93.1710 }, { lat: 44.9838, lon: -93.1690 }, { lat: 44.9788, lon: -93.1735 }] },
    { type: 'atm', label: 'ATMs', icon: '🏧', spots: [
      { lat: 44.9812, lon: -93.1730 }, { lat: 44.9786, lon: -93.1700 }] },
    { type: 'firstaid', label: 'First Aid', icon: '⛑️', spots: [
      { lat: 44.9820, lon: -93.1712 }] },
  ];

  return {
    version: DATA_VERSION,
    currentUserId: null,
    defaultListId: 'l0', // Allison's list — the default sponsored placement for every user
    users, reviews, lists, reports, activity, amenities, baseRatings,
    // demo passport: Allison has checked in 32 items (a Ribbon-Worthy Ruminant),
    // spread ~40 min apart so the log looks lived-in
    eaten: allison2026.slice(0, 32).map((fid, i) => ({ userId: 'u_inf2', foodId: fid, ts: now - i * 2400000 })),
    vendorRequests: [],
    foodOverrides: {},
    vendorOverrides,
    notifications: [
      { id: 'n1', userId: 'u_inf1', text: 'Curd Nerd commented on your list "Maddy\'s Top 10 Must-Eats 2026"', link: '#/list/l1', ts: now - 1 * D, read: false },
    ],
    challenges: [
      { id: 'ch1', text: 'Daily Challenge: Try 3 deep-fried foods today', progressCat: 'Deep Fried', goal: 3 },
    ],
    pushLog: [],
    analytics: {
      dau: [4200, 5100, 6800, 9400, 12100, 15800, 14200],
      days: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'],
      topSearches: ['pickle pie', 'cheese curds', 'pronto pup', 'lumpia', 'apple fries'],
    },
  };
}
