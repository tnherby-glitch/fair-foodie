/* MN Fair Foodie Guide — data layer + seed data */
/* global localStorage */

const DB_KEY = 'fairfoodie_v1';
const DATA_VERSION = 7;
let S = null; // global app state
let dataRev = 0; // bumped on every save so cached indexes can invalidate

/* storage that degrades to in-memory when localStorage is unavailable (e.g. sandboxed embeds) */
const store = (() => {
  try {
    localStorage.setItem('__t', '1'); localStorage.removeItem('__t');
    return localStorage;
  } catch (e) {
    const m = {};
    return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = v; }, removeItem: k => { delete m[k]; } };
  }
})();

function save() {
  dataRev++;
  try { store.setItem(DB_KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); }
}

function loadState() {
  try { S = JSON.parse(store.getItem(DB_KEY)); } catch (e) { S = null; }
  if (!S || S.version !== DATA_VERSION) { S = seedState(); save(); }
  S.lists.forEach(l => { if (!l.ratings) l.ratings = {}; }); // migrate pre-rating lists
}

function resetState() {
  store.removeItem(DB_KEY);
  S = seedState();
  save();
}

function uid(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

/* ---------- lookups ---------- */
const getUser   = id => S.users.find(u => u.id === id);
const getFood   = id => S.foods.find(f => f.id === id);
const getVendor = id => S.vendors.find(v => v.id === id);
const getList   = id => S.lists.find(l => l.id === id);
const getReview = id => S.reviews.find(r => r.id === id);
const me        = () => getUser(S.currentUserId);

function foodReviews(foodId) {
  return S.reviews.filter(r => r.foodId === foodId && !r.removed);
}

/* Ratings index — rebuilt only when data changes (dataRev), so rendering a page
   of cards is O(page) not O(page × reviews). Scales to a 1,600-food catalog. */
let _riCache = null, _riRev = -1;
function ratingsIndex() {
  if (_riRev === dataRev && _riCache) return _riCache;
  const m = Object.create(null);
  for (const r of S.reviews) {
    if (r.removed) continue;
    const e = m[r.foodId] || (m[r.foodId] = { sum: 0, n: 0 });
    e.sum += r.rating; e.n++;
  }
  _riCache = m; _riRev = dataRev;
  return m;
}
function foodRating(foodId) {
  const e = ratingsIndex()[foodId];
  return e ? { avg: e.sum / e.n, count: e.n } : { avg: 0, count: 0 };
}
function listCountForFood(foodId) {
  return S.lists.filter(l => l.foodIds.includes(foodId)).length;
}
/* sponsored placements: featured influencer lists, default (pinned) list first */
function sponsoredLists() {
  const ls = S.lists.filter(l => l.featured && l.privacy === 'public');
  ls.sort((a, b) => ((b.id === S.defaultListId) - (a.id === S.defaultListId)) || b.views - a.views);
  return ls;
}
function listRating(l) {
  const vals = Object.values(l.ratings || {});
  if (!vals.length) return { avg: 0, count: 0 };
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length };
}
function trendingFoods(n) {
  // recent review activity + list adds, weighted
  const score = {};
  S.foods.forEach(f => { score[f.id] = 0; });
  S.reviews.forEach(r => { if (!r.removed) score[r.foodId] += 2 + r.likes.length; });
  S.lists.forEach(l => l.foodIds.forEach(fid => { if (score[fid] !== undefined) score[fid] += 1; }));
  return S.foods.slice().sort((a, b) => score[b.id] - score[a.id]).slice(0, n || 6);
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

/* ---------- seed ---------- */
function seedState() {
  const now = Date.now();
  const H = 3600e3, D = 24 * H;

  // Coordinates sit on the real fairgrounds street grid (see STREETS in views2.js).
  const vendors = [
    // classic anchor vendors
    { id: 'v1',  name: 'Pronto Pup',                 x: 500, y: 355, hours: '9am–11pm', verified: true,  ownerUserId: 'u_vend1', desc: 'The original corn dog at Underwood & Carnes — a fair icon since 1947.', specials: 'Buy 4, get a free lemonade!' },
    { id: 'v2',  name: "Sweet Martha's Cookie Jar",  x: 415, y: 355, hours: '9am–11pm', verified: true,  ownerUserId: null, desc: 'Warm chocolate chip cookies by the bucket, 1710 Carnes Ave.', specials: '' },
    { id: 'v3',  name: 'The Mouth Trap Cheese Curds',x: 550, y: 300, hours: '8am–10pm', verified: true,  ownerUserId: 'u_vend2', desc: 'Legendary squeaky curds in the Food Building, Underwood St.', specials: '' },
    { id: 'v4',  name: 'Fresh French Fries',         x: 500, y: 265, hours: '9am–10pm', verified: false, ownerUserId: null, desc: 'Hot, salty, in a bucket. Underwood & Dan Patch.', specials: '' },
    { id: 'v5',  name: 'All You Can Drink Milk',     x: 455, y: 450, hours: '9am–9pm',  verified: true,  ownerUserId: null, desc: '$2 bottomless cup at the Dairy Building, Judson Ave.', specials: '' },
    { id: 'v6',  name: 'Corn Roast',                 x: 335, y: 265, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Butter-dunked roasted sweet corn on Dan Patch Ave.', specials: '' },
    { id: 'v7',  name: 'Hamline Church Dining Hall', x: 250, y: 265, hours: '8am–8pm',  verified: true,  ownerUserId: null, desc: 'Serving fairgoers since 1897, on Dan Patch Ave.', specials: 'Pie of the day: rhubarb' },
    { id: 'v8',  name: 'Turkey To Go',               x: 600, y: 355, hours: '10am–9pm', verified: true,  ownerUserId: null, desc: 'Giant turkey sandwiches, Carnes & Cooper.', specials: '' },
    { id: 'v9',  name: 'The Blue Barn',              x: 130, y: 400, hours: '8am–11pm', verified: true,  ownerUserId: null, desc: 'West End Market favorite, south of History & Heritage Center.', specials: '' },
    { id: 'v10', name: "LuLu's Public House",        x: 130, y: 360, hours: '10am–11pm',verified: true,  ownerUserId: null, desc: 'West End Market, south of Schilling Amphitheater.', specials: '' },
    { id: 'v11', name: 'Nordic Waffles',             x: 335, y: 355, hours: '8am–10pm', verified: true,  ownerUserId: null, desc: 'Fresh-rolled Norwegian waffles on Carnes Ave.', specials: '' },
    { id: 'v12', name: 'Que Viet',                   x: 600, y: 265, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Egg rolls on a stick, east Dan Patch Ave.', specials: '' },
    { id: 'v13', name: 'Tom Thumb Mini Donuts',      x: 335, y: 90,  hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Cinnamon-sugar minis near the north Midway.', specials: '' },
    { id: 'v14', name: "Giggles' Campfire Grill",    x: 250, y: 90,  hours: '9am–9pm',  verified: true,  ownerUserId: null, desc: 'North Woods eats in the north end.', specials: '' },
    { id: 'v15', name: 'MN Farmers Union Coffee Shop',x: 650, y: 265, hours: '6am–9pm', verified: true,  ownerUserId: null, desc: 'North side of Dan Patch Ave. between Cooper & Cosgrove.', specials: '' },
    // 2026 new-food vendors
    { id: 'v16', name: 'Lumpia City',                x: 160, y: 400, hours: '9am–10pm', verified: false, ownerUserId: null, desc: 'West side of Liggett St. between Carnes & Judson avenues.', specials: '' },
    { id: 'v17', name: "Bridgeman's Ice Cream",      x: 160, y: 450, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Northeast corner of Judson Ave. & Liggett St.', specials: '' },
    { id: 'v18', name: 'Rooted & Wild by Snack House',x: 380, y: 450, hours: '9am–9pm', verified: false, ownerUserId: null, desc: 'Lee & Rose Warner Coliseum, south side.', specials: '' },
    { id: 'v19', name: 'Cafe Caribe',               x: 290, y: 355, hours: '9am–11pm', verified: true,  ownerUserId: null, desc: 'South side of Carnes Ave. between Chambers & Clough streets.', specials: '' },
    { id: 'v20', name: 'Blue Moon Dine-In Theater',  x: 250, y: 355, hours: '9am–11pm', verified: true,  ownerUserId: null, desc: 'Northeast corner of Carnes Ave. & Chambers St.', specials: '' },
    { id: 'v21', name: "RC's BBQ",                   x: 205, y: 265, hours: '10am–10pm',verified: true,  ownerUserId: null, desc: 'North side of West Dan Patch Ave. between Liggett & Chambers.', specials: '' },
    { id: 'v22', name: 'Minnesnowii Shave Ice',      x: 415, y: 310, hours: '10am–10pm',verified: false, ownerUserId: null, desc: 'West side of Nelson St. between Dan Patch & Carnes.', specials: '' },
    { id: 'v23', name: "Mancini's al Fresco",        x: 457, y: 355, hours: '10am–11pm',verified: true,  ownerUserId: null, desc: 'North side of Carnes Ave. between Nelson & Underwood.', specials: '' },
    { id: 'v24', name: 'French Meadow Bakery & Cafe',x: 465, y: 348, hours: '8am–10pm', verified: true,  ownerUserId: null, desc: 'North side of Carnes Ave. between Nelson & Underwood.', specials: '' },
    { id: 'v25', name: "Dino's Gyros",               x: 475, y: 355, hours: '10am–11pm',verified: true,  ownerUserId: null, desc: 'North side of Carnes Ave. between Nelson & Underwood.', specials: '' },
    { id: 'v26', name: 'Paella Depot',               x: 375, y: 450, hours: '11am–9pm', verified: true,  ownerUserId: null, desc: 'South side of Judson Ave. between Clough & Nelson.', specials: '' },
    { id: 'v27', name: 'Australian Battered Potatoes',x: 457, y: 450,hours: '10am–10pm',verified: true,  ownerUserId: null, desc: 'South side of Judson Ave. between Nelson & Underwood.', specials: '' },
    { id: 'v28', name: 'Union Hmong Kitchen',        x: 620, y: 500, hours: '10am–9pm', verified: true,  ownerUserId: null, desc: 'International Bazaar, south wall, west corner.', specials: '' },
    { id: 'v29', name: 'El Burrito Mercado',         x: 655, y: 505, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'International Bazaar, south wall.', specials: '' },
    { id: 'v30', name: 'Irie Jamaican Express',      x: 685, y: 470, hours: '11am–9pm', verified: false, ownerUserId: null, desc: 'Taste of Midtown Global Market, Bazaar east wall (Aug 27–Sep 1).', specials: '' },
    { id: 'v31', name: 'Sausage Sister & Me',        x: 550, y: 335, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Food Building, east wall.', specials: '' },
    { id: 'v32', name: 'The Herbivorous Butcher',    x: 515, y: 340, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Food Building, west section, south wall.', specials: '' },
    { id: 'v33', name: "Sara's Tipsy Pies",          x: 510, y: 290, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Food Building, northwest wall.', specials: '' },
    { id: 'v34', name: 'Afro Deli & Grill',          x: 560, y: 335, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Food Building, east wall.', specials: '' },
    { id: 'v35', name: "O'Gara's at the Fair",       x: 700, y: 265, hours: '10am–11pm',verified: true,  ownerUserId: null, desc: 'Southwest corner of Dan Patch Ave. & Cosgrove St.', specials: '' },
    { id: 'v36', name: "Kora & Mila's Cookie Dough", x: 650, y: 265, hours: '10am–10pm',verified: false, ownerUserId: null, desc: 'South side of Dan Patch Ave. between Cooper & Cosgrove.', specials: '' },
    { id: 'v37', name: 'San Felipe Tacos',           x: 500, y: 265, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Southwest corner of Dan Patch Ave. & Underwood St.', specials: '' },
    { id: 'v38', name: "Quench'd Lemonade",          x: 457, y: 265, hours: '9am–10pm', verified: false, ownerUserId: null, desc: 'South side of Dan Patch Ave. between Nelson & Underwood.', specials: '' },
    { id: 'v39', name: 'Tot Boss',                   x: 500, y: 220, hours: '10am–10pm',verified: false, ownerUserId: null, desc: 'East side of Underwood St. between Wright & Dan Patch, south of Kidway.', specials: '' },
    { id: 'v40', name: 'Loon Lake Iced Tea',         x: 500, y: 215, hours: '9am–9pm',  verified: true,  ownerUserId: null, desc: 'West side of Underwood St. between Wright & Dan Patch.', specials: '' },
    { id: 'v41', name: "Strawberries 'N Creme",      x: 500, y: 175, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'West side of Underwood St. at Wright Ave.', specials: '' },
    { id: 'v42', name: 'Summer Lakes Boat House',    x: 500, y: 90,  hours: '10am–11pm',verified: false, ownerUserId: null, desc: 'Southwest corner of Randall Ave. & Underwood St. (new vendor).', specials: '' },
    { id: 'v43', name: "Chan's Eatery",              x: 500, y: 520, hours: '10am–10pm',verified: true,  ownerUserId: null, desc: 'East side of Underwood St. between Murphy & Lee avenues.', specials: '' },
    { id: 'v44', name: "Solem's Mini Donuts",        x: 515, y: 520, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'East side of Underwood St. between Murphy & Lee avenues.', specials: '' },
    { id: 'v45', name: "Taulelle's Jurassic Corn Dogs",x: 485, y: 520,hours: '10am–10pm',verified: false,ownerUserId: null, desc: 'East side of Underwood St. between Murphy & Lee avenues.', specials: '' },
    { id: 'v46', name: 'Urban Glow Mocktails',       x: 600, y: 110, hours: '10am–10pm',verified: false, ownerUserId: null, desc: 'North End, northeast section, across from the North End Event Center.', specials: '' },
    { id: 'v47', name: 'dodopop',                    x: 600, y: 265, hours: '10am–10pm',verified: false, ownerUserId: null, desc: 'Northeast corner of Dan Patch Ave. & Cooper St. (new vendor).', specials: '' },
    { id: 'v48', name: 'Iemochi Japanese Confections',x: 635, y: 505,hours: '11am–9pm', verified: false, ownerUserId: null, desc: 'International Bazaar, south wall (new vendor).', specials: '' },
    { id: 'v49', name: 'Jive Turkey BBQ',            x: 550, y: 505, hours: '10am–10pm',verified: false, ownerUserId: null, desc: 'North side of Lee Ave. between Underwood & Cooper (new vendor).', specials: '' },
    { id: 'v50', name: 'El Taco Torro',              x: 685, y: 480, hours: '11am–9pm', verified: false, ownerUserId: null, desc: 'Taste of Midtown Global Market, Bazaar east wall (Sep 2–7).', specials: '' },
    { id: 'v51', name: "Minnesota's Original Apple Fries",x: 550, y: 265,hours: '10am–10pm',verified: false,ownerUserId: null, desc: 'North side of Dan Patch Ave. between Underwood & Cooper (new vendor).', specials: '' },
    { id: 'v52', name: "Roon's Savories",            x: 160, y: 405, hours: '10am–10pm',verified: false, ownerUserId: null, desc: 'West side of Liggett St. between Carnes & Judson (new vendor).', specials: '' },
  ];

  const foods = [
    { id: 'f1',  name: 'Pronto Pup',                        vendorId: 'v1',  price: 5,    cats: ['On a Stick', 'Savory'],            dietary: [],                                emoji: '🌭', isNew: false, soldOut: false, desc: 'The batter-dipped wiener that started it all. The app is named after its rating scale for a reason.' },
    { id: 'f2',  name: "Sweet Martha's Cookie Bucket",      vendorId: 'v2',  price: 20,   cats: ['Sweet'],                            dietary: ['vegetarian'],                    emoji: '🍪', isNew: false, soldOut: false, desc: 'An overflowing bucket of warm chocolate chip cookies. Sharing optional.' },
    { id: 'f3',  name: 'Cheese Curds',                      vendorId: 'v3',  price: 9,    cats: ['Deep Fried', 'Savory'],             dietary: ['vegetarian'],                    emoji: '🧀', isNew: false, soldOut: false, desc: 'Golden, squeaky, molten. The Food Building line moves fast — worth it.' },
    { id: 'f4',  name: 'Fresh French Fries Bucket',         vendorId: 'v4',  price: 8,    cats: ['Deep Fried', 'Savory'],             dietary: ['vegetarian', 'vegan', 'gluten-free'], emoji: '🍟', isNew: false, soldOut: false, desc: 'Skin-on fries by the bucket, salted while you watch.' },
    { id: 'f5',  name: 'All-You-Can-Drink Milk',            vendorId: 'v5',  price: 2,    cats: ['Drinks', 'Dairy'],                  dietary: ['vegetarian', 'gluten-free'],     emoji: '🥛', isNew: false, soldOut: false, desc: 'White or chocolate, unlimited refills. A $2 legend.' },
    { id: 'f6',  name: 'Roasted Sweet Corn',                vendorId: 'v6',  price: 6,    cats: ['Savory'],                           dietary: ['vegetarian', 'gluten-free'],     emoji: '🌽', isNew: false, soldOut: false, desc: 'Dunked in a vat of melted butter. Napkins are not optional.' },
    { id: 'f7',  name: 'Turkey Sandwich',                   vendorId: 'v8',  price: 12,   cats: ['Savory'],                           dietary: ['dairy-free'],                    emoji: '🥪', isNew: false, soldOut: false, desc: 'Hand-pulled turkey piled on a fresh bun.' },
    { id: 'f8',  name: 'Chicken in the Waffle',             vendorId: 'v9',  price: 11,   cats: ['Savory', 'Sweet'],                  dietary: [],                                emoji: '🧇', isNew: false, soldOut: false, desc: 'Blue Barn classic: fried chicken rolled in a waffle with sweet-hot syrup.' },
    { id: 'f9',  name: 'Egg Roll on a Stick',               vendorId: 'v12', price: 7,    cats: ['On a Stick', 'Deep Fried', 'Savory'], dietary: ['dairy-free'],                  emoji: '🥢', isNew: false, soldOut: false, desc: 'Que Viet crispy egg roll, conveniently impaled.' },
    { id: 'f10', name: 'Deep-Fried Candy Bar',              vendorId: 'v13', price: 8,    cats: ['Deep Fried', 'Sweet', 'On a Stick'], dietary: ['vegetarian'],                   emoji: '🍫', isNew: false, soldOut: false, desc: 'A candy bar, battered and fried until it becomes a molten confession.' },
    { id: 'f11', name: 'Nitro Cold Press',                  vendorId: 'v15', price: 6.5,  cats: ['Drinks'],                           dietary: ['vegan', 'gluten-free', 'dairy-free'], emoji: '☕', isNew: false, soldOut: false, desc: 'Creamy nitro coffee from MN co-op roasters.' },
    { id: 'f12', name: 'Walleye Cakes',                     vendorId: 'v10', price: 13,   cats: ['Savory'],                           dietary: [],                                emoji: '🐟', isNew: false, soldOut: false, desc: "LuLu's crispy walleye cakes with remoulade — a MN delicacy." },
    { id: 'f13', name: 'Rhubarb Pie Slice',                 vendorId: 'v7',  price: 5.5,  cats: ['Sweet'],                            dietary: ['vegetarian'],                    emoji: '🥧', isNew: false, soldOut: false, desc: 'Church-basement pie perfection since 1897.' },
    { id: 'f14', name: 'S\'mores Waffle',                   vendorId: 'v11', price: 9,    cats: ['Sweet'],                            dietary: ['vegetarian'],                    emoji: '🍡', isNew: false, soldOut: false, desc: 'Fresh Nordic waffle rolled with toasted marshmallow, chocolate and graham.' },
    { id: 'f20b', name: 'Wild Berry Sno-Cone',              vendorId: 'v14', price: 6,    cats: ['Sweet', 'Drinks'],                  dietary: ['vegan', 'gluten-free', 'dairy-free'], emoji: '🍧', isNew: false, soldOut: true,  desc: 'Shaved ice with north-shore berry syrup.' },
    { id: 'f22b', name: 'Mini Donut Bucket',                vendorId: 'v13', price: 10,   cats: ['Sweet', 'Deep Fried'],              dietary: ['vegetarian'],                    emoji: '🍩', isNew: false, soldOut: false, desc: 'Cinnamon-sugar minis, hot from the fryer.' },

    // ===== Official 2026 New Foods (source: MN State Fair 2026 New Food List) =====
    { id: 'f15', name: 'Pickle Pie',                        vendorId: 'v10', price: 9,    cats: ['Sweet', 'Savory'],                  dietary: ['vegetarian'],                    emoji: '🥧', isNew: true, soldOut: false, desc: 'Pie crust filled with chopped pickles, pickle juice and cream cheese, topped with savory ranch-Cholula whipped frosting, a gherkin and a sprinkle of dill.' },
    { id: 'f16', name: "Cracklin' Corn Ribs",              vendorId: 'v9',  price: 11,   cats: ['Deep Fried', 'Savory'],             dietary: [],                                emoji: '🌽', isNew: true, soldOut: false, desc: 'Corn cob quarters dipped in tempura batter and fried, brushed with seasoned butter and topped with bacon ranch, green onion and candied jalapeños on a bed of pork rinds.' },
    { id: 'f17', name: 'Longanisa Cheese Curd Lumpia',      vendorId: 'v16', price: 10,   cats: ['Deep Fried', 'Savory'],             dietary: [],                                emoji: '🧀', isNew: true, soldOut: false, desc: 'Filipino longanisa pork sausage and Wisconsin cheese curds rolled in a lumpia wrapper and deep-fried, served with sweet chili sauce.' },
    { id: 'f18', name: 'French Chouxnut Sundae',            vendorId: 'v17', price: 10,   cats: ['Sweet', 'Dairy'],                   dietary: ['vegetarian'],                    emoji: '🍦', isNew: true, soldOut: false, desc: "Bridgeman's salted caramel espresso ice cream atop a choux pastry donut filled with milk chocolate mousse, dark chocolate icing, caramel, whipped cream and a cherry." },
    { id: 'f19', name: 'Korean BBQ Bao Buns',               vendorId: 'v18', price: 11,   cats: ['Savory'],                           dietary: ['vegan'],                         emoji: '🥟', isNew: true, soldOut: false, desc: 'Vegan Chunk plant-based shredded "meat" in hot Korean barbecue sauce, topped with pineapple slaw on steamed bao buns.' },
    { id: 'f20', name: "Surf 'N' Turf Burger",             vendorId: 'v19', price: 17,   cats: ['Savory'],                           dietary: [],                                emoji: '🍔', isNew: true, soldOut: false, desc: 'Garlic-herb butter lobster stacked on a 1/3-lb grilled beef patty with pepper jack and chipotle mayo on a toasted brioche bun.' },
    { id: 'f21', name: 'Butter Brew Mustache Pretzel',      vendorId: 'v20', price: 9,    cats: ['Sweet'],                            dietary: ['vegetarian'],                    emoji: '🥨', isNew: true, soldOut: false, desc: 'Soft pretzel baked in a mustache shape, buttered and tossed in butter-brew sugar of caramel, vanilla and butterscotch, with vanilla soft-serve dip.' },
    { id: 'f22', name: 'Bao Belly',                         vendorId: 'v21', price: 12,   cats: ['Savory'],                           dietary: [],                                emoji: '🥓', isNew: true, soldOut: false, desc: "Smoked BBQ pork belly with RC's hot sauce and yum yum sauce, pickled vegetables and cilantro on steamed bao buns." },
    { id: 'f23', name: 'Blue Moon Crunch',                  vendorId: 'v22', price: 8,    cats: ['Sweet', 'Drinks'],                  dietary: ['gluten-free', 'vegan'],          emoji: '🍧', isNew: true, soldOut: false, desc: 'Fluffy shave ice in blue moon flavor, dusted with Fruity Pebbles and drizzled with sweetened condensed milk. (GF & vegan on request)' },
    { id: 'f24', name: 'Walking Chopped Italian Grinder',   vendorId: 'v23', price: 11,   cats: ['Savory'],                           dietary: [],                                emoji: '🥪', isNew: true, soldOut: false, desc: 'Chopped Italian grinder blend of salami, pepperoncini, olives, artichokes and mozzarella over Dutch Crunch parmesan-garlic kettle chips with Calabrian chili aioli.' },
    { id: 'f25', name: 'Shakshuka Lamb Meatballs',          vendorId: 'v24', price: 13,   cats: ['Savory'],                           dietary: ['gluten-free'],                   emoji: '🍖', isNew: true, soldOut: false, desc: 'Lamb-pork meatballs stuffed with whipped garlic herb goat cheese over shakshuka, with a side of chimichurri sourdough crostini. (GF on request)' },
    { id: 'f26', name: 'Dubai Whoopie Pie',                 vendorId: 'v25', price: 8,    cats: ['Sweet'],                            dietary: ['vegetarian'],                    emoji: '🍫', isNew: true, soldOut: false, desc: 'Pistachio cream between two dark chocolate cakes, rolled in a Dubai crunch of shredded filo, crushed pistachios, honey and brown sugar.' },
    { id: 'f27', name: 'Chorizo Manchego Croquettes',       vendorId: 'v26', price: 10,   cats: ['Deep Fried', 'Savory'],             dietary: ['gluten-free'],                   emoji: '🧆', isNew: true, soldOut: false, desc: 'Spanish potato croquettes filled with manchego and chorizo, breaded, fried and drizzled with lemon garlic aioli.' },
    { id: 'f28', name: 'Honey Brisket Battered Potatoes',   vendorId: 'v27', price: 12,   cats: ['Deep Fried', 'Savory'],             dietary: [],                                emoji: '🥔', isNew: true, soldOut: false, desc: 'Australian battered potatoes topped with beef brisket, smothered in nacho cheese and drizzled with hot honey.' },
    { id: 'f29', name: 'Hmong Corndog',                     vendorId: 'v28', price: 9,    cats: ['On a Stick', 'Deep Fried', 'Savory'], dietary: [],                              emoji: '🌭', isNew: true, soldOut: false, desc: "Pork Hmong sausage with ginger, garlic, chili and lemongrass (with Kramarczuk's), dipped in cornmeal batter and fried, with citrus Kua Txob sauce." },
    { id: 'f30', name: 'Tacos de Mole',                     vendorId: 'v29', price: 10,   cats: ['Savory'],                           dietary: [],                                emoji: '🌮', isNew: true, soldOut: false, desc: 'Flour tortillas filled with shredded chicken, cheese and house-made mole, deep-fried and topped with more mole and queso fresco.' },
    { id: 'f31', name: 'Jamaican Jerk Chicken Loaded Fries',vendorId: 'v30', price: 12,   cats: ['Deep Fried', 'Savory'],             dietary: [],                                emoji: '🍟', isNew: true, soldOut: false, desc: 'Battered fries topped with Jamaican jerk chicken, melted cheese and green onions, drizzled with ranch and jerk sauce. (Aug. 27–Sept. 1 only)' },
    { id: 'f32', name: 'When Pigs Fly',                     vendorId: 'v31', price: 12,   cats: ['On a Stick', 'Savory'],             dietary: [],                                emoji: '🌭', isNew: true, soldOut: false, desc: 'Flight of pork sausages wrapped in puff pastry on-a-stick: chorizo w/ chimichurri, Texas two-step w/ slaw, Oktoberfest w/ cheddar and porketta w/ pickle aioli.' },
    { id: 'f33', name: 'The Fried and the Furious',         vendorId: 'v32', price: 12,   cats: ['Deep Fried', 'Savory'],             dietary: ['vegan'],                         emoji: '🥪', isNew: true, soldOut: false, desc: 'Cubano Drift: deep-fried vegan Cubano in a crunchy tortilla with vegan pork, vegan Swiss, dill pickle relish, garlic mayo and mustard, with jalapeño citrus sauce.' },
    { id: 'f34', name: 'Strawberry Ube Sundae Tart',        vendorId: 'v33', price: 9,    cats: ['Sweet'],                            dietary: ['gluten-free'],                   emoji: '🍓', isNew: true, soldOut: false, desc: 'Strawberry and ube marshmallow cream with chocolate chips in a fudge-filled shortbread crust, topped with whipped cream, strawberry sauce and edible glitter. (GF-friendly)' },
    { id: 'f35', name: 'Peri-Peri Bowl',                    vendorId: 'v34', price: 13,   cats: ['Savory'],                           dietary: [],                                emoji: '🍗', isNew: true, soldOut: false, desc: 'Fried peri-peri hot chicken with mini beef sambusas and fried sweet plantains, peri-peri sauce and choice of basbaas or spicy red chili.' },
    { id: 'f36', name: 'Sligo Slider Bites On-A-Stick',     vendorId: 'v35', price: 10,   cats: ['On a Stick', 'Deep Fried', 'Savory'], dietary: [],                              emoji: '🍔', isNew: true, soldOut: false, desc: 'Handmade dumplings stuffed with a cheeseburger blend of beef, cheddar, pickle and onion, skewered, deep-fried and served with Thousand Island.' },
    { id: 'f37', name: 'Brandy Old Fashioned Cookie Dough', vendorId: 'v36', price: 8,    cats: ['Sweet', 'On a Stick'],              dietary: ['vegetarian'],                    emoji: '🍪', isNew: true, soldOut: false, desc: 'Edible cookie dough with nonalcoholic brandy flavor, orange zest, cinnamon, dark chocolate and dried cherries on-a-stick, dipped in chocolate and rolled in Biscoff.' },
    { id: 'f38', name: 'Apple Donut Ham Grinder',           vendorId: 'v15', price: 13,   cats: ['Savory', 'Sweet'],                  dietary: [],                                emoji: '🍎', isNew: true, soldOut: false, desc: 'First Kiss apple rings, battered, fried and cinnamon-sugared, stacked with uncured ham, arugula and hot honey with herb ricotta on a toasted hoagie.' },
    { id: 'f39', name: 'Banana Butterscotch Barnraiser',    vendorId: 'v15', price: 9,    cats: ['Sweet'],                            dietary: ['vegetarian'],                    emoji: '🍌', isNew: true, soldOut: false, desc: 'Vanilla pound cake layered with roasted bananas, butterscotch and caramelized croissant croutons, whipped cream and a nut-free cereal mix.' },
    { id: 'f40', name: 'Bucket of Chicharrones',            vendorId: 'v37', price: 9,    cats: ['Deep Fried', 'Savory'],             dietary: [],                                emoji: '🫓', isNew: true, soldOut: false, desc: 'Freshly fried chicharrones with chili-lime seasoning and a trio of dips: hot sauce, creamy chipotle and chamoy.' },
    { id: 'f41', name: 'Sweet Peach Lemonade Sparkler',     vendorId: 'v38', price: 7,    cats: ['Drinks'],                           dietary: ['gluten-free', 'vegetarian'],     emoji: '🍑', isNew: true, soldOut: false, desc: 'Fresh-squeezed lemonade layered with peach syrup and peach sweet cream cold foam, topped with popping candy and a peach slice.' },
    { id: 'f42', name: 'Elote Tots',                        vendorId: 'v39', price: 8,    cats: ['Deep Fried', 'Savory'],             dietary: ['vegetarian'],                    emoji: '🥔', isNew: true, soldOut: false, desc: 'Tater tots tossed in Tajín and topped with an elote-style sauce of roasted corn, peppers, cheddar, crema and cream cheese, finished with cotija.' },
    { id: 'f43', name: 'Caramel Apple Iced Tea',            vendorId: 'v40', price: 6,    cats: ['Drinks'],                           dietary: ['gluten-free', 'vegetarian'],     emoji: '🧋', isNew: true, soldOut: false, desc: 'Black tea brewed with tart apple, topped with caramel cold foam and a Caramel Apple Pops lollipop.' },
    { id: 'f44', name: 'Strawberries & Blueberry Parfait',  vendorId: 'v41', price: 8,    cats: ['Sweet'],                            dietary: ['gluten-free', 'vegan'],          emoji: '🍓', isNew: true, soldOut: false, desc: 'Fresh whole strawberries layered with blueberry non-dairy whipped topping and garnished with gluten-free waffle chips.' },
    { id: 'f45', name: 'Dockside Poppers',                  vendorId: 'v42', price: 10,   cats: ['Deep Fried', 'Savory'],             dietary: [],                                emoji: '🫑', isNew: true, soldOut: false, desc: 'Seasoned cream cheese, bacon, artichoke hearts and jalapeño, breaded and lightly fried, with homemade tomato chili jam.' },
    { id: 'f46', name: 'Mango Sticky Rice Refresher',       vendorId: 'v43', price: 7,    cats: ['Drinks'],                           dietary: ['gluten-free', 'vegetarian'],     emoji: '🥭', isNew: true, soldOut: false, desc: 'Coconut, evaporated and condensed milk with mango over ice, topped with fresh and dried mango and a dried-mango sugar rim.' },
    { id: 'f47', name: 'Strawberry Crunch Mini Donuts',     vendorId: 'v44', price: 9,    cats: ['Sweet', 'Deep Fried'],              dietary: ['vegetarian'],                    emoji: '🍩', isNew: true, soldOut: false, desc: 'Strawberry donuts dusted with vanilla sugar, drizzled with vanilla icing and topped with strawberry streusel crunch, served in a bucket.' },
    { id: 'f48', name: 'Pumpkin Bar Funnel Cake',           vendorId: 'v45', price: 10,   cats: ['Deep Fried', 'Sweet'],              dietary: ['vegetarian'],                    emoji: '🎃', isNew: true, soldOut: false, desc: 'Real pumpkin, cinnamon and vanilla blended into funnel cake batter and fried, brushed with butter and topped with cinnamon cream cheese frosting.' },
    { id: 'f49', name: 'Dill with it, Cookie!',             vendorId: 'v46', price: 5,    cats: ['Sweet'],                            dietary: ['vegetarian'],                    emoji: '🍪', isNew: true, soldOut: false, desc: 'White chocolate chips, finely chopped dill pickle and fresh dill baked into a cookie with sugar and Maldon sea salt. Created by Holman\'s Table.' },
    { id: 'f50', name: 'Two-Tone Bloody Mary Mocktail',     vendorId: 'v46', price: 9,    cats: ['Drinks'],                           dietary: [],                                emoji: '🍅', isNew: true, soldOut: false, desc: 'Homemade tomatillo salsa layered with a zero-alcohol bloody mary blend, garnished with pickle, cheese, tomato, olive and an Urban Glow Cheeweenie sausage.' },

    // ===== Signature items from new 2026 vendors =====
    { id: 'f51', name: 'Dirty Soda Flight',                 vendorId: 'v47', price: 7,    cats: ['Drinks'],                           dietary: ['vegetarian'],                    emoji: '🥤', isNew: true, soldOut: false, desc: 'Six dirty-soda flavors from dodopop — megalodon, golden yeti, liger, big red dog, sasquatch and babe\'s lemonade — mixed with syrups and cream.' },
    { id: 'f52', name: 'Tanghulu',                          vendorId: 'v48', price: 8,    cats: ['Sweet', 'On a Stick'],              dietary: ['gluten-free'],                   emoji: '🍓', isNew: true, soldOut: false, desc: 'Fruit skewered and coated in a hard candy shell, in strawberry, green grape, Mandarin orange or dual-mix. All gluten-free.' },
    { id: 'f53', name: 'Crack-n-Cheese Bowl',               vendorId: 'v49', price: 13,   cats: ['Savory'],                           dietary: [],                                emoji: '🧀', isNew: true, soldOut: false, desc: 'Homemade mac and cheese, hickory-smoked turkey barbecue, deep-fried turkey cracklins and signature sauce from Jive Turkey BBQ.' },
    { id: 'f54', name: 'Birria Crunch Bombs',               vendorId: 'v50', price: 11,   cats: ['Deep Fried', 'Savory'],             dietary: [],                                emoji: '🌮', isNew: true, soldOut: false, desc: 'Deep-fried tortilla balls filled with birria beef and Oaxaca & mozzarella, rolled in tortilla-chip coating with lime crema and consommé. (Sept. 2–7 only)' },
    { id: 'f55', name: 'Apple Fries',                       vendorId: 'v51', price: 8,    cats: ['Sweet', 'Deep Fried'],              dietary: ['gluten-free', 'vegetarian'],     emoji: '🍎', isNew: true, soldOut: false, desc: 'Fresh-cut apples fried, tossed in cinnamon sugar and served with a side of caramel. All gluten-friendly and vegetarian.' },
    { id: 'f56', name: 'Savory Waffle Cone',                vendorId: 'v52', price: 10,   cats: ['Savory'],                           dietary: [],                                emoji: '🧇', isNew: true, soldOut: false, desc: "Roon's hand-rolled parmesan-cheddar-herb waffle cones with fillings: BBQ pulled pork mac, chicken tinga & rice, classic chicken salad or three-cheese mac." },
  ];

  /* The real fair carries ~1,600 foods across ~300 stands. The curated items above
     (classics + official 2026 new foods) power the featured / new / trending rows;
     this generator fills the rest of the catalog so search, browse, filters and
     pagination are exercised at true fair scale. Deterministic — stable across reloads. */
  (function fillCatalog() {
    const bases = [
      { n: 'Cheese Curds', e: '🧀', c: ['Deep Fried', 'Savory'], v: true },
      { n: 'Corn Dog', e: '🌭', c: ['On a Stick', 'Savory'] },
      { n: 'Funnel Cake', e: '🍥', c: ['Deep Fried', 'Sweet'], v: true },
      { n: 'Walleye', e: '🐟', c: ['Savory'] },
      { n: 'Pork Chop', e: '🍖', c: ['On a Stick', 'Savory'] },
      { n: 'Ice Cream', e: '🍦', c: ['Sweet', 'Dairy'], v: true },
      { n: 'Lemonade', e: '🍋', c: ['Drinks'], v: true, veg: true },
      { n: 'Pickle', e: '🥒', c: ['Savory'], v: true },
      { n: 'Mac & Cheese', e: '🧀', c: ['Savory'], v: true },
      { n: 'Pizza Slice', e: '🍕', c: ['Savory'], v: true },
      { n: 'Nachos', e: '🧀', c: ['Savory'], v: true },
      { n: 'Turkey Leg', e: '🍗', c: ['Savory'] },
      { n: 'Pretzel', e: '🥨', c: ['Savory'], v: true },
      { n: 'Cookies', e: '🍪', c: ['Sweet'], v: true },
      { n: 'Cotton Candy', e: '🍬', c: ['Sweet'], v: true, veg: true },
      { n: 'Egg Roll', e: '🥢', c: ['On a Stick', 'Deep Fried', 'Savory'] },
      { n: 'Tater Tots', e: '🥔', c: ['Deep Fried', 'Savory'], v: true },
      { n: 'Ribs', e: '🍖', c: ['Savory'] },
      { n: 'Taco', e: '🌮', c: ['Savory'] },
      { n: 'Milkshake', e: '🥤', c: ['Drinks', 'Sweet', 'Dairy'], v: true },
      { n: 'Donuts', e: '🍩', c: ['Sweet', 'Deep Fried'], v: true },
      { n: 'Sausage', e: '🌭', c: ['On a Stick', 'Savory'] },
      { n: 'Fries', e: '🍟', c: ['Deep Fried', 'Savory'], v: true, veg: true },
      { n: 'Bao Bun', e: '🥟', c: ['Savory'] },
      { n: 'Sundae', e: '🍨', c: ['Sweet', 'Dairy'], v: true },
      { n: 'Cheesecake', e: '🍰', c: ['Sweet'], v: true },
      { n: 'Wings', e: '🍗', c: ['Savory'] },
      { n: 'Grilled Cheese', e: '🧀', c: ['Savory'], v: true },
    ];
    const styles = ['Classic', 'Deep-Fried', 'Loaded', 'Gourmet', 'Spicy', 'BBQ', 'Garlic', 'Bacon', 'Buffalo',
      'Sweet Chili', 'Maple', 'Cajun', 'Korean', 'Nashville', 'Ranch', 'Truffle', 'Pesto', 'Hot Honey',
      'Jalapeño', 'Everything', 'Birria', 'Pickle-Brined', 'Smoked', 'Caramel', 'Chili-Lime', 'Cheddar',
      'Elote', 'Pizza', 'Reuben', 'Philly', 'Teriyaki', 'Sriracha'];
    const forms = ['', ' Bucket', ' Basket', ' Bites', ' Bowl', ' Wrap', ' Skewer', ' Boat'];
    const seen = new Set(foods.map(f => f.name.toLowerCase()));
    let n = 0;
    outer:
    for (let si = 0; si < styles.length; si++) {
      for (let bi = 0; bi < bases.length; bi++) {
        for (let fi = 0; fi < forms.length; fi++) {
          if (foods.length >= 1600) break outer;
          const base = bases[bi];
          const name = (styles[si] + ' ' + base.n + forms[fi]).trim();
          if (seen.has(name.toLowerCase())) continue;
          seen.add(name.toLowerCase());
          const vendor = vendors[n % vendors.length];
          const diet = [];
          if (base.v && (n % 3 === 0)) diet.push('vegetarian');
          if (base.veg && (n % 4 === 0)) { diet.push('vegan'); diet.push('gluten-free'); }
          foods.push({
            id: 'g' + n, name: name, vendorId: vendor.id, price: 4 + ((n * 3) % 13),
            cats: base.c.slice(), dietary: diet, emoji: base.e, isNew: false,
            soldOut: (n % 53 === 0), desc: 'A fairgrounds favorite from ' + vendor.name + '. One of 1,600+ foods at the Great Minnesota Get-Together.',
          });
          n++;
        }
      }
    }
  })();

  const users = [
    { id: 'u_admin', name: 'Fair Admin',        handle: 'mnfairadmin',  avatar: '🎡', role: 'admin',      verified: true,  bio: 'Keeping the Great Minnesota Get-Together great.', followers: [], following: [], badges: [], banned: false, warned: 0, qualityReviews: 0 },
    { id: 'u_inf2',  name: 'Allison',           handle: 'allisoneats',  avatar: '🌟', role: 'influencer', verified: true,  bio: 'MN\'s fair food authority. My crawl list is your day-one plan.', followers: ['u_inf1', 'u_blog1', 'u_reg1', 'u_reg2'], following: [], badges: ['Verified'], banned: false, warned: 0, qualityReviews: 60 },
    { id: 'u_inf1',  name: 'Maddy Munchies',    handle: 'maddymunchies',avatar: '🎤', role: 'influencer', verified: true,  bio: '400k followers of fair food chaos. If it\'s on a stick, I\'ve rated it.', followers: ['u_reg1', 'u_reg2', 'u_blog1'], following: ['u_blog1'], badges: ['Verified'], banned: false, warned: 0, qualityReviews: 40 },
    { id: 'u_blog1', name: "Ole's Eats",        handle: 'oleseats',     avatar: '📝', role: 'blogger',    verified: false, bio: 'Twin Cities food blog. 12 fairs and counting. Uff da.', followers: ['u_inf1'], following: ['u_inf1', 'u_reg1'], badges: ['Blogger'], banned: false, warned: 0, qualityReviews: 27 },
    { id: 'u_reg1',  name: 'Curd Nerd',         handle: 'curdnerd',     avatar: '🧀', role: 'attendee',   verified: false, bio: 'Squeak connoisseur.', followers: ['u_blog1'], following: ['u_inf1'], badges: [], banned: false, warned: 0, qualityReviews: 8 },
    { id: 'u_reg2',  name: 'Sky Glider Sam',    handle: 'skygliders',   avatar: '🚡', role: 'attendee',   verified: false, bio: 'I judge the fair from above.', followers: [], following: ['u_inf1'], badges: [], banned: false, warned: 0, qualityReviews: 3 },
    { id: 'u_vend1', name: 'Pronto Pup Crew',   handle: 'prontopupmn',  avatar: '🌭', role: 'vendor',     verified: true,  bio: 'Official Pronto Pup vendor account.', followers: [], following: [], badges: [], banned: false, warned: 0, qualityReviews: 0 },
    { id: 'u_vend2', name: 'Mouth Trap Team',   handle: 'mouthtrap',    avatar: '🧀', role: 'vendor',     verified: true,  bio: 'Food Building, since 1978.', followers: [], following: [], badges: [], banned: false, warned: 0, qualityReviews: 0 },
  ];

  const reviews = [
    { id: 'r1',  foodId: 'f3',  userId: 'u_reg1',  rating: 5, text: 'The squeak is REAL. Molten cheese, perfect batter, zero regrets. I waited 20 minutes and would wait 40.', photos: [], likes: ['u_inf1', 'u_blog1'], comments: [{ id: 'c1', userId: 'u_inf1', text: 'The Food Building line is a rite of passage!', ts: now - 2 * D }], reported: false, removed: false, ts: now - 3 * D, vendorResponse: 'Thanks for braving the line — squeak on! 🧀' },
    { id: 'r2',  foodId: 'f1',  userId: 'u_inf1',  rating: 5, text: 'The original. The icon. The reason this app rates things in Pronto Pups. Crispy batter, snappy dog — five out of five of itself.', photos: [], likes: ['u_reg1', 'u_reg2'], comments: [], reported: false, removed: false, ts: now - 2.5 * D, vendorResponse: null },
    { id: 'r3',  foodId: 'f15', userId: 'u_inf1',  rating: 4, text: 'Pickle Pie is the unhinged icon 2026 deserves. Cream cheese and chopped pickle in a crust, ranch-Cholula frosting on top — it walks the line between genius and war crime and lands on genius.', photos: [], likes: ['u_blog1'], comments: [{ id: 'c2', userId: 'u_reg2', text: 'You have convinced me. Adding to my list.', ts: now - 1 * D }], reported: false, removed: false, ts: now - 1.2 * D, vendorResponse: null },
    { id: 'r4',  foodId: 'f2',  userId: 'u_reg2',  rating: 4, text: 'Bucket of warm cookies is a top-3 fair experience. Docked one Pup because I ate too many and had to sit down for a while.', photos: [], likes: [], comments: [], reported: false, removed: false, ts: now - 2 * D, vendorResponse: null },
    { id: 'r5',  foodId: 'f20', userId: 'u_blog1', rating: 2, text: 'The Surf N Turf Burger is a $17 leap of faith and my wallet filed a complaint. Lobster on a fair burger is bold; the execution was uneven and the lobster got lost. Points for audacity.', photos: [], likes: ['u_reg1'], comments: [], reported: false, removed: false, ts: now - 1 * D, vendorResponse: null },
    { id: 'r6',  foodId: 'f8',  userId: 'u_blog1', rating: 5, text: 'Chicken in the Waffle remains the best savory-sweet bite on the fairgrounds. The syrup has a chili warmth that sneaks up on you. Get it early, lines get wild after noon.', photos: [], likes: ['u_inf1'], comments: [], reported: false, removed: false, ts: now - 2.2 * D, vendorResponse: null },
    { id: 'r7',  foodId: 'f17', userId: 'u_reg1',  rating: 5, text: 'Longanisa Cheese Curd Lumpia is my new-food winner this year. Sweet-garlicky Filipino sausage and squeaky curds in a crackly lumpia wrapper — this is what the fair does best.', photos: [], likes: ['u_inf1', 'u_blog1', 'u_reg2'], comments: [], reported: false, removed: false, ts: now - 0.5 * D, vendorResponse: null },
    { id: 'r8',  foodId: 'f5',  userId: 'u_reg2',  rating: 5, text: 'Two dollars. Unlimited milk. The greatest deal in American food service. I had six cups and regret nothing.', photos: [], likes: ['u_reg1'], comments: [], reported: false, removed: false, ts: now - 4 * D, vendorResponse: null },
    { id: 'r9',  foodId: 'f10', userId: 'u_reg2',  rating: 1, text: 'This booth SCAMMED me!! The candy bar was tiny and the guy was a total [removed]. AVOID!!!', photos: [], likes: [], comments: [], reported: true, removed: false, ts: now - 0.8 * D, vendorResponse: null },
    { id: 'r10', foodId: 'f12', userId: 'u_inf1',  rating: 4, text: 'Walleye cakes are the classiest thing you can eat while standing next to a llama barn. Crispy edges, tender center.', photos: [], likes: [], comments: [], reported: false, removed: false, ts: now - 3.5 * D, vendorResponse: null },
    { id: 'r11', foodId: 'f21', userId: 'u_reg1',  rating: 3, text: 'The Butter Brew Mustache Pretzel is cute and the butterscotch-caramel sugar is nice, but it leans very sweet for a pretzel. The soft-serve dip carries it. Split one.', photos: [], likes: [], comments: [], reported: false, removed: false, ts: now - 0.3 * D, vendorResponse: null },
    { id: 'r12', foodId: 'f22b', userId: 'u_blog1', rating: 4, text: 'Mini donuts: eternal. Hot, cinnamon-sugared, gone in minutes. The bucket format is a trap and I fall for it every year.', photos: [], likes: ['u_reg2'], comments: [], reported: false, removed: false, ts: now - 5 * D, vendorResponse: null },
  ];

  const lists = [
    { id: 'l0', name: 'Allison\'s Fair Food Crawl', ownerId: 'u_inf2', foodIds: ['f15', 'f17', 'f1', 'f38', 'f3', 'f34', 'f2', 'f5'], privacy: 'public', featured: true, likes: ['u_inf1', 'u_blog1', 'u_reg1', 'u_reg2'], ratings: { u_reg1: 5, u_reg2: 5, u_blog1: 5, u_inf1: 4 }, views: 9214, comments: [], collaborators: [], ts: now - 7 * D },
    { id: 'l1', name: 'Maddy\'s Top 10 Must-Eats 2026', ownerId: 'u_inf1', foodIds: ['f1', 'f3', 'f8', 'f2', 'f17', 'f12', 'f6', 'f22b', 'f15', 'f5'], privacy: 'public', featured: true, likes: ['u_reg1', 'u_reg2', 'u_blog1'], ratings: { u_reg1: 5, u_reg2: 5, u_blog1: 4 }, views: 4821, comments: [{ id: 'lc1', userId: 'u_reg1', text: 'Used this list all day Saturday — flawless routing!', ts: now - 1 * D }], collaborators: [], ts: now - 6 * D },
    { id: 'l2', name: 'New This Year: Worth the Hype?', ownerId: 'u_inf1', foodIds: ['f15', 'f16', 'f17', 'f29', 'f42', 'f34', 'f38', 'f49'], privacy: 'public', featured: true, likes: ['u_blog1'], ratings: { u_blog1: 4, u_reg2: 4 }, views: 2214, comments: [], collaborators: [], ts: now - 4 * D },
    { id: 'l3', name: 'Ole\'s Classic Circuit', ownerId: 'u_blog1', foodIds: ['f1', 'f5', 'f6', 'f13', 'f22b'], privacy: 'public', featured: false, likes: ['u_reg1'], ratings: { u_reg1: 4 }, views: 640, comments: [], collaborators: [], ts: now - 3 * D },
    { id: 'l4', name: 'Kids Will Love', ownerId: 'u_reg1', foodIds: ['f2', 'f5', 'f47', 'f22b'], privacy: 'friends', featured: false, likes: [], ratings: {}, views: 25, comments: [], collaborators: [], ts: now - 2 * D },
  ];

  const reports = [
    { id: 'rep1', type: 'review', targetId: 'r9', reason: 'Harassment / inappropriate language toward vendor', reporterId: 'u_blog1', status: 'pending', ts: now - 0.5 * D },
  ];

  const vendorRequests = [
    { id: 'vr1', vendorId: 'v4', requesterName: 'Fresh Fries LLC', email: 'ops@freshfriesmn.com', note: 'We are the booth operators — license #MN-4482.', status: 'pending', ts: now - 1 * D },
  ];

  const activity = [
    { id: 'a1', userId: 'u_inf1',  text: 'reviewed Pickle Pie — 4 Pups', link: '#/food/f15', ts: now - 1.2 * D },
    { id: 'a2', userId: 'u_reg1',  text: 'reviewed Longanisa Cheese Curd Lumpia — 5 Pups', link: '#/food/f17', ts: now - 0.5 * D },
    { id: 'a3', userId: 'u_blog1', text: 'created list "Ole\'s Classic Circuit"', link: '#/list/l3', ts: now - 3 * D },
    { id: 'a4', userId: 'u_inf1',  text: 'published featured list "New This Year: Worth the Hype?"', link: '#/list/l2', ts: now - 4 * D },
  ];

  const amenities = [
    { type: 'restroom', label: 'Restrooms', icon: '🚻', spots: [{ x: 335, y: 355 }, { x: 600, y: 355 }, { x: 415, y: 265 }, { x: 335, y: 450 }] },
    { type: 'atm',      label: 'ATMs',      icon: '🏧', spots: [{ x: 250, y: 265 }, { x: 500, y: 450 }] },
    { type: 'firstaid', label: 'First Aid', icon: '⛑️', spots: [{ x: 415, y: 355 }] },
  ];

  return {
    version: DATA_VERSION,
    currentUserId: null,
    defaultListId: 'l0', // Allison's list — the default sponsored placement for every user
    users, vendors, foods, reviews, lists, reports, vendorRequests, activity, amenities,
    notifications: [
      { id: 'n1', userId: 'u_inf1', userIdNote: '', text: 'Curd Nerd commented on your list "Maddy\'s Top 10 Must-Eats 2026"', link: '#/list/l1', ts: now - 1 * D, read: false },
    ],
    challenges: [
      { id: 'ch1', text: 'Daily Challenge: Try 3 deep-fried foods today 🍟', progressCat: 'Deep Fried', goal: 3 },
    ],
    pushLog: [],
    analytics: {
      dau: [4200, 5100, 6800, 9400, 12100, 15800, 14200],
      days: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed'],
      topSearches: ['pickle pie', 'cheese curd lumpia', 'apple donut ham grinder', 'cheese curds', 'pronto pup'],
    },
  };
}
