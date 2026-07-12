/* MN Fair Foodie Guide — data layer + seed data */
/* global localStorage */

const DB_KEY = 'fairfoodie_v1';
let S = null; // global app state

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
  try { store.setItem(DB_KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); }
}

function loadState() {
  try { S = JSON.parse(store.getItem(DB_KEY)); } catch (e) { S = null; }
  if (!S || S.version !== 4) { S = seedState(); save(); }
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
function foodRating(foodId) {
  const rs = foodReviews(foodId);
  if (!rs.length) return { avg: 0, count: 0 };
  return { avg: rs.reduce((a, r) => a + r.rating, 0) / rs.length, count: rs.length };
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

  const vendors = [
    { id: 'v1',  name: 'Pronto Pup',                 x: 355, y: 458, hours: '9am–11pm', verified: true,  ownerUserId: 'u_vend1', desc: 'The original corn dog — a fair icon since 1947.', specials: 'Buy 4, get a free lemonade!' },
    { id: 'v2',  name: "Sweet Martha's Cookie Jar",  x: 585, y: 462, hours: '9am–11pm', verified: true,  ownerUserId: null, desc: 'Warm chocolate chip cookies by the bucket.', specials: '' },
    { id: 'v3',  name: 'The Mouth Trap Cheese Curds',x: 640, y: 330, hours: '8am–10pm', verified: true,  ownerUserId: 'u_vend2', desc: 'Legendary squeaky curds in the Food Building.', specials: '' },
    { id: 'v4',  name: 'Fresh French Fries',         x: 300, y: 355, hours: '9am–10pm', verified: false, ownerUserId: null, desc: 'Hot, salty, in a bucket. Bring ketchup courage.', specials: '' },
    { id: 'v5',  name: 'All You Can Drink Milk',     x: 445, y: 355, hours: '9am–9pm',  verified: true,  ownerUserId: null, desc: '$2 bottomless cup, courtesy of MN dairy farmers.', specials: '' },
    { id: 'v6',  name: 'Corn Roast',                 x: 520, y: 460, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Butter-dunked roasted sweet corn.', specials: '' },
    { id: 'v7',  name: 'Hamline Church Dining Hall', x: 235, y: 240, hours: '8am–8pm',  verified: true,  ownerUserId: null, desc: 'Serving fairgoers since 1897.', specials: 'Pie of the day: rhubarb' },
    { id: 'v8',  name: 'Turkey To Go',               x: 385, y: 242, hours: '10am–9pm', verified: true,  ownerUserId: null, desc: 'Giant turkey sandwiches from MN growers.', specials: '' },
    { id: 'v9',  name: 'The Blue Barn',              x: 165, y: 455, hours: '8am–11pm', verified: true,  ownerUserId: null, desc: 'West End favorite with inventive fair eats.', specials: '' },
    { id: 'v10', name: "LuLu's Public House",        x: 205, y: 358, hours: '10am–11pm',verified: true,  ownerUserId: null, desc: 'Rooftop bar & scratch kitchen.', specials: '' },
    { id: 'v11', name: 'Nordic Waffles',             x: 250, y: 460, hours: '8am–10pm', verified: true,  ownerUserId: null, desc: 'Fresh-rolled Norwegian waffles.', specials: '' },
    { id: 'v12', name: 'Que Viet',                   x: 555, y: 242, hours: '9am–10pm', verified: true,  ownerUserId: null, desc: 'Egg rolls on a stick and Vietnamese favorites.', specials: '' },
    { id: 'v13', name: 'Deep Fried Dreams',          x: 470, y: 130, hours: '10am–11pm',verified: false, ownerUserId: null, desc: 'If it fits in the fryer, we fry it.', specials: '' },
    { id: 'v14', name: 'Minnesnowta Sno-Cones',      x: 620, y: 130, hours: '10am–9pm', verified: false, ownerUserId: null, desc: 'Shaved ice with local berry syrups.', specials: '' },
    { id: 'v15', name: 'Farmers Union Coffee Shop',  x: 300, y: 130, hours: '6am–9pm',  verified: true,  ownerUserId: null, desc: 'Co-op coffee, nitro cold press.', specials: '' },
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
    { id: 'f15', name: 'Dill Pickle Lemonade',              vendorId: 'v9',  price: 7,    cats: ['Drinks'],                           dietary: ['vegan', 'gluten-free', 'dairy-free'], emoji: '🥒', isNew: true,  soldOut: false, desc: 'NEW! Sweet, sour, briny. You will either text everyone about it or never speak of it again.' },
    { id: 'f16', name: 'Hot Honey Chicken on a Stick',      vendorId: 'v9',  price: 10,   cats: ['On a Stick', 'Savory'],             dietary: ['dairy-free'],                    emoji: '🍗', isNew: true,  soldOut: false, desc: 'NEW! Crispy chicken skewer glazed with hot honey and pickled chilis.' },
    { id: 'f17', name: 'Sweet Corn Ice Cream Sandwich',     vendorId: 'v6',  price: 8,    cats: ['Sweet', 'Dairy'],                   dietary: ['vegetarian'],                    emoji: '🍦', isNew: true,  soldOut: false, desc: 'NEW! Sweet corn custard between cornbread cookies. Peak Midwest.' },
    { id: 'f18', name: 'Deep-Fried Ranch Bites',            vendorId: 'v13', price: 9,    cats: ['Deep Fried', 'Savory'],             dietary: ['vegetarian'],                    emoji: '🥟', isNew: true,  soldOut: false, desc: 'NEW! Cubes of frozen ranch, breaded and fried. Chaotic. Delicious?' },
    { id: 'f19', name: 'Bánh Mì Brat',                      vendorId: 'v12', price: 11,   cats: ['Savory'],                           dietary: ['dairy-free'],                    emoji: '🌶️', isNew: true,  soldOut: false, desc: 'NEW! MN bratwurst, bánh mì style — pickled veg, jalapeño, cilantro.' },
    { id: 'f20', name: 'Wild Berry Sno-Cone',               vendorId: 'v14', price: 6,    cats: ['Sweet', 'Drinks'],                  dietary: ['vegan', 'gluten-free', 'dairy-free'], emoji: '🍧', isNew: false, soldOut: true,  desc: 'Shaved ice with north-shore berry syrup.' },
    { id: 'f21', name: 'Pickle Pizza Slice',                vendorId: 'v10', price: 8,    cats: ['Savory'],                           dietary: ['vegetarian'],                    emoji: '🍕', isNew: true,  soldOut: false, desc: 'NEW! Garlic-dill cream sauce, mozzarella, ribbons of pickle.' },
    { id: 'f22', name: 'Mini Donut Bucket',                 vendorId: 'v13', price: 10,   cats: ['Sweet', 'Deep Fried'],              dietary: ['vegetarian'],                    emoji: '🍩', isNew: false, soldOut: false, desc: 'Cinnamon-sugar minis, hot from the fryer.' },
    { id: 'f23', name: 'Nitro Maple Cream Cold Brew',       vendorId: 'v15', price: 7.5,  cats: ['Drinks', 'Dairy'],                  dietary: ['vegetarian', 'gluten-free'],     emoji: '🥤', isNew: true,  soldOut: false, desc: 'NEW! Nitro cold press with MN maple cream float.' },
    { id: 'f24', name: 'Swedish Meatball Sundae',           vendorId: 'v7',  price: 9.5,  cats: ['Savory'],                           dietary: [],                                emoji: '🍝', isNew: true,  soldOut: false, desc: 'NEW! Mashed potatoes, meatballs, gravy, lingonberry "cherry" on top.' },
  ];

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
    { id: 'r3',  foodId: 'f15', userId: 'u_inf1',  rating: 4, text: 'Dill Pickle Lemonade walks the line between genius and war crime and somehow lands on genius. Briny, sweet, weirdly refreshing on a hot day.', photos: [], likes: ['u_blog1'], comments: [{ id: 'c2', userId: 'u_reg2', text: 'You have convinced me. Adding to my list.', ts: now - 1 * D }], reported: false, removed: false, ts: now - 1.2 * D, vendorResponse: null },
    { id: 'r4',  foodId: 'f2',  userId: 'u_reg2',  rating: 4, text: 'Bucket of warm cookies is a top-3 fair experience. Docked one Pup because I ate too many and had to sit down for a while.', photos: [], likes: [], comments: [], reported: false, removed: false, ts: now - 2 * D, vendorResponse: null },
    { id: 'r5',  foodId: 'f18', userId: 'u_blog1', rating: 2, text: 'Deep-Fried Ranch Bites are exactly what they sound like, and I mean that as a warning. The concept is bold; my stomach filed a complaint. Points for audacity.', photos: [], likes: ['u_reg1'], comments: [], reported: false, removed: false, ts: now - 1 * D, vendorResponse: null },
    { id: 'r6',  foodId: 'f8',  userId: 'u_blog1', rating: 5, text: 'Chicken in the Waffle remains the best savory-sweet bite on the fairgrounds. The syrup has a chili warmth that sneaks up on you. Get it early, lines get wild after noon.', photos: [], likes: ['u_inf1'], comments: [], reported: false, removed: false, ts: now - 2.2 * D, vendorResponse: null },
    { id: 'r7',  foodId: 'f17', userId: 'u_reg1',  rating: 5, text: 'Sweet Corn Ice Cream Sandwich is the new-food winner this year. Tastes like August in Minnesota.', photos: [], likes: ['u_inf1', 'u_blog1', 'u_reg2'], comments: [], reported: false, removed: false, ts: now - 0.5 * D, vendorResponse: null },
    { id: 'r8',  foodId: 'f5',  userId: 'u_reg2',  rating: 5, text: 'Two dollars. Unlimited milk. The greatest deal in American food service. I had six cups and regret nothing.', photos: [], likes: ['u_reg1'], comments: [], reported: false, removed: false, ts: now - 4 * D, vendorResponse: null },
    { id: 'r9',  foodId: 'f10', userId: 'u_reg2',  rating: 1, text: 'This booth SCAMMED me!! The candy bar was tiny and the guy was a total [removed]. AVOID!!!', photos: [], likes: [], comments: [], reported: true, removed: false, ts: now - 0.8 * D, vendorResponse: null },
    { id: 'r10', foodId: 'f12', userId: 'u_inf1',  rating: 4, text: 'Walleye cakes are the classiest thing you can eat while standing next to a llama barn. Crispy edges, tender center.', photos: [], likes: [], comments: [], reported: false, removed: false, ts: now - 3.5 * D, vendorResponse: null },
    { id: 'r11', foodId: 'f21', userId: 'u_reg1',  rating: 3, text: 'Pickle Pizza: better than expected, worse than hoped. The dill cream sauce carries it. Split a slice before committing.', photos: [], likes: [], comments: [], reported: false, removed: false, ts: now - 0.3 * D, vendorResponse: null },
    { id: 'r12', foodId: 'f22', userId: 'u_blog1', rating: 4, text: 'Mini donuts: eternal. Hot, cinnamon-sugared, gone in minutes. The bucket format is a trap and I fall for it every year.', photos: [], likes: ['u_reg2'], comments: [], reported: false, removed: false, ts: now - 5 * D, vendorResponse: null },
  ];

  const lists = [
    { id: 'l0', name: 'Allison\'s Fair Food Crawl', ownerId: 'u_inf2', foodIds: ['f3', 'f1', 'f17', 'f8', 'f2', 'f6', 'f22', 'f5'], privacy: 'public', featured: true, likes: ['u_inf1', 'u_blog1', 'u_reg1', 'u_reg2'], ratings: { u_reg1: 5, u_reg2: 5, u_blog1: 5, u_inf1: 4 }, views: 9214, comments: [], collaborators: [], ts: now - 7 * D },
    { id: 'l1', name: 'Maddy\'s Top 10 Must-Eats 2026', ownerId: 'u_inf1', foodIds: ['f1', 'f3', 'f8', 'f2', 'f17', 'f12', 'f6', 'f22', 'f15', 'f5'], privacy: 'public', featured: true, likes: ['u_reg1', 'u_reg2', 'u_blog1'], ratings: { u_reg1: 5, u_reg2: 5, u_blog1: 4 }, views: 4821, comments: [{ id: 'lc1', userId: 'u_reg1', text: 'Used this list all day Saturday — flawless routing!', ts: now - 1 * D }], collaborators: [], ts: now - 6 * D },
    { id: 'l2', name: 'New This Year: Worth the Hype?', ownerId: 'u_inf1', foodIds: ['f15', 'f16', 'f17', 'f18', 'f19', 'f21', 'f23', 'f24'], privacy: 'public', featured: true, likes: ['u_blog1'], ratings: { u_blog1: 4, u_reg2: 4 }, views: 2214, comments: [], collaborators: [], ts: now - 4 * D },
    { id: 'l3', name: 'Ole\'s Classic Circuit', ownerId: 'u_blog1', foodIds: ['f1', 'f5', 'f6', 'f13', 'f22'], privacy: 'public', featured: false, likes: ['u_reg1'], ratings: { u_reg1: 4 }, views: 640, comments: [], collaborators: [], ts: now - 3 * D },
    { id: 'l4', name: 'Kids Will Love', ownerId: 'u_reg1', foodIds: ['f2', 'f5', 'f20', 'f22'], privacy: 'friends', featured: false, likes: [], ratings: {}, views: 25, comments: [], collaborators: [], ts: now - 2 * D },
  ];

  const reports = [
    { id: 'rep1', type: 'review', targetId: 'r9', reason: 'Harassment / inappropriate language toward vendor', reporterId: 'u_blog1', status: 'pending', ts: now - 0.5 * D },
  ];

  const vendorRequests = [
    { id: 'vr1', vendorId: 'v4', requesterName: 'Fresh Fries LLC', email: 'ops@freshfriesmn.com', note: 'We are the booth operators — license #MN-4482.', status: 'pending', ts: now - 1 * D },
  ];

  const activity = [
    { id: 'a1', userId: 'u_inf1',  text: 'reviewed Dill Pickle Lemonade — 4 Pups 🌭', link: '#/food/f15', ts: now - 1.2 * D },
    { id: 'a2', userId: 'u_reg1',  text: 'reviewed Sweet Corn Ice Cream Sandwich — 5 Pups 🌭', link: '#/food/f17', ts: now - 0.5 * D },
    { id: 'a3', userId: 'u_blog1', text: 'created list "Ole\'s Classic Circuit"', link: '#/list/l3', ts: now - 3 * D },
    { id: 'a4', userId: 'u_inf1',  text: 'published featured list "New This Year: Worth the Hype?"', link: '#/list/l2', ts: now - 4 * D },
  ];

  const amenities = [
    { type: 'restroom', label: 'Restrooms', icon: '🚻', spots: [{ x: 130, y: 300 }, { x: 430, y: 415 }, { x: 660, y: 200 }] },
    { type: 'atm',      label: 'ATMs',      icon: '🏧', spots: [{ x: 275, y: 415 }, { x: 560, y: 300 }] },
    { type: 'firstaid', label: 'First Aid', icon: '⛑️', spots: [{ x: 500, y: 200 }] },
  ];

  return {
    version: 4,
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
      topSearches: ['cheese curds', 'pronto pup', 'pickle lemonade', 'cookies', 'corn'],
    },
  };
}
