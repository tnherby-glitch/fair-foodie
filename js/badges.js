/* Foodie Passport — the "Ate it" check-in log + level/achievement badges.
   Single season (no year-over-year). Eaten items are the spine: a distinct
   count of foods a user has checked in drives levels; tags/timestamps/photos
   drive the achievement badges. */
/* global S, save, getUser, getFood, getVendor, pushToast */

/* ---------- eaten log ---------- */
function eatenEntries(userId) { return (S.eaten || []).filter(e => e.userId === userId); }
function eatenFoodIdSet(userId) {
  const s = new Set();
  (S.eaten || []).forEach(e => { if (e.userId === userId) s.add(e.foodId); });
  return s;
}
function eatenCount(userId) { return eatenFoodIdSet(userId).size; }
function hasEaten(userId, foodId) { return (S.eaten || []).some(e => e.userId === userId && e.foodId === foodId); }

/* Toggle the current user's check-in for a food (the one-tap "Ate it"). */
function toggleEaten(foodId) {
  const uid = S.currentUserId; if (!uid) return false;
  const i = (S.eaten || []).findIndex(e => e.userId === uid && e.foodId === foodId);
  let nowEaten;
  if (i >= 0) { S.eaten.splice(i, 1); nowEaten = false; }
  else { S.eaten.push({ userId: uid, foodId: foodId, ts: Date.now() }); nowEaten = true; }
  save();
  if (nowEaten) checkBadgeUnlocks(uid);
  return nowEaten;
}
/* Rating an item implies you ate it — mark it without toggling off. */
function markEaten(foodId) {
  const uid = S.currentUserId; if (!uid) return;
  if (!hasEaten(uid, foodId)) { S.eaten.push({ userId: uid, foodId: foodId, ts: Date.now() }); save(); }
}

/* ---------- badge definitions ---------- */
const LEVEL_BADGES = [
  { id: 'lvl5',  n: 5,  name: 'Fair Foodie Newbie',            emoji: '🌽', flavor: 'You’ve dipped a toe in the deep-fried pool.' },
  { id: 'lvl10', n: 10, name: 'Cheese Curd Cadet',             emoji: '🧀', flavor: 'Squeak level: audible.' },
  { id: 'lvl15', n: 15, name: 'On-A-Stick Specialist',         emoji: '🍢', flavor: 'If it can be skewered, you’ve conquered it.' },
  { id: 'lvl20', n: 20, name: 'Grandstand Grazer',             emoji: '🎪', flavor: 'You’ve officially outpaced your own appetite plan.' },
  { id: 'lvl25', n: 25, name: 'Midway Muncher',                emoji: '🎡', flavor: 'Walking off calories one ride line at a time.' },
  { id: 'lvl30', n: 30, name: 'Ribbon-Worthy Ruminant',        emoji: '🐄', flavor: 'Blue-ribbon effort, county-fair stomach.' },
  { id: 'lvl35', n: 35, name: 'Deep-Fried Deacon',             emoji: '🍤', flavor: 'You preach the gospel of butter and batter.' },
  { id: 'lvl40', n: 40, name: 'Legendary Get-Together Glutton', emoji: '🍴', flavor: 'The Great Minnesota Get-Together has met its match.' },
  { id: 'lvl45', n: 45, name: 'Fairgrounds Food Marathoner',   emoji: '🏅', flavor: '4.6 million come through those gates — you’ve out-eaten most of them.' },
  { id: 'lvl50', n: 50, name: 'Mythic Minnesota Munch Master', emoji: '👑', flavor: 'Sven and Ole are telling stories about you at the Machinery Hill campfire.' },
];

/* ---------- derived tag layer (Tier B) ----------
   The generated catalog has no pickle/spicy/building fields, so we derive them:
   flavor tags from the item name, building from the vendor's location text.
   Kept as pure functions so we never hand-edit js/catalog.js. */
function foodTags(f) {
  const n = (f && f.name || '').toLowerCase();
  const t = [];
  if (/pickle|dill/.test(n)) t.push('pickle');
  // curated spicy keywords — avoids false hits like "hot dog" / "hot chocolate"
  if (/spicy|jalapen|sriracha|buffalo|habanero|ghost pepper|nashville|cajun|\bchil(i|e)|diablo|fire ?cracker|peri[- ]?peri|hot honey|szechuan|gochujang|el diablo|flamin|scorpion|carolina reaper/.test(n)) t.push('spicy');
  return t;
}
function foodHasTag(f, tag) { return foodTags(f).indexOf(tag) >= 0; }

