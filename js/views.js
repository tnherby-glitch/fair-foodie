/* Views: onboarding, home, search, food detail, lists */
/* global S, save, uid, me, getUser, getFood, getVendor, getList, getReview, foodReviews, foodRating, listCountForFood, trendingFoods, notify, myNotifications, logActivity, esc, timeAgo, toast, pushToast, openModal, closeModal, pups, ratingLine, avatarHtml, userName, foodPills, foodCardHtml, foodMiniCardHtml, updateBell, updateAvatarBtn, readImage, render */

/* ================= ONBOARDING ================= */
let obAvatar = '😀';
let obPhoto = null;
let obNameVal = '', obEmailVal = '';

function obStash() {
  const n = document.getElementById('obName');
  const e = document.getElementById('obEmail');
  if (n) obNameVal = n.value;
  if (e) obEmailVal = e.value;
}

let obSent = false; // "check your email" state after a magic link is sent

function viewOnboarding(el) {
  const emojis = ['😀', '🤠', '🧑‍🌾', '🦆', '🐄', '🌽', '🧀', '🎡', '🎪', '🦄'];
  const realAuth = typeof authConfigured === 'function' && authConfigured();
  const mark = '<div class="onboard-mark" aria-hidden="true"><svg viewBox="0 0 240 320" width="72" height="96"><path d="M108 200 L118 294 Q120 303 122 294 L132 200 Z" fill="#8C5A2B"/><rect x="72" y="26" width="96" height="184" rx="48" fill="#E89C31"/><rect x="86" y="46" width="15" height="42" rx="7.5" fill="#F6C778"/><path d="M87 138 L105 98 L120 142 L135 98 L153 138" fill="none" stroke="#D64533" stroke-width="14.5" stroke-linecap="round" stroke-linejoin="round" transform="rotate(-4 120 120)"/></svg></div>';

  if (realAuth && obSent) {
    el.innerHTML = '<div class="onboard">' + mark +
      '<h1>Check your email</h1>' +
      '<p class="muted">We sent a sign-in link to <b>' + esc(obEmailVal) + '</b>. Tap it on this device and you\'ll land right back here.</p>' +
      '<button class="btn secondary block" style="margin-top:8px" onclick="obSent=false;render()">Use a different email</button>' +
      '<div class="muted" style="margin-top:16px">No email after a minute? Check spam, or try again.</div>' +
      demoBlock() + '</div>';
    return;
  }

  const nativeApp = typeof isNativeApp === 'function' && isNativeApp();
  el.innerHTML =
    '<div class="onboard">' + mark +
    '<h1>Foodie Finder</h1>' +
    '<p class="muted">Find, rate, and share the best eats at the Great Minnesota Get-Together.</p>' +
    '<div class="card" style="text-align:left">' +
    '<h2 style="font-size:16px;margin:0 0 4px">Create your profile</h2>' +
    '<p class="muted" style="margin:0 0 12px">' + (nativeApp ? 'Sign in with your Apple ID — one tap, no password.' : (realAuth ? 'We\'ll email you a one-tap sign-in link — no password.' : 'Pick a name and jump in.')) + '</p>' +
    (nativeApp ? '' : oauthButtons()) +
    '<label class="field">Display name<input type="text" id="obName" maxlength="30" placeholder="e.g. Corn Dog Connie" value="' + esc(obNameVal) + '"></label>' +
    (realAuth && !nativeApp ? '<label class="field">Email<input type="email" id="obEmail" placeholder="you@example.com" value="' + esc(obEmailVal) + '"></label>' : '') +
    '<div class="field" style="font-size:13px;font-weight:700">Pick an avatar <span class="muted" style="font-weight:400">(or upload a photo, max 5MB)</span>' +
    '<div class="avatar-pick" role="group" aria-label="Choose avatar">' +
    emojis.map(e => '<button type="button" class="' + (obAvatar === e && !obPhoto ? 'on' : '') + '" onclick="obPick(\'' + e + '\')" aria-label="Avatar ' + e + '">' + e + '</button>').join('') +
    '</div>' +
    '<input type="file" id="obFile" accept="image/png,image/jpeg" aria-label="Upload profile photo" onchange="obUpload(this)">' +
    (obPhoto ? '<div class="muted" style="margin-top:6px">✅ Photo uploaded</div>' : '') +
    '</div>' +
    (nativeApp ?
      '<button class="btn block" id="obGo" onclick="signInWithAppleNative()"> Continue with Apple</button>' :
      '<button class="btn block" id="obGo" onclick="obCreate()">' + (realAuth ? 'Email me a sign-in link' : 'Continue') + '</button>') +
    '</div>' +
    demoBlock() + '</div>';
}
function oauthButtons() {
  const provs = typeof oauthProviders === 'function' ? oauthProviders() : [];
  if (!provs.length) return '';
  const label = { google: '🔵 Continue with Google', apple: '🍎 Continue with Apple' };
  return provs.map(p => '<button class="oauth-btn" onclick="signInWithProvider(\'' + p + '\')">' + (label[p] || ('Continue with ' + p)) + '</button>').join('') +
    '<div class="muted" style="text-align:center;margin:6px 0 12px">— or with email —</div>';
}
function demoBlock() {
  if (typeof demoMode === 'function' && !demoMode()) return ''; // hidden in production
  return '<div class="muted" style="margin:16px 0 6px">Just exploring? Jump in as a demo persona:</div>' +
    '<div class="chip-row" style="justify-content:center">' +
    '<button class="chip" onclick="obDemo(\'u_inf2\')">🌟 Allison (influencer)</button>' +
    '<button class="chip" onclick="obDemo(\'u_blog1\')">📝 Blogger</button>' +
    '<button class="chip" onclick="obDemo(\'u_admin\')">🎡 Admin</button>' +
    '</div>';
}
function obPick(e) { obStash(); obAvatar = e; obPhoto = null; render(); }
function obUpload(input) {
  obStash();
  readImage(input.files[0], 5, data => { obPhoto = data; toast('Profile photo added'); render(); });
}
function _obProfileData() {
  const name = (document.getElementById('obName') || {}).value ? document.getElementById('obName').value.trim() : obNameVal;
  return {
    name: name || 'Fairgoer',
    handle: (name || 'fairgoer').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'fairgoer',
    avatar: obPhoto || obAvatar,
  };
}
async function obCreate() {
  const realAuth = typeof authConfigured === 'function' && authConfigured();
  const name = document.getElementById('obName').value.trim();
  if (!name) { toast('Please enter a display name'); return; }
  if (!realAuth) { finishSignupLocal(name); return; }
  const email = (document.getElementById('obEmail').value || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Enter a valid email address'); return; }
  obEmailVal = email; obNameVal = name;
  const btn = document.getElementById('obGo');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
  const res = await sendMagicLink(email, _obProfileData());
  if (res.ok) { obSent = true; render(); }
  else { toast(res.error || 'Could not send the link. Try again.'); if (btn) { btn.disabled = false; btn.textContent = 'Email me a sign-in link'; } }
}
/* local (no-backend) signup — used only when accounts aren't configured */
function finishSignupLocal(name) {
  const u = {
    id: uid('u'), name, handle: name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'fairgoer',
    avatar: obPhoto || obAvatar, role: 'attendee', verified: false,
    bio: 'Here for the food.', followers: [], following: ['u_inf2', 'u_inf1'],
    badges: [], banned: false, warned: 0, qualityReviews: 0,
  };
  S.users.push(u);
  S.currentUserId = u.id;
  ['u_inf2', 'u_inf1'].forEach(id => {
    const inf = getUser(id);
    if (inf && !inf.followers.includes(u.id)) inf.followers.push(u.id);
  });
  save();
  toast('Welcome, ' + name + '! 🎪');
  if (resumePendingShare()) { render(); return; }
  location.hash = '#/home';
  render();
}
function obDemo(userId) {
  S.currentUserId = userId;
  save();
  toast('Signed in as ' + getUser(userId).name);
  if (resumePendingShare()) { render(); return; }
  location.hash = '#/home';
  render();
}

/* ================= HOME ================= */
function viewHome(el) {
  const u = me();
  const featured = sponsoredLists();
  // official new foods lead the carousel; cap it — the full set lives in search
  const fresh = S.foods.filter(f => f.official).concat(S.foods.filter(f => f.isNew && !f.official)).slice(0, 14);
  const trend = trendingFoods(6);

  el.innerHTML =
    '<div class="greet">Hungry, ' + esc(u.name.split(' ')[0]) + '?</div>' +
    exploreToggleHtml('foods') +
    '<a class="searchpill" href="#/search" aria-label="Search foods and vendors">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4" stroke-linecap="round"/></svg>' +
    '<span>Find your next bite<br><span class="muted">' + S.foods.length + ' foods · ' + S.vendors.length + ' vendors · new for 2026</span></span></a>' +

    '<div class="chip-row scroll" role="group" aria-label="Browse by category">' +
    ['Deep Fried', 'On a Stick', 'Sweet', 'Savory', 'Drinks'].map(c =>
      '<button class="chip" onclick="location.hash=\'#/search?cat=' + c + '\'">' + c + '</button>').join('') +
    '</div>' +

    '<div class="section-title"><span>Featured lists</span><a class="see-all" href="#/lists">Show all</a></div>' +
    '<div class="hlist" role="list">' +
    featured.map(l => {
      const owner = getUser(l.ownerId);
      const first = getFood(l.foodIds[0]);
      return '<a class="pcard" role="listitem" href="#/list/' + l.id + '">' +
        (first ? photoHtml(first) : '<div class="photo"></div>') +
        '<div class="pcard-body">' +
        '<div class="sub" style="font-size:11px;letter-spacing:.3px;margin:0 0 2px">Sponsored' + (l.id === S.defaultListId ? ' · Fair pick' : '') + '</div>' +
        '<div class="pcard-top"><span class="pcard-title">' + esc(l.name) + '</span>' +
        (listRating(l).count ? '<span class="rate">' + pupOne(true) + ' ' + listRating(l).avg.toFixed(1) + '</span>' : '') + '</div>' +
        '<div class="sub">' + l.foodIds.length + ' foods · ' + l.views.toLocaleString() + ' views</div>' +
        '<div class="feat-owner">' + avatarHtml(owner, 'av') + '<span>' + userName(owner) + '</span></div>' +
        '</div></a>';
    }).join('') +
    '</div>' +

    '<div class="section-title"><span>New this year</span><a class="see-all" href="#/new">See all ' + S.foods.filter(f => f.official).length + '</a></div>' +
    '<div class="hlist" role="list">' + fresh.map(foodMiniCardHtml).join('') + '</div>' +

    '<div class="section-title"><span>Vendors to explore</span><a class="see-all" href="#/vendors">See all ' + S.vendors.length + '</a></div>' +
    '<div class="hlist" role="list">' + featuredVendors(12).map(([v, c]) => vendorPcardHtml(v, c)).join('') + '</div>' +

    '<div class="section-title"><span>Trending on the midway</span></div>' +
    '<div class="grid2">' + trend.map(foodCardHtml).join('') + '</div>';
}

/* Explore has two browse modes — Foods (default) and Vendors — as a segmented
   toggle, so you can flip to an alphabetical, photo-forward vendor directory. */
function exploreToggleHtml(active) {
  return '<div class="segmented" role="tablist" aria-label="Browse foods or vendors">' +
    '<a class="seg ' + (active === 'foods' ? 'on' : '') + '" role="tab" aria-selected="' + (active === 'foods') + '" href="#/home">Foods</a>' +
    '<a class="seg ' + (active === 'vendors' ? 'on' : '') + '" role="tab" aria-selected="' + (active === 'vendors') + '" href="#/vendors">Vendors</a>' +
    '</div>';
}

/* ================= VENDOR DIRECTORY ================= */
const vendorDir = { q: '' };
let _vendorCountCache = null, _vendorCountRev = -1;
function vendorItemCounts() {
  if (_vendorCountRev === dataRev && _vendorCountCache) return _vendorCountCache;
  const m = Object.create(null);
  for (const f of S.foods) m[f.vendorId] = (m[f.vendorId] || 0) + 1;
  _vendorCountCache = m; _vendorCountRev = dataRev;
  return m;
}
/* a photo-forward sampling of vendors for the home carousel: new stands first,
   then those with the fullest menus — all with a real storefront photo. */
function featuredVendors(n) {
  const counts = vendorItemCounts();
  return S.vendors.filter(v => v.photo)
    .map(v => [v, counts[v.id] || 0])
    .sort((a, b) => ((b[0].newVend || b[0].official ? 1 : 0) - (a[0].newVend || a[0].official ? 1 : 0)) || (b[1] - a[1]))
    .slice(0, n || 12);
}
function viewVendors(el) {
  const q = vendorDir.q.trim().toLowerCase();
  let vendors = S.vendors.slice();
  if (q) vendors = vendors.filter(v => v.name.toLowerCase().includes(q) || (v.loc || '').toLowerCase().includes(q));
  vendors.sort((a, b) => a.name.localeCompare(b.name));
  const counts = vendorItemCounts();
  el.innerHTML =
    exploreToggleHtml('vendors') +
    '<div class="searchbox">' +
    '<input type="search" id="vendorSearch" placeholder="Search ' + S.vendors.length + ' vendors" value="' + esc(vendorDir.q) + '" ' +
    'aria-label="Search vendors" autocomplete="off" oninput="vendorTyped(this.value)"></div>' +
    '<div class="muted" style="margin:2px 2px 8px;font-size:12px">' + vendors.length + ' vendor' + (vendors.length === 1 ? '' : 's') + (q ? ' matching “' + esc(vendorDir.q) + '”' : ' · A–Z') + '</div>' +
    '<div id="vendorList">' + vendors.map(v => vendorRowHtml(v, counts[v.id] || 0)).join('') +
    (vendors.length ? '' : '<div class="empty"><span class="big">🔍</span>No vendors match that search.</div>') + '</div>';
}
function vendorTyped(v) {
  vendorDir.q = v;
  // update just the list + count so the search field keeps focus
  const q = v.trim().toLowerCase();
  let vendors = S.vendors.slice();
  if (q) vendors = vendors.filter(x => x.name.toLowerCase().includes(q) || (x.loc || '').toLowerCase().includes(q));
  vendors.sort((a, b) => a.name.localeCompare(b.name));
  const counts = vendorItemCounts();
  const list = document.getElementById('vendorList');
  if (list) list.innerHTML = vendors.map(x => vendorRowHtml(x, counts[x.id] || 0)).join('') +
    (vendors.length ? '' : '<div class="empty"><span class="big">🔍</span>No vendors match that search.</div>');
}
/* photo-forward vendor card for horizontal carousels */
function vendorPcardHtml(v, count) {
  let photo;
  if (v.photo) {
    photo = '<div class="photo" role="img" aria-label="' + esc(v.name) + '" style="background-image:url(' + v.photo + ')"></div>';
  } else {
    const f = S.foods.find(x => x.vendorId === v.id && (x.heroImg || x.photo || (typeof foodPhoto === 'function' && foodPhoto(x))));
    photo = f ? photoHtml(f) : '<div class="photo" style="background:linear-gradient(140deg,#f0ede6,#e2ddd2)"><span class="ph-emoji" aria-hidden="true">🏪</span></div>';
  }
  return '<a class="pcard" href="#/vendor/' + v.id + '" aria-label="' + esc(v.name) + '">' + photo +
    '<div class="pcard-body"><div class="pcard-top"><span class="pcard-title">' + esc(v.name) + '</span></div>' +
    '<div class="sub">' + count + ' item' + (count === 1 ? '' : 's') + (v.newVend || v.official ? ' · New 2026' : '') + '</div></div></a>';
}
function vendorRowHtml(v, count) {
  const bestNew = v.newVend || (v.official);
  const area = (v.loc || '').split(/ between | on | at |, /)[0]
    .replace(/^(North|South|East|West|Northeast|Northwest|Southeast|Southwest)\s+(side|corner|end)?\s*(of\s+)?/i, '').trim();
  return '<a class="card list-row" href="#/vendor/' + v.id + '">' +
    vendorThumbHtml(v) +
    '<span class="grow"><b>' + esc(v.name) + (v.verified ? ' <span class="vbadge" title="Verified">✔</span>' : '') + '</b>' +
    '<div class="muted">' + count + ' item' + (count === 1 ? '' : 's') + (area ? ' · ' + esc(area.length > 34 ? area.slice(0, 32) + '…' : area) : '') + '</div></span>' +
    (bestNew ? '<span class="pill new">New</span>' : '') + '</a>';
}

/* ================= NEW THIS YEAR ================= */
function viewNew(el) {
  const official = S.foods.filter(f => f.official);
  const otherNew = S.foods.filter(f => f.isNew && !f.official);
  el.innerHTML =
    '<div class="greet" style="margin-bottom:4px">New This Year</div>' +
    '<div class="muted" style="margin:0 2px 14px">' + official.length + ' official new foods debuting at the 2026 fair' +
    (otherNew.length ? ' · ' + otherNew.length + ' more new items' : '') + '</div>' +
    '<div class="chip-row" style="margin-bottom:12px"><a class="chip" href="#/search?new=1">Filter all new foods →</a></div>' +
    '<div class="section-title"><span>🎪 Official new foods (' + official.length + ')</span></div>' +
    '<div class="grid2">' + official.map(foodCardHtml).join('') + '</div>' +
    (otherNew.length ?
      '<div class="section-title"><span>Also new in 2026 (' + otherNew.length + ')</span></div>' +
      '<div class="grid2">' + otherNew.map(foodCardHtml).join('') + '</div>' : '');
}

/* ================= SEARCH ================= */
const searchState = { q: '', onlyNew: false, cat: '', diets: [], value5: false, sips: false, minRating: 0, page: 1, _sig: '' };
const SEARCH_PAGE = 24; // render results a page at a time — the catalog is ~3,800 foods

function viewSearch(el, params) {
  // Apply deep-link params ONCE, then strip them from the hash — otherwise every
  // re-render re-applies them and filter chips can never be unselected.
  if (params.get('new') === '1') { searchState.onlyNew = true; }
  if (params.get('cat')) { searchState.cat = params.get('cat'); }
  if (params.get('new') || params.get('cat')) {
    history.replaceState(null, '', location.href.split('#')[0] + '#/search');
  }
  el.innerHTML =
    '<div class="searchbox">' +
    '<input type="search" id="searchInput" placeholder="Search foods or vendors" value="' + esc(searchState.q) + '" ' +
    'aria-label="Search foods or vendors" autocomplete="off" oninput="searchTyped(this.value)">' +
    '<div id="autoc"></div>' +
    '</div>' +
    '<div class="chip-row scroll" role="group" aria-label="Filters">' +
    '<button class="chip ' + (searchState.onlyNew ? 'on' : '') + '" aria-pressed="' + searchState.onlyNew + '" onclick="searchState.onlyNew=!searchState.onlyNew;render()">New this year</button>' +
    ['Deep Fried', 'On a Stick', 'Sweet', 'Savory', 'Drinks', 'Dairy'].map(c =>
      '<button class="chip ' + (searchState.cat === c ? 'on' : '') + '" aria-pressed="' + (searchState.cat === c) + '" onclick="searchState.cat=searchState.cat===\'' + c + '\'?\'\':\'' + c + '\';render()">' + c + '</button>').join('') +
    '</div>' +
    '<div class="chip-row scroll" role="group" aria-label="Dietary and value filters">' +
    ['vegetarian', 'vegan', 'gluten-free'].map(d =>
      '<button class="chip ' + (searchState.diets.includes(d) ? 'on' : '') + '" aria-pressed="' + searchState.diets.includes(d) + '" onclick="toggleDiet(\'' + d + '\')">' + d + '</button>').join('') +
    '<button class="chip ' + (searchState.value5 ? 'on' : '') + '" aria-pressed="' + searchState.value5 + '" onclick="searchState.value5=!searchState.value5;render()">Value $5 &amp; under</button>' +
    '<button class="chip ' + (searchState.sips ? 'on' : '') + '" aria-pressed="' + searchState.sips + '" onclick="searchState.sips=!searchState.sips;render()">Specialty Sips</button>' +
    '<select aria-label="Minimum rating" style="width:auto;padding:6px 10px;border-radius:999px;font-size:12.5px" onchange="searchState.minRating=+this.value;render()">' +
    [0, 3, 4, 4.5].map(r => '<option value="' + r + '" ' + (searchState.minRating === r ? 'selected' : '') + '>' + (r ? r + '+ Pups' : 'Any rating') + '</option>').join('') +
    '</select>' +
    '</div>' +
    '<div id="searchResults">' + searchResultsHtml() + '</div>';
}
function toggleDiet(d) {
  const i = searchState.diets.indexOf(d);
  if (i >= 0) searchState.diets.splice(i, 1); else searchState.diets.push(d);
  render();
}
function searchTyped(v) {
  searchState.q = v;
  const box = document.getElementById('autoc');
  /* PRD: autocomplete after 3 characters */
  if (v.trim().length >= 3) {
    const q = v.trim().toLowerCase();
    const foods = S.foods.filter(f => f.name.toLowerCase().includes(q)).slice(0, 4);
    const vendors = S.vendors.filter(x => x.name.toLowerCase().includes(q)).slice(0, 3);
    if (foods.length || vendors.length) {
      box.innerHTML = '<div class="autocomplete" role="listbox" aria-label="Suggestions">' +
        foods.map(f => '<button role="option" onclick="location.hash=\'#/food/' + f.id + '\'">' + f.emoji + ' ' + esc(f.name) + '</button>').join('') +
        vendors.map(x => '<button role="option" onclick="location.hash=\'#/vendor/' + x.id + '\'">📍 ' + esc(x.name) + ' <span class="muted">(stand)</span></button>').join('') +
        '</div>';
    } else box.innerHTML = '';
  } else box.innerHTML = '';
  document.getElementById('searchResults').innerHTML = searchResultsHtml();
}
/* dietary matches the food's own tags OR the vendor's published options */
function dietMatch(f, v, d) {
  if (f.dietary && f.dietary.includes(d)) return true;
  if (!v) return false;
  if (d === 'vegetarian') return v.veg;
  if (d === 'vegan') return v.vegan;
  if (d === 'gluten-free') return v.gf;
  return false;
}
function matchFilters(f) {
  const v = getVendor(f.vendorId);
  const q = searchState.q.trim().toLowerCase();
  if (q) {
    const hit = f.name.toLowerCase().includes(q) || (v && v.name.toLowerCase().includes(q)) || f.cats.some(c => c.toLowerCase().includes(q));
    if (!hit) return false;
  }
  if (searchState.onlyNew && !f.isNew) return false;
  if (searchState.cat && !f.cats.includes(searchState.cat)) return false;
  if (searchState.diets.length && !searchState.diets.every(d => dietMatch(f, v, d))) return false;
  if (searchState.value5 && !(v && v.value5)) return false;
  if (searchState.sips && !f.sip) return false;
  if (searchState.minRating) {
    const r = foodRating(f.id);
    if (!r.count || r.avg < searchState.minRating) return false;
  }
  return true;
}
const BROWSE_CATS = ['Deep Fried', 'On a Stick', 'Sweet', 'Savory', 'Drinks', 'Dairy'];
const CAT_ICON = { 'Deep Fried': '🍤', 'On a Stick': '🍢', 'Sweet': '🍰', 'Savory': '🧀', 'Drinks': '🥤', 'Dairy': '🥛' };

function searchSig() {
  return [searchState.q.trim(), searchState.onlyNew, searchState.cat, searchState.diets.join(','), searchState.value5, searchState.sips, searchState.minRating].join('|');
}
function loadMoreSearch() {
  searchState.page++;
  document.getElementById('searchResults').innerHTML = searchResultsHtml();
}
function searchResultsHtml() {
  const anyFilter = searchState.q.trim() || searchState.onlyNew || searchState.cat || searchState.diets.length || searchState.value5 || searchState.sips || searchState.minRating;
  /* reset paging whenever the query/filters change */
  const sig = searchSig();
  if (sig !== searchState._sig) { searchState._sig = sig; searchState.page = 1; }

  /* No filters: don't dump 1,600 cards — offer a search-first browse experience. */
  if (!anyFilter) {
    let h = '<div class="section-title"><span>Popular searches</span></div><div class="chip-row">' +
      S.analytics.topSearches.map(t => '<button class="chip" onclick="searchState.q=\'' + esc(t).replace(/'/g, "\\'") + '\';render()">' + esc(t) + '</button>').join('') + '</div>';
    h += '<div class="section-title"><span>Browse by category</span></div>' +
      '<div class="grid2">' + BROWSE_CATS.map(c => {
        const count = S.foods.filter(f => f.cats.includes(c)).length;
        return '<button class="cat-tile" onclick="searchState.cat=\'' + c + '\';render()">' +
          '<span class="cat-ico" aria-hidden="true">' + CAT_ICON[c] + '</span>' +
          '<span class="cat-name">' + c + '</span><span class="sub">' + count + ' foods</span></button>';
      }).join('') + '</div>' +
      '<div class="muted" style="text-align:center;margin:14px 2px 0">' + S.foods.length.toLocaleString() + ' foods across ' + S.vendors.length + ' stands — search or pick a category to dig in.</div>';
    return h;
  }

  const results = S.foods.filter(matchFilters);
  let h = '';
  /* sponsored influencer lists ride above organic results, like search ads */
  const sp = sponsoredLists().filter(l => l.ownerId !== S.currentUserId).slice(0, 2);
  if (sp.length) {
    h += '<div class="muted" style="margin:12px 2px 6px;font-size:11.5px;letter-spacing:.3px"><b style="color:var(--ink)">Sponsored</b> · influencer lists</div>' +
      sp.map(l => listRowHtml(l, { sponsored: true })).join('');
  }
  /* vendors matching the text query ride above the food results — search spans both */
  const qv = searchState.q.trim().toLowerCase();
  if (qv) {
    const counts = vendorItemCounts();
    const vmatch = S.vendors.filter(v => v.name.toLowerCase().includes(qv) || (v.loc || '').toLowerCase().includes(qv))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (vmatch.length) {
      h += '<div class="section-title" style="margin-top:6px"><span>Vendors (' + vmatch.length + ')</span>' +
        (vmatch.length > 4 ? '<a class="see-all" href="#/vendors" onclick="vendorDir.q=\'' + esc(qv).replace(/'/g, "\\'") + '\'">See all</a>' : '') + '</div>' +
        vmatch.slice(0, 4).map(v => vendorRowHtml(v, counts[v.id] || 0)).join('');
    }
  }
  const shown = Math.min(results.length, searchState.page * SEARCH_PAGE);
  if (qv) h += '<div class="section-title"><span>Foods</span></div>';
  h += '<div class="muted" style="margin:12px 2px 4px">' + results.length.toLocaleString() + ' food' + (results.length === 1 ? '' : 's') +
    (results.length > shown ? ' · showing ' + shown : '') + '</div>';
  h += '<div class="grid2">' + results.slice(0, shown).map(foodCardHtml).join('') + '</div>';
  if (results.length > shown) {
    h += '<button class="btn ghost block" style="margin-top:14px" onclick="loadMoreSearch()">Show more (' + (results.length - shown).toLocaleString() + ' more)</button>';
  }
  if (!results.length) h += '<div class="empty"><span class="big">🫙</span>Nothing matches those filters.<br>Loosen up — it\'s the fair!</div>';
  return h;
}

/* ================= FOOD DETAIL ================= */
const _fetchedReviewFoods = Object.create(null);
function viewFood(el, id) {
  const f = getFood(id);
  if (!f) { el.innerHTML = '<div class="empty">Food not found.</div>'; return; }
  const v = getVendor(f.vendorId);
  /* pull community reviews for this food once, then re-render if any arrived */
  if (!_fetchedReviewFoods[id] && typeof loadReviewsForFood === 'function' &&
      typeof ListStore !== 'undefined' && ListStore.configured()) {
    _fetchedReviewFoods[id] = true;
    loadReviewsForFood(id).then(added => { if (added && location.hash.indexOf('/food/' + id) >= 0) render(); });
  }
  const rs = foodReviews(id).slice().sort((a, b) => b.ts - a.ts);
  const u = me();

  const allPhotos = rs.reduce((a, r) => a.concat(r.photos), []);
  el.innerHTML =
    photoHtml(f, 'hero') +
    '<div class="detail-head">' +
    '<h1>' + esc(f.name) + '</h1>' +
    '<div class="detail-meta">' + ratingLine(f.id) + ' · On ' + listCountForFood(f.id) + ' lists</div>' +
    '<div class="detail-meta"><a href="#/vendor/' + v.id + '" style="font-weight:700;text-decoration:underline;text-underline-offset:3px;color:var(--ink)">' + esc(v.name) + '</a>' + (f.price ? ' · $' + f.price.toFixed(2).replace(/\.00$/, '') : '') + (v.hours ? ' · ' + esc(v.hours) : '') + '</div>' +
    (v.loc ? '<div class="detail-meta">' + esc(v.loc) + '</div>' : '') +
    '</div>' +
    '<div class="action-row">' +
    '<button class="btn ate' + (hasEaten(u.id, f.id) ? ' on' : '') + '" aria-pressed="' + hasEaten(u.id, f.id) + '" onclick="ateToggle(\'' + f.id + '\')">' + (hasEaten(u.id, f.id) ? '✓ Ate this' : '＋ Ate this') + '</button>' +
    '<button class="btn secondary" onclick="openRateModal(\'' + f.id + '\')">Rate &amp; review</button>' +
    '<button class="btn secondary" onclick="openAddToList(\'' + f.id + '\')">Add to my list</button>' +
    '<button class="btn ghost" onclick="location.hash=\'#/vendor/' + v.id + '\'">See vendor</button>' +
    '<button class="btn ghost" onclick="location.hash=\'#/map?vendor=' + v.id + '\'">Find booth</button>' +
    (u.role === 'admin' ? '<button class="btn ghost" onclick="openHeroModal(\'' + f.id + '\')">Official photo</button>' : '') +
    '</div>' +
    (v.specials ? '<div class="notice"><span aria-hidden="true">🎉</span><span><b>Today:</b> ' + esc(v.specials) + '</span></div>' : '') +
    (v.offers ? '<div class="notice"><span aria-hidden="true">🎟️</span><span><b>Deals:</b> ' + esc(v.offers.length > 160 ? v.offers.slice(0, 157) + '…' : v.offers) + '</span></div>' : '') +
    '<hr class="divider">' +
    '<p style="font-size:14.5px;line-height:1.6;margin:0">' + esc(f.desc || ('On the menu at ' + v.name + '. Ask at the booth for details — then come back and rate it.')) + '</p>' +
    '<div class="chip-row" style="margin-top:12px">' + foodPills(f) + '</div>' +
    (allPhotos.length ? '<hr class="divider"><div class="section-title" style="margin-top:0"><span>Photos from foodies</span></div>' +
      '<div class="gallery">' + allPhotos.map(p => '<img src="' + p + '" alt="Guest photo of ' + esc(f.name) + '">').join('') + '</div>' : '') +
    '<hr class="divider">' +
    '<div class="section-title" style="margin-top:0"><span>Reviews (' + rs.length + ')</span></div>' +
    (rs.length ? rs.map(r => reviewHtml(r)).join('') :
      '<div class="empty"><span class="big">📝</span>No reviews yet — be the first!</div>');
}

/* one-tap "Ate it" check-in from the food page */
function ateToggle(foodId) {
  const nowEaten = toggleEaten(foodId);
  toast(nowEaten ? 'Checked in — added to your Passport 🎪' : 'Removed from your Passport');
  render();
}

function reviewHtml(r) {
  // remote community reviews carry denormalized author fields (no local profile)
  const ru = getUser(r.userId) || { id: r.userId, name: r.authorName || 'A fair foodie', handle: r.authorHandle || 'fairgoer', avatar: r.authorAvatar || '🙂', verified: false, badges: [] };
  const local = !!getUser(r.userId);
  const u = me();
  const liked = r.likes.includes(u.id);
  const nameHtml = local ? '<a href="#/user/' + ru.id + '" style="color:inherit">' + userName(ru) + '</a>' : userName(ru);
  return '<div class="review">' +
    '<div class="review-head">' + avatarHtml(ru, 'av') +
    '<div class="grow"><b>' + nameHtml + '</b>' +
    '<div class="muted">' + timeAgo(r.ts) + '</div></div>' + pups(r.rating) + '</div>' +
    (r.text ? '<div style="font-size:14px">' + esc(r.text) + '</div>' : '') +
    (r.photos.length ? '<div class="review-photos">' + r.photos.map(p => '<img src="' + p + '" alt="Review photo">').join('') + '</div>' : '') +
    '<div class="review-actions">' +
    '<button class="' + (liked ? 'on' : '') + '" aria-pressed="' + liked + '" onclick="likeReview(\'' + r.id + '\')">Helpful · ' + r.likes.length + '</button>' +
    '<button onclick="toggleCommentBox(\'' + r.id + '\')">Comment · ' + r.comments.length + '</button>' +
    '<button onclick="reportContent(\'review\',\'' + r.id + '\')">Report</button>' +
    '</div>' +
    r.comments.filter(c => !isBlockedByMe(c.userId)).map(c => {
      const cu = getUser(c.userId);
      return '<div class="comment">' + avatarHtml(cu, 'av') + '<div><b>' + userName(cu) + '</b> ' + esc(c.text) + ' <span class="muted">' + timeAgo(c.ts) + '</span></div></div>';
    }).join('') +
    '<div id="cbox_' + r.id + '" hidden style="margin-top:8px"><div class="row">' +
    '<input type="text" id="cin_' + r.id + '" placeholder="Add a comment…" aria-label="Add a comment" maxlength="200">' +
    '<button class="btn small" onclick="addComment(\'' + r.id + '\')">Post</button></div></div>' +
    '</div>';
}

function likeReview(id) {
  const r = getReview(id); const u = me();
  const i = r.likes.indexOf(u.id);
  if (i >= 0) r.likes.splice(i, 1);
  else {
    r.likes.push(u.id);
    notify(r.userId, u.name + ' found your review helpful 👍', '#/food/' + r.foodId);
  }
  save(); render();
}
function toggleCommentBox(id) {
  const b = document.getElementById('cbox_' + id);
  b.hidden = !b.hidden;
  if (!b.hidden) document.getElementById('cin_' + id).focus();
}
function addComment(id) {
  const inp = document.getElementById('cin_' + id);
  const text = inp.value.trim();
  if (!text) return;
  const r = getReview(id); const u = me();
  r.comments.push({ id: uid('c'), userId: u.id, text, ts: Date.now() });
  notify(r.userId, u.name + ' commented on your review 💬', '#/food/' + r.foodId);
  logActivity(u.id, 'commented on a review of ' + getFood(r.foodId).name, '#/food/' + r.foodId);
  save(); render();
  toast('Comment posted');
}
function reportContent(type, id) {
  openModal('<h2>🚩 Report content</h2>' +
    '<label class="field">Why are you reporting this?<select id="repReason">' +
    '<option>Inappropriate or offensive</option><option>Spam or misleading</option><option>Harassment</option><option>Other</option>' +
    '</select></label>' +
    '<button class="btn block" onclick="submitReport(\'' + type + '\',\'' + id + '\')">Submit report</button>');
}
function submitReport(type, id) {
  S.reports.push({ id: uid('rep'), type, targetId: id, reason: document.getElementById('repReason').value, reporterId: S.currentUserId, status: 'pending', ts: Date.now() });
  save(); closeModal();
  toast('Report sent to fair moderators. Thank you!');
}

/* ---- rate & review modal ---- */
let rateVal = 0, ratePhotos = [];
function openRateModal(foodId) {
  rateVal = 0; ratePhotos = [];
  const f = getFood(foodId);
  openModal(
    '<h2>Rate ' + esc(f.name) + '</h2>' +
    '<div class="pup-input" id="pupIn" role="radiogroup" aria-label="Rating in Pronto Pups">' +
    [1, 2, 3, 4, 5].map(i => '<button type="button" role="radio" aria-checked="false" aria-label="' + i + ' Pronto Pup' + (i > 1 ? 's' : '') + '" onclick="setRate(' + i + ')">' + pupSvg() + '</button>').join('') +
    '</div>' +
    '<div class="muted" id="rateHint" style="margin:4px 0 10px">Tap the pups! 1 = skip it · 5 = fair legend</div>' +
    '<label class="field">Add a review <span class="muted">(optional)</span>' +
    '<textarea id="revText" maxlength="500" placeholder="How was it? Crunch level? Line length? Regrets?"></textarea></label>' +
    '<div class="muted" id="charCount" style="margin:-6px 0 10px">0 / 500</div>' +
    '<div class="field" style="font-weight:700;font-size:13px">Photos <span class="muted">(up to 3)</span><br>' +
    '<input type="file" accept="image/png,image/jpeg" onchange="addRatePhoto(this)" aria-label="Add review photo"></div>' +
    '<div class="review-photos" id="ratePhotoRow"></div>' +
    '<button class="btn block" onclick="submitReview(\'' + foodId + '\')">Post rating</button>',
    root => {
      root.querySelector('#revText').addEventListener('input', e => {
        root.querySelector('#charCount').textContent = e.target.value.length + ' / 500';
      });
    });
}
function setRate(n) {
  rateVal = n;
  document.querySelectorAll('#pupIn button').forEach((b, i) => {
    b.classList.toggle('on', i < n);
    b.setAttribute('aria-checked', i === n - 1 ? 'true' : 'false');
  });
  const hints = ['', 'Skip it 😬', 'Meh 🤷', 'Solid fair food 👍', 'Really good! 😋', 'FAIR LEGEND 🏆'];
  document.getElementById('rateHint').textContent = hints[n];
}
function addRatePhoto(input) {
  if (ratePhotos.length >= 3) { toast('Max 3 photos per review'); return; }
  readImage(input.files[0], 5, data => {
    ratePhotos.push(data);
    document.getElementById('ratePhotoRow').innerHTML = ratePhotos.map(p => '<img src="' + p + '" alt="Photo to attach">').join('');
    input.value = '';
  });
}
function submitReview(foodId) {
  const text = document.getElementById('revText').value.trim();
  if (!rateVal) { toast('Pick a Pronto Pup rating first'); return; }
  // review text is optional — a pup rating alone is a valid submission
  const u = me();
  const r = { id: uid('r'), foodId, userId: u.id, rating: rateVal, text, photos: ratePhotos.slice(), likes: [], comments: [], reported: false, removed: false, ts: Date.now(), vendorResponse: null };
  S.reviews.push(r);
  if (typeof markEaten === 'function') { markEaten(foodId); checkBadgeUnlocks(u.id); } // reviewing implies you ate it — count it in the Passport
  /* real accounts: post to the shared backend and fold into the live aggregate */
  if (typeof postReview === 'function' && typeof authIsReal === 'function' && authIsReal()) {
    postReview(r).then(ok => {
      if (!ok) return;
      r.synced = true;
      if (S.remoteScores) {
        const cur = S.remoteScores[foodId] || { avg: 0, count: 0 };
        const n = cur.count + 1;
        S.remoteScores[foodId] = { avg: (cur.avg * cur.count + rateVal) / n, count: n };
      } else {
        S.remoteScores = { [foodId]: { avg: rateVal, count: 1 } };
      }
      dataRev++; save(); render();
    });
  }
  if (text.length >= 10) {
    u.qualityReviews++; // only written reviews count toward the Blogger badge
    if (u.qualityReviews >= 25 && !u.badges.includes('Blogger')) { u.badges.push('Blogger'); pushToast('🏅 Badge earned: Blogger!'); }
  }
  const f = getFood(foodId);
  logActivity(u.id, 'rated ' + f.name + ' — ' + rateVal + ' Pups', '#/food/' + foodId);
  u.followers.forEach(fid => notify(fid, u.name + ' rated ' + f.name + ' (' + rateVal + ' Pups)', '#/food/' + foodId));
  save(); closeModal(); render();
  toast(text ? 'Review posted — thanks for feeding the community! 🎪' : 'Rated ' + rateVal + ' Pups — thanks! 🌭');
}

/* ================= LISTS ================= */
function viewLists(el) {
  const u = me();
  const mine = S.lists.filter(l => l.ownerId === u.id || l.collaborators.includes(u.id));
  const sponsored = sponsoredLists().filter(l => l.ownerId !== u.id && !l.collaborators.includes(u.id));
  const spIds = sponsored.map(l => l.id);
  const discover = S.lists.filter(l => l.ownerId !== u.id && !l.collaborators.includes(u.id) && !spIds.includes(l.id) &&
    !isBlockedByMe(l.ownerId) &&
    (l.privacy === 'public' || (l.privacy === 'friends' && getUser(l.ownerId).followers.includes(u.id))));
  el.innerHTML =
    '<div class="row between"><h1 class="greet" style="margin:4px 0 14px">My Lists</h1>' +
    '<button class="btn small secondary" onclick="openNewList()">+ New list</button></div>' +
    (sponsored.length ?
      '<div class="muted" style="margin:0 2px 6px;font-size:11.5px;letter-spacing:.3px"><b style="color:var(--ink)">Sponsored</b> · influencer lists</div>' +
      sponsored.map(l => listRowHtml(l, { sponsored: true })).join('') : '') +
    '<div class="section-title"><span>Your lists</span></div>' +
    (mine.length ? mine.map(l => listRowHtml(l)).join('') :
      '<div class="empty"><span class="big">📋</span>Your list is empty.<br>Go find something on a stick.</div>') +
    (discover.length ? '<div class="section-title"><span>Discover lists</span></div>' +
      discover.map(l => listRowHtml(l)).join('') : '');
}
function listRowHtml(l, opts) {
  opts = opts || {};
  const owner = getUser(l.ownerId);
  const first = getFood(l.foodIds[0]);
  return '<a class="card list-row" href="#/list/' + l.id + '">' +
    (first ? photoHtml(first, 'thumb') : '<span class="list-ico" aria-hidden="true">📋</span>') +
    '<span class="grow"><b>' + esc(l.name) + (l.featured ? ' <span class="vbadge" title="Featured">★</span>' : '') + '</b>' +
    '<div class="muted">' + (listRating(l).count ? pupOne(true) + ' ' + listRating(l).avg.toFixed(1) + ' · ' : '') + userName(owner) + ' · ' + l.foodIds.length + ' foods · ' + l.likes.length + ' likes</div></span>' +
    (opts.sponsored ? '<span class="pill">Sponsored</span>' : '<span class="pill privacy">' + l.privacy + '</span>') + '</a>';
}
function avatarInline(u) {
  return u.avatar && u.avatar.startsWith('data:') ? '👤' : (u.avatar || '👤');
}
function openNewList(foodIdToAdd) {
  openModal('<h2>📋 New list</h2>' +
    '<label class="field">List name<input type="text" id="nlName" maxlength="50" placeholder="e.g. Must Try 2026, Kids Will Love"></label>' +
    '<label class="field">Who can see it?<select id="nlPrivacy">' +
    '<option value="private">Private (just me)</option><option value="friends">Friends only</option><option value="public" selected>Public</option>' +
    '</select></label>' +
    '<button class="btn block" onclick="createList(' + (foodIdToAdd ? '\'' + foodIdToAdd + '\'' : 'null') + ')">Create list</button>');
}
function createList(foodIdToAdd) {
  const name = document.getElementById('nlName').value.trim();
  if (!name) { toast('Give your list a name'); return; }
  const u = me();
  const l = { id: uid('l'), name, ownerId: u.id, foodIds: foodIdToAdd ? [foodIdToAdd] : [], privacy: document.getElementById('nlPrivacy').value, featured: false, likes: [], ratings: {}, views: 0, comments: [], collaborators: [], ts: Date.now() };
  S.lists.push(l);
  if (l.privacy !== 'private') logActivity(u.id, 'created list "' + name + '"', '#/list/' + l.id);
  save(); closeModal();
  location.hash = '#/list/' + l.id;
  toast('List created! 🎉');
}
function openAddToList(foodId) {
  const u = me();
  const mine = S.lists.filter(l => l.ownerId === u.id || l.collaborators.includes(u.id));
  openModal('<h2>Add to list</h2>' +
    (mine.length ? mine.map(l => {
      const has = l.foodIds.includes(foodId);
      return '<button class="oauth-btn" style="justify-content:space-between" onclick="toggleInList(\'' + l.id + '\',\'' + foodId + '\')">' +
        '<span>📋 ' + esc(l.name) + '</span><span>' + (has ? '✅' : '＋') + '</span></button>';
    }).join('') : '<p class="muted">No lists yet.</p>') +
    '<button class="btn secondary block" style="margin-top:6px" onclick="closeModal();openNewList(\'' + foodId + '\')">+ Create new list</button>');
}
function toggleInList(listId, foodId) {
  const l = getList(listId);
  const i = l.foodIds.indexOf(foodId);
  if (i >= 0) { l.foodIds.splice(i, 1); toast('Removed from "' + l.name + '"'); }
  else { l.foodIds.push(foodId); toast('Added to "' + l.name + '" ✅'); }
  save();
  openAddToList(foodId); // refresh modal
}

/* ---- Build-from-list: search the catalog and add foods to THIS list ---- */
const addPickState = { listId: null, q: '' };
function openAddFoodModal(listId) {
  addPickState.listId = listId;
  addPickState.q = '';
  const l = getList(listId);
  openModal('<h2>Add food to “' + esc(l.name) + '”</h2>' +
    '<div class="searchbox" style="margin-bottom:10px">' +
    '<input type="search" id="addPickInput" placeholder="Search ' + S.foods.length.toLocaleString() + ' foods or vendors" ' +
    'aria-label="Search foods to add" autocomplete="off" oninput="addPickTyped(this.value)"></div>' +
    '<div id="addPickResults">' + addPickResultsHtml() + '</div>' +
    '<button class="btn block" style="margin-top:12px" onclick="closeModal();render()">Done</button>');
}
function addPickTyped(v) {
  addPickState.q = v;
  const box = document.getElementById('addPickResults');
  if (box) box.innerHTML = addPickResultsHtml();
}
function addPickResultsHtml() {
  const l = getList(addPickState.listId);
  if (!l) return '';
  const inList = id => l.foodIds.includes(id);
  const q = addPickState.q.trim().toLowerCase();
  let foods, heading;
  if (!q) {
    foods = l.foodIds.map(getFood).filter(Boolean);
    if (!foods.length) return '<p class="muted" style="text-align:center;margin:18px 4px">Start typing to search — burgers, cheese curds, a vendor name…</p>';
    heading = 'In this list (' + foods.length + ')';
  } else {
    // rank: name matches first (exact-ish, then partial), then vendor/category matches
    const scored = [];
    for (const f of S.foods) {
      const name = f.name.toLowerCase();
      const v = getVendor(f.vendorId);
      let score = 0;
      if (name === q) score = 4;
      else if (name.startsWith(q)) score = 3;
      else if (name.includes(q)) score = 2;
      else if ((v && v.name.toLowerCase().includes(q)) || f.cats.some(c => c.toLowerCase().includes(q))) score = 1;
      if (score) scored.push([score, f]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    heading = scored.length.toLocaleString() + ' match' + (scored.length === 1 ? '' : 'es') + (scored.length > 40 ? ' · showing 40' : '');
    foods = scored.slice(0, 40).map(x => x[1]);
  }
  let h = '<div class="muted" style="margin:2px 2px 8px;font-size:12px">' + esc(heading) + '</div>';
  if (!foods.length) h += '<p class="muted" style="text-align:center;margin:18px 4px">No foods match “' + esc(addPickState.q) + '”.</p>';
  h += foods.map(f => {
    const v = getVendor(f.vendorId);
    const has = inList(f.id);
    return '<button class="oauth-btn" style="justify-content:space-between;text-align:left" onclick="addPickToggle(\'' + f.id + '\')">' +
      '<span class="grow" style="min-width:0"><b style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (f.emoji || '🍴') + ' ' + esc(f.name) + '</b>' +
      '<span class="muted" style="font-size:12px">' + esc((v || {}).name || '') + '</span></span>' +
      '<span class="pill ' + (has ? 'privacy' : '') + '" style="flex:none">' + (has ? '✓ Added' : '＋ Add') + '</span></button>';
  }).join('');
  return h;
}
function addPickToggle(foodId) {
  const l = getList(addPickState.listId);
  const i = l.foodIds.indexOf(foodId);
  if (i >= 0) { l.foodIds.splice(i, 1); }
  else { l.foodIds.push(foodId); }
  save(); // persists + syncs owned list to the backend
  const box = document.getElementById('addPickResults');
  if (box) box.innerHTML = addPickResultsHtml();
}

function viewListDetail(el, id) {
  const l = getList(id);
  if (!l) { el.innerHTML = '<div class="empty">List not found.</div>'; return; }
  const u = me();
  const owner = getUser(l.ownerId);
  const isOwner = l.ownerId === u.id;
  const canEdit = isOwner || l.collaborators.includes(u.id);
  if (!isOwner) { l.views++; save(); }
  const liked = l.likes.includes(u.id);
  const foods = l.foodIds.map(getFood).filter(Boolean);
  const total = foods.reduce((a, f) => a + (f.price || 0), 0);

  el.innerHTML =
    '<div style="margin:4px 0 16px">' +
    '<div class="row between"><h1 style="font-size:21px;font-weight:700">' + esc(l.name) + (l.featured ? ' <span class="vbadge" title="Featured">★</span>' : '') + '</h1>' +
    '<span class="pill privacy">' + l.privacy + '</span></div>' +
    '<div class="muted" style="margin:6px 0 12px">' +
    (listRating(l).count ? pupOne(true) + ' <b style="color:var(--ink)">' + listRating(l).avg.toFixed(1) + '</b> (' + listRating(l).count + ') · ' : '') +
    userName(owner) + ' · ' + foods.length + ' foods' + (total ? ' · est. $' + total.toFixed(2) : '') + ' · ' + l.views.toLocaleString() + ' views</div>' +
    '<div class="row" style="flex-wrap:wrap">' +
    (canEdit ? '<button class="btn small" onclick="openAddFoodModal(\'' + l.id + '\')">＋ Add food</button>' : '') +
    '<button class="btn small ' + (canEdit ? 'secondary' : '') + '" onclick="location.hash=\'#/map?list=' + l.id + '\'">Map route</button>' +
    '<button class="btn small ghost ' + (liked ? 'on' : '') + '" aria-pressed="' + liked + '" onclick="likeList(\'' + l.id + '\')" style="' + (liked ? 'color:var(--accent);border-color:var(--accent)' : '') + '">♥ ' + l.likes.length + '</button>' +
    '<button class="btn small ghost" onclick="openShareModal(\'' + l.id + '\')">Share</button>' +
    '<button class="btn small ghost" onclick="duplicateList(\'' + l.id + '\')">Duplicate</button>' +
    (isOwner ? '<button class="btn small ghost" onclick="openListSettings(\'' + l.id + '\')">Settings</button>' : '') +
    (isOwner && u.role === 'influencer' && !l.featured && l.privacy === 'public' ? '<button class="btn small ghost" onclick="requestFeatured(\'' + l.id + '\')">★ Submit for featured</button>' : '') +
    '</div></div>' +

    (!canEdit ? ratePanelHtml(l, u) : '') +

    (foods.length ? foods.map(f =>
      '<div class="card food-card">' +
      '<a href="#/food/' + f.id + '" aria-hidden="true" tabindex="-1">' + photoHtml(f, 'thumb') + '</a>' +
      '<span class="grow"><h3><a href="#/food/' + f.id + '">' + esc(f.name) + '</a></h3>' +
      '<div class="muted">' + esc((getVendor(f.vendorId) || {}).name || '') + (f.price ? ' · $' + f.price.toFixed(2).replace(/\.00$/, '') : '') + '</div>' +
      ratingLine(f.id) + '</span>' +
      (canEdit ? '<button class="btn small ghost" aria-label="Remove ' + esc(f.name) + '" onclick="removeFromList(\'' + l.id + '\',\'' + f.id + '\')">✕</button>' : '') +
      '</div>').join('') :
      (canEdit ?
        '<div class="empty"><span class="big">🍽️</span>This list is empty.<br>Add your first food to get started.' +
        '<div style="margin-top:14px"><button class="btn" onclick="openAddFoodModal(\'' + l.id + '\')">＋ Add food</button></div></div>' :
        '<div class="empty"><span class="big">🍽️</span>Nothing here yet.</div>')) +

    '<div class="section-title"><span>💬 Comments (' + l.comments.length + ')</span></div>' +
    '<div class="card">' +
    l.comments.filter(c => !isBlockedByMe(c.userId)).map(c => {
      const cu = getUser(c.userId);
      return '<div class="comment">' + avatarHtml(cu, 'av') + '<div><b>' + userName(cu) + '</b> ' + esc(c.text) + ' <span class="muted">' + timeAgo(c.ts) + '</span></div></div>';
    }).join('') +
    '<div class="row" style="margin-top:10px"><input type="text" id="listComment" placeholder="Add a comment…" aria-label="Comment on this list" maxlength="200">' +
    '<button class="btn small" onclick="commentList(\'' + l.id + '\')">Post</button></div>' +
    '</div>';
}
/* Centered cream panel with large tap targets — the signature list-rating moment */
function ratePanelHtml(l, u) {
  const mine = (l.ratings || {})[u.id] || 0;
  return '<div class="rate-panel">' +
    '<div class="rate-panel-label">' + (mine ? 'You rated it ' + mine + ' pup' + (mine > 1 ? 's' : '') : 'Rate it in pups') + '</div>' +
    '<div class="pup-input" role="radiogroup" aria-label="Rate this list, 1 to 5 pups">' +
    [1, 2, 3, 4, 5].map(i =>
      '<button type="button" role="radio" aria-checked="' + (mine === i) + '" class="' + (i <= mine ? 'on' : '') + '" ' +
      'aria-label="' + i + ' pup' + (i > 1 ? 's' : '') + '" onclick="rateList(\'' + l.id + '\',' + i + ')">' + pupSvg() + '</button>').join('') +
    '</div>' +
    '<div class="rate-panel-hint">' + (mine ? 'Tap a pup to change your rating' : '1 = never again · 5 = must-have repeat') + '</div>' +
    '</div>';
}

function rateList(id, n) {
  const l = getList(id); const u = me();
  if (l.ownerId === u.id || l.collaborators.includes(u.id)) { toast('You can\'t rate your own list'); return; }
  l.ratings = l.ratings || {};
  const had = l.ratings[u.id];
  l.ratings[u.id] = n;
  if (!had) {
    notify(l.ownerId, u.name + ' rated your list "' + l.name + '" ' + n + ' Pups', '#/list/' + id);
    logActivity(u.id, 'rated the list "' + l.name + '" — ' + n + ' Pups', '#/list/' + id);
  }
  save(); render();
  toast(had ? 'Rating updated' : 'Thanks for rating this list!');
}

function likeList(id) {
  const l = getList(id); const u = me();
  const i = l.likes.indexOf(u.id);
  if (i >= 0) l.likes.splice(i, 1);
  else { l.likes.push(u.id); notify(l.ownerId, u.name + ' liked your list "' + l.name + '" ❤️', '#/list/' + id); }
  save(); render();
}
/* legacy entry point — the full share flow lives in js/share.js */
function shareList(id) { openShareModal(id); }
function duplicateList(id) {
  const src = getList(id); const u = me();
  const copy = { id: uid('l'), name: src.name + ' (copy)', ownerId: u.id, foodIds: src.foodIds.slice(), privacy: 'private', featured: false, likes: [], ratings: {}, views: 0, comments: [], collaborators: [], ts: Date.now() };
  S.lists.push(copy);
  save();
  location.hash = '#/list/' + copy.id;
  toast('List duplicated — it\'s yours now!');
}
function removeFromList(listId, foodId) {
  const l = getList(listId);
  l.foodIds = l.foodIds.filter(x => x !== foodId);
  save(); render();
}
function commentList(id) {
  const inp = document.getElementById('listComment');
  const text = inp.value.trim();
  if (!text) return;
  const l = getList(id); const u = me();
  l.comments.push({ id: uid('lc'), userId: u.id, text, ts: Date.now() });
  /* PRD: push notification when friends comment on your list */
  notify(l.ownerId, u.name + ' commented on your list "' + l.name + '" 💬', '#/list/' + id);
  if (l.ownerId !== u.id) pushToast('Notified ' + getUser(l.ownerId).name + ' about your comment');
  save(); render();
}
function openListSettings(id) {
  const l = getList(id);
  openModal('<h2>⚙️ List settings</h2>' +
    '<label class="field">Name<input type="text" id="lsName" value="' + esc(l.name) + '" maxlength="50"></label>' +
    '<label class="field">Privacy<select id="lsPrivacy">' +
    ['private', 'friends', 'public'].map(p => '<option value="' + p + '" ' + (l.privacy === p ? 'selected' : '') + '>' + p + '</option>').join('') +
    '</select></label>' +
    '<label class="field">Add collaborator by handle <span class="muted">(collaborative lists)</span>' +
    '<input type="text" id="lsCollab" placeholder="e.g. curdnerd"></label>' +
    (l.collaborators.length ? '<div class="muted" style="margin-bottom:10px">Editors: ' + l.collaborators.map(cid => '@' + esc(getUser(cid).handle)).join(', ') + '</div>' : '') +
    '<button class="btn block" onclick="saveListSettings(\'' + id + '\')">Save</button>' +
    '<button class="btn ghost block" style="margin-top:8px" onclick="deleteList(\'' + id + '\')">🗑️ Delete list</button>');
}
function saveListSettings(id) {
  const l = getList(id);
  l.name = document.getElementById('lsName').value.trim() || l.name;
  l.privacy = document.getElementById('lsPrivacy').value;
  const handle = document.getElementById('lsCollab').value.trim().replace(/^@/, '');
  if (handle) {
    const cu = S.users.find(x => x.handle === handle);
    if (!cu) toast('No user @' + handle);
    else if (cu.id !== l.ownerId && !l.collaborators.includes(cu.id)) {
      l.collaborators.push(cu.id);
      notify(cu.id, me().name + ' added you as an editor on "' + l.name + '" 📋', '#/list/' + id);
      toast('@' + handle + ' can now edit this list');
    }
  }
  save(); closeModal(); render();
}
function deleteList(id) {
  if (typeof deleteUserList === 'function') deleteUserList(id); // remove server copy for real accounts
  S.lists = S.lists.filter(l => l.id !== id);
  save(); closeModal();
  location.hash = '#/lists';
  toast('List deleted');
}
function requestFeatured(id) {
  const l = getList(id);
  S.vendorRequests.push({ id: uid('fr'), featuredListId: id, requesterName: me().name, email: '', note: 'Featured placement request for list "' + l.name + '"', status: 'pending', ts: Date.now(), isFeatureRequest: true });
  save();
  toast('⭐ Submitted for Featured review — admins will take a look!');
}