/* The named food halls used for Menu Completionist. Vendor.loc keyword → building. */
const FOOD_BUILDINGS = [
  { key: 'grandstand', name: 'Grandstand', kw: 'grandstand' },
  { key: 'food', name: 'Food Building', kw: 'food building' },
  { key: 'coliseum', name: 'Warner Coliseum', kw: 'coliseum' },
  { key: 'bazaar', name: 'International Bazaar', kw: 'international bazaar' },
  { key: 'westend', name: 'West End Market', kw: 'west end' },
];
function foodBuildingKey(f) {
  const v = getVendor(f && f.vendorId); if (!v || !v.loc) return null;
  const loc = v.loc.toLowerCase();
  for (let i = 0; i < FOOD_BUILDINGS.length; i++) { if (loc.indexOf(FOOD_BUILDINGS[i].kw) >= 0) return FOOD_BUILDINGS[i].key; }
  return null;
}

/* Tier A achievements — everything the catalog data supports today. */
const ACHIEVEMENTS = [
  { id: 'newkid',     name: 'New Kid on the Block', emoji: '🆕', flavor: 'Try every official new food of the season.',
    goal: () => S.foods.filter(f => f.official).length, progress: c => c.officialCount },
  { id: 'skewer',     name: 'Skewer Sweep',         emoji: '🧵', flavor: 'Eat 10 different on-a-stick items.',
    goal: () => 10, progress: c => c.byCat('On a Stick') },
  { id: 'sweet',      name: 'Sweet Tooth Supreme',  emoji: '🍦', flavor: 'Eat 10 desserts or sweets.',
    goal: () => 10, progress: c => c.byCat('Sweet') },
  { id: 'sip',        name: 'Sip Specialist',       emoji: '🥤', flavor: 'Try 8 different specialty sips.',
    goal: () => 8, progress: c => c.sipCount },
  { id: 'veg',        name: 'Veggie Voyager',       emoji: '🌱', flavor: 'Eat 10 vegetarian items.',
    goal: () => 10, progress: c => c.vegCount },
  { id: 'oneday',     name: 'One-Day Wonder',       emoji: '🚶', flavor: 'Log 10+ items in a single day.',
    goal: () => 10, progress: c => c.maxPerDay },
  { id: 'influencer', name: 'Foodie Influencer',    emoji: '📸', flavor: 'Log 5 items with photos.',
    goal: () => 5, progress: c => c.photoReviews },
  { id: 'trinity',    name: 'Cream Puff Classicist', emoji: '🐄', flavor: 'Eat a cream puff, a corn dog, and cheese curds.',
    goal: () => 3, progress: c => (c.nameHas('cream puff') ? 1 : 0) + (c.nameHas('corn dog') ? 1 : 0) + (c.nameHas('cheese curd') ? 1 : 0) },
  { id: 'sunrise',    name: 'Sunrise Snacker',      emoji: '🌅', flavor: 'Check something in before 9am.',
    goal: () => 1, progress: c => c.anyBefore(9) ? 1 : 0 },
  { id: 'nightowl',   name: 'Night Owl Nosher',     emoji: '🌙', flavor: 'Check something in after 9pm.',
    goal: () => 1, progress: c => c.anyAfter(21) ? 1 : 0 },
  // ---- Tier B (derived tags) ----
  { id: 'pickle',        name: 'Pickle Pioneer',    emoji: '🥒', flavor: 'Eat 3 pickle-forward items.',
    goal: () => 3, progress: c => c.pickleCount },
  { id: 'heat',          name: 'Heat Seeker',       emoji: '🌶️', flavor: 'Eat 5 spicy items.',
    goal: () => 5, progress: c => c.spicyCount },
  { id: 'completionist', name: 'Menu Completionist', emoji: '🍽️', flavor: 'Eat something from every food hall.',
    goal: () => FOOD_BUILDINGS.length, progress: c => c.buildingsVisited },
];

/* ---------- evaluation ---------- */
function badgeContext(userId) {
  const ids = Array.from(eatenFoodIdSet(userId));
  const foods = ids.map(getFood).filter(Boolean);
  const entries = eatenEntries(userId);
  const reviews = S.reviews.filter(r => r.userId === userId && !r.removed);
  const perDay = () => {
    const m = {};
    entries.forEach(e => { const d = new Date(e.ts); const k = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); m[k] = (m[k] || 0) + 1; });
    const vals = Object.keys(m).map(k => m[k]);
    return vals.length ? Math.max.apply(null, vals) : 0;
  };
  return {
    count: foods.length,
    byCat: cat => foods.filter(f => (f.cats || []).includes(cat)).length,
    get sipCount() { return foods.filter(f => f.sip).length; },
    get vegCount() { return foods.filter(f => { const v = getVendor(f.vendorId); return (f.dietary && f.dietary.indexOf('vegetarian') >= 0) || (v && v.veg); }).length; },
    get officialCount() { return foods.filter(f => f.official).length; },
    get photoReviews() { return reviews.filter(r => r.photos && r.photos.length).length; },
    get maxPerDay() { return perDay(); },
    get pickleCount() { return foods.filter(f => foodHasTag(f, 'pickle')).length; },
    get spicyCount() { return foods.filter(f => foodHasTag(f, 'spicy')).length; },
    get buildingsVisited() { const s = new Set(); foods.forEach(f => { const k = foodBuildingKey(f); if (k) s.add(k); }); return s.size; },
    nameHas: kw => foods.some(f => f.name.toLowerCase().indexOf(kw) >= 0),
    anyBefore: h => entries.some(e => new Date(e.ts).getHours() < h),
    anyAfter: h => entries.some(e => new Date(e.ts).getHours() >= h),
  };
}

/* Full passport view-model for a user. */
function passport(userId) {
  const c = badgeContext(userId);
  const count = c.count;
  let current = null, next = null;
  for (const lb of LEVEL_BADGES) {
    if (count >= lb.n) current = lb; else { next = lb; break; }
  }
  const achievements = ACHIEVEMENTS.map(a => {
    const goal = a.goal(), prog = Math.min(a.progress(c), goal);
    return { id: a.id, name: a.name, emoji: a.emoji, flavor: a.flavor, goal, progress: prog, earned: prog >= goal };
  });
  const levels = LEVEL_BADGES.map(lb => ({ id: lb.id, name: lb.name, emoji: lb.emoji, flavor: lb.flavor, n: lb.n, earned: count >= lb.n }));
  return { count, current, next, remaining: next ? next.n - count : 0, levels, achievements };
}

/* IDs of everything a user currently qualifies for (levels reached + achievements passed). */
function computeEarnedIds(userId) {
  const p = passport(userId);
  const ids = [];
  p.levels.forEach(l => { if (l.earned) ids.push(l.id); });
  p.achievements.forEach(a => { if (a.earned) ids.push(a.id); });
  return ids;
}
function badgeLabel(id) {
  const lb = LEVEL_BADGES.find(x => x.id === id) || ACHIEVEMENTS.find(x => x.id === id);
  return lb ? lb.emoji + ' ' + lb.name : id;
}

/* Detect newly-earned badges since last check and toast them. */
function checkBadgeUnlocks(userId) {
  const u = getUser(userId); if (!u) return [];
  const earned = computeEarnedIds(userId);
  if (!u.earned) { u.earned = earned; save(); return []; } // first-ever: set baseline silently
  const fresh = earned.filter(id => u.earned.indexOf(id) < 0);
  if (fresh.length) {
    fresh.forEach(id => u.earned.push(id));
    save();
    fresh.forEach(id => { if (typeof pushToast === 'function') pushToast('Badge earned: ' + badgeLabel(id) + '!'); });
  }
  return fresh;
}

/* Called once at boot: make sure S.eaten exists and every user's earned-set is
   baselined to what they already qualify for, so pre-seeded progress doesn't
   toast on the next check-in. */
function reconcileBadges() {
  if (!Array.isArray(S.eaten)) S.eaten = [];
  (S.users || []).forEach(u => { if (!u.earned) u.earned = computeEarnedIds(u.id); });
  save();
}
