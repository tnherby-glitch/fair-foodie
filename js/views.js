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

function viewOnboarding(el) {
  const emojis = ['😀', '🤠', '🧑‍🌾', '🦆', '🐄', '🌽', '🧀', '🎡', '🎪', '🦄'];
  el.innerHTML =
    '<div class="onboard">' +
    '<div class="big-ico" aria-hidden="true">🌭</div>' +
    '<h1>Fair Foodie Guide</h1>' +
    '<p class="muted">Search, rate, and map the best eats at the Great Minnesota Get-Together.</p>' +
    '<div class="card" style="text-align:left">' +
    '<h2 style="font-size:16px;margin:0 0 10px">Create your profile</h2>' +
    '<button class="oauth-btn" onclick="obOAuth(\'Google\')">🔵 Continue with Google</button>' +
    '<button class="oauth-btn" onclick="obOAuth(\'Apple\')">🍎 Continue with Apple</button>' +
    '<button class="oauth-btn" onclick="obOAuth(\'Facebook\')">🟦 Continue with Facebook</button>' +
    '<div class="muted" style="text-align:center;margin:8px 0">— or with email —</div>' +
    '<label class="field">Display name<input type="text" id="obName" maxlength="30" placeholder="e.g. Corn Dog Connie" value="' + esc(obNameVal) + '"></label>' +
    '<label class="field">Email<input type="email" id="obEmail" placeholder="you@example.com" value="' + esc(obEmailVal) + '"></label>' +
    '<div class="field" style="font-size:13px;font-weight:700">Pick an avatar <span class="muted" style="font-weight:400">(or upload a photo, max 5MB JPEG/PNG)</span>' +
    '<div class="avatar-pick" role="group" aria-label="Choose avatar">' +
    emojis.map(e => '<button type="button" class="' + (obAvatar === e && !obPhoto ? 'on' : '') + '" onclick="obPick(\'' + e + '\')" aria-label="Avatar ' + e + '">' + e + '</button>').join('') +
    '</div>' +
    '<input type="file" id="obFile" accept="image/png,image/jpeg" aria-label="Upload profile photo" onchange="obUpload(this)">' +
    (obPhoto ? '<div class="muted" style="margin-top:6px">✅ Photo uploaded</div>' : '') +
    '</div>' +
    '<label class="row" style="font-size:13px;margin-bottom:12px"><input type="checkbox" id="ob2fa" style="width:auto"> Enable two-factor authentication (email)</label>' +
    '<button class="btn block" onclick="obCreate()">Continue</button>' +
    '</div>' +
    '<div class="muted" style="margin:14px 0 6px">Just exploring? Jump in as a demo persona:</div>' +
    '<div class="chip-row" style="justify-content:center">' +
    '<button class="chip" onclick="obDemo(\'u_inf1\')">🎤 Influencer</button>' +
    '<button class="chip" onclick="obDemo(\'u_blog1\')">📝 Blogger</button>' +
    '<button class="chip" onclick="obDemo(\'u_vend1\')">🌭 Vendor</button>' +
    '<button class="chip" onclick="obDemo(\'u_admin\')">🎡 Admin</button>' +
    '</div></div>';
}
function obPick(e) { obStash(); obAvatar = e; obPhoto = null; render(); }
function obUpload(input) {
  obStash();
  readImage(input.files[0], 5, data => { obPhoto = data; toast('Profile photo added'); render(); });
}
function obOAuth(provider) {
  const name = document.getElementById('obName').value.trim() || provider + ' Fairgoer';
  finishSignup(name, provider);
}
function obCreate() {
  const name = document.getElementById('obName').value.trim();
  if (!name) { toast('Please enter a display name'); return; }
  if (document.getElementById('ob2fa').checked) toast('🔐 2FA enabled — code sent to your email (demo)');
  finishSignup(name, 'email');
}
function finishSignup(name, provider) {
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
  toast('Welcome, ' + name + '! Signed in via ' + provider + ' 🎪');
  location.hash = '#/home';
  render();
}
function obDemo(userId) {
  S.currentUserId = userId;
  save();
  toast('Signed in as ' + getUser(userId).name);
  location.hash = '#/home';
  render();
}

/* ================= HOME ================= */
function viewHome(el) {
  const u = me();
  const featured = sponsoredLists();
  const fresh = S.foods.filter(f => f.isNew);
  const trend = trendingFoods(6);
  const ch = S.challenges[0];

  el.innerHTML =
    '<div class="greet">Hungry, ' + esc(u.name.split(' ')[0]) + '?</div>' +
    '<a class="searchpill" href="#/search" aria-label="Search foods and vendors">' +
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4" stroke-linecap="round"/></svg>' +
    '<span>Find your next bite<br><span class="muted">' + S.foods.length + ' foods · ' + S.vendors.length + ' vendors · new for 2026</span></span></a>' +

    '<div class="chip-row scroll" role="group" aria-label="Browse by category">' +
    ['Deep Fried', 'On a Stick', 'Sweet', 'Savory', 'Drinks'].map(c =>
      '<button class="chip" onclick="location.hash=\'#/search?cat=' + c + '\'">' + c + '</button>').join('') +
    '</div>' +

    '<div class="notice" role="note"><span aria-hidden="true">🏆</span><span class="grow"><b>Daily challenge</b><br><span class="muted">' + esc(ch.text.replace(/^Daily Challenge: /, '').replace(/ 🍟$/, '')) + '</span></span>' +
    '<button class="btn small ghost" onclick="location.hash=\'#/search?cat=Deep Fried\'">Start</button></div>' +

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
        (listRating(l).count ? '<span class="rate">🌭 ' + listRating(l).avg.toFixed(1) + '</span>' : '') + '</div>' +
        '<div class="sub">' + l.foodIds.length + ' foods · ' + l.views.toLocaleString() + ' views</div>' +
        '<div class="feat-owner">' + avatarHtml(owner, 'av') + '<span>' + userName(owner) + '</span></div>' +
        '</div></a>';
    }).join('') +
    '</div>' +

    '<div class="section-title"><span>New this year</span><a class="see-all" href="#/search?new=1">Show all</a></div>' +
    '<div class="hlist" role="list">' + fresh.map(foodMiniCardHtml).join('') + '</div>' +

    '<div class="section-title"><span>Trending now</span></div>' +
    '<div class="grid2">' + trend.map(foodCardHtml).join('') + '</div>';
}

/* ================= SEARCH ================= */
const searchState = { q: '', onlyNew: false, cat: '', diets: [], price: '', minRating: 0 };

function viewSearch(el, params) {
  if (params.get('new') === '1') { searchState.onlyNew = true; }
  if (params.get('cat')) { searchState.cat = params.get('cat'); }
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
    '<div class="chip-row scroll" role="group" aria-label="Dietary and price filters">' +
    ['vegetarian', 'vegan', 'gluten-free', 'dairy-free'].map(d =>
      '<button class="chip ' + (searchState.diets.includes(d) ? 'on' : '') + '" aria-pressed="' + searchState.diets.includes(d) + '" onclick="toggleDiet(\'' + d + '\')">' + d + '</button>').join('') +
    '<select aria-label="Price range" style="width:auto;padding:6px 10px;border-radius:999px;font-size:12.5px" onchange="searchState.price=this.value;render()">' +
    '<option value="" ' + (searchState.price === '' ? 'selected' : '') + '>Any price</option>' +
    '<option value="low" ' + (searchState.price === 'low' ? 'selected' : '') + '>Under $6</option>' +
    '<option value="mid" ' + (searchState.price === 'mid' ? 'selected' : '') + '>$6–$10</option>' +
    '<option value="high" ' + (searchState.price === 'high' ? 'selected' : '') + '>Over $10</option>' +
    '</select>' +
    '<select aria-label="Minimum rating" style="width:auto;padding:6px 10px;border-radius:999px;font-size:12.5px" onchange="searchState.minRating=+this.value;render()">' +
    [0, 3, 4, 4.5].map(r => '<option value="' + r + '" ' + (searchState.minRating === r ? 'selected' : '') + '>' + (r ? '🌭 ' + r + '+' : 'Any rating') + '</option>').join('') +
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
        vendors.map(x => '<button role="option" onclick="location.hash=\'#/map?vendor=' + x.id + '\'">📍 ' + esc(x.name) + ' <span class="muted">(vendor)</span></button>').join('') +
        '</div>';
    } else box.innerHTML = '';
  } else box.innerHTML = '';
  document.getElementById('searchResults').innerHTML = searchResultsHtml();
}
function matchFilters(f) {
  const q = searchState.q.trim().toLowerCase();
  if (q) {
    const v = getVendor(f.vendorId);
    const hit = f.name.toLowerCase().includes(q) || (v && v.name.toLowerCase().includes(q)) || f.cats.some(c => c.toLowerCase().includes(q));
    if (!hit) return false;
  }
  if (searchState.onlyNew && !f.isNew) return false;
  if (searchState.cat && !f.cats.includes(searchState.cat)) return false;
  if (searchState.diets.length && !searchState.diets.every(d => f.dietary.includes(d))) return false;
  if (searchState.price === 'low' && f.price >= 6) return false;
  if (searchState.price === 'mid' && (f.price < 6 || f.price > 10)) return false;
  if (searchState.price === 'high' && f.price <= 10) return false;
  if (searchState.minRating) {
    const r = foodRating(f.id);
    if (!r.count || r.avg < searchState.minRating) return false;
  }
  return true;
}
function searchResultsHtml() {
  const results = S.foods.filter(matchFilters);
  const anyFilter = searchState.q.trim() || searchState.onlyNew || searchState.cat || searchState.diets.length || searchState.price || searchState.minRating;
  let h = '';
  if (!anyFilter) {
    h += '<div class="section-title"><span>Popular searches</span></div><div class="chip-row">' +
      S.analytics.topSearches.map(t => '<button class="chip" onclick="searchState.q=\'' + esc(t) + '\';render()">' + esc(t) + '</button>').join('') + '</div>';
  }
  /* sponsored influencer lists ride above organic results, like search ads */
  const sp = sponsoredLists().filter(l => l.ownerId !== S.currentUserId).slice(0, 2);
  if (sp.length) {
    h += '<div class="muted" style="margin:12px 2px 6px;font-size:11.5px;letter-spacing:.3px"><b style="color:var(--ink)">Sponsored</b> · influencer lists</div>' +
      sp.map(l => listRowHtml(l, { sponsored: true })).join('');
  }
  h += '<div class="muted" style="margin:12px 2px 4px">' + results.length + ' food' + (results.length === 1 ? '' : 's') + '</div>';
  h += '<div class="grid2">' + results.map(foodCardHtml).join('') + '</div>';
  if (!results.length) h += '<div class="empty"><span class="big">🫙</span>Nothing matches those filters.<br>Loosen up — it\'s the fair!</div>';
  return h;
}

/* ================= FOOD DETAIL ================= */
function viewFood(el, id) {
  const f = getFood(id);
  if (!f) { el.innerHTML = '<div class="empty">Food not found.</div>'; return; }
  const v = getVendor(f.vendorId);
  const rs = foodReviews(id).slice().sort((a, b) => b.ts - a.ts);
  const u = me();
  const myVendor = u.role === 'vendor' && v && v.ownerUserId === u.id;

  const allPhotos = rs.reduce((a, r) => a.concat(r.photos), []);
  el.innerHTML =
    photoHtml(f, 'hero') +
    '<div class="detail-head">' +
    '<h1>' + esc(f.name) + '</h1>' +
    '<div class="detail-meta">' + ratingLine(f.id) + ' · On ' + listCountForFood(f.id) + ' lists</div>' +
    '<div class="detail-meta"><b>' + esc(v.name) + '</b> · $' + f.price.toFixed(2).replace(/\.00$/, '') + ' · Open ' + esc(v.hours) + '</div>' +
    '</div>' +
    '<div class="action-row">' +
    '<button class="btn" onclick="openRateModal(\'' + f.id + '\')">Rate & review</button>' +
    '<button class="btn ghost" onclick="openAddToList(\'' + f.id + '\')">Save to list</button>' +
    '<button class="btn ghost" onclick="location.hash=\'#/map?vendor=' + v.id + '\'">Find booth</button>' +
    (myVendor || u.role === 'admin' ? '<button class="btn ghost" onclick="openHeroModal(\'' + f.id + '\')">Official photo</button>' : '') +
    '</div>' +
    (v.specials ? '<div class="notice"><span aria-hidden="true">🎉</span><span><b>Today:</b> ' + esc(v.specials) + '</span></div>' : '') +
    '<hr class="divider">' +
    '<p style="font-size:14.5px;line-height:1.6;margin:0">' + esc(f.desc) + '</p>' +
    '<div class="chip-row" style="margin-top:12px">' + foodPills(f) + '</div>' +
    (allPhotos.length ? '<hr class="divider"><div class="section-title" style="margin-top:0"><span>Photos from foodies</span></div>' +
      '<div class="gallery">' + allPhotos.map(p => '<img src="' + p + '" alt="Guest photo of ' + esc(f.name) + '">').join('') + '</div>' : '') +
    '<hr class="divider">' +
    '<div class="section-title" style="margin-top:0"><span>Reviews (' + rs.length + ')</span></div>' +
    (rs.length ? rs.map(r => reviewHtml(r, myVendor)).join('') :
      '<div class="empty"><span class="big">📝</span>No reviews yet — be the first!</div>');
}

function reviewHtml(r, canVendorRespond) {
  const ru = getUser(r.userId);
  const u = me();
  const liked = r.likes.includes(u.id);
  return '<div class="review">' +
    '<div class="review-head">' + avatarHtml(ru, 'av') +
    '<div class="grow"><b><a href="#/user/' + ru.id + '" style="color:inherit">' + userName(ru) + '</a></b>' +
    '<div class="muted">' + timeAgo(r.ts) + '</div></div>' + pups(r.rating) + '</div>' +
    '<div style="font-size:14px">' + esc(r.text) + '</div>' +
    (r.photos.length ? '<div class="review-photos">' + r.photos.map(p => '<img src="' + p + '" alt="Review photo">').join('') + '</div>' : '') +
    '<div class="review-actions">' +
    '<button class="' + (liked ? 'on' : '') + '" aria-pressed="' + liked + '" onclick="likeReview(\'' + r.id + '\')">Helpful · ' + r.likes.length + '</button>' +
    '<button onclick="toggleCommentBox(\'' + r.id + '\')">Comment · ' + r.comments.length + '</button>' +
    '<button onclick="reportContent(\'review\',\'' + r.id + '\')">Report</button>' +
    (canVendorRespond && !r.vendorResponse ? '<button onclick="openVendorReply(\'' + r.id + '\')">Respond</button>' : '') +
    '</div>' +
    (r.vendorResponse ? '<div class="vendor-reply"><b>Vendor response:</b> ' + esc(r.vendorResponse) + '</div>' : '') +
    r.comments.map(c => {
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
    [1, 2, 3, 4, 5].map(i => '<button type="button" role="radio" aria-checked="false" aria-label="' + i + ' Pronto Pup' + (i > 1 ? 's' : '') + '" onclick="setRate(' + i + ')">🌭</button>').join('') +
    '</div>' +
    '<div class="muted" id="rateHint" style="margin:4px 0 10px">Tap the pups! 1 = skip it · 5 = fair legend</div>' +
    '<label class="field">Your review <span class="muted">(10–500 characters)</span>' +
    '<textarea id="revText" maxlength="500" placeholder="How was it? Crunch level? Line length? Regrets?"></textarea></label>' +
    '<div class="muted" id="charCount" style="margin:-6px 0 10px">0 / 500</div>' +
    '<div class="field" style="font-weight:700;font-size:13px">Photos <span class="muted">(up to 3)</span><br>' +
    '<input type="file" accept="image/png,image/jpeg" onchange="addRatePhoto(this)" aria-label="Add review photo"></div>' +
    '<div class="review-photos" id="ratePhotoRow"></div>' +
    '<button class="btn block" onclick="submitReview(\'' + foodId + '\')">Post review 🌭</button>',
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
  if (!rateVal) { toast('Pick a Pronto Pup rating first! 🌭'); return; }
  if (text.length < 10) { toast('Review must be at least 10 characters'); return; }
  const u = me();
  const r = { id: uid('r'), foodId, userId: u.id, rating: rateVal, text, photos: ratePhotos.slice(), likes: [], comments: [], reported: false, removed: false, ts: Date.now(), vendorResponse: null };
  S.reviews.push(r);
  u.qualityReviews++;
  /* PRD: Blogger badge after 25 quality reviews */
  if (u.qualityReviews >= 25 && !u.badges.includes('Blogger')) { u.badges.push('Blogger'); pushToast('🏅 Badge earned: Blogger!'); }
  const f = getFood(foodId);
  logActivity(u.id, 'reviewed ' + f.name + ' — ' + rateVal + ' Pups 🌭', '#/food/' + foodId);
  u.followers.forEach(fid => notify(fid, u.name + ' reviewed ' + f.name + ' (' + rateVal + ' 🌭)', '#/food/' + foodId));
  const v = getVendor(f.vendorId);
  if (v && v.ownerUserId) notify(v.ownerUserId, 'New ' + rateVal + '🌭 review on ' + f.name, '#/food/' + foodId);
  save(); closeModal(); render();
  toast('Review posted — thanks for feeding the community! 🎪');
}

/* ---- vendor reply ---- */
function openVendorReply(reviewId) {
  openModal('<h2>↩️ Respond to review</h2>' +
    '<label class="field">Your public response<textarea id="vrText" maxlength="300"></textarea></label>' +
    '<button class="btn block" onclick="submitVendorReply(\'' + reviewId + '\')">Post response</button>');
}
function submitVendorReply(reviewId) {
  const t = document.getElementById('vrText').value.trim();
  if (!t) return;
  const r = getReview(reviewId);
  r.vendorResponse = t;
  notify(r.userId, 'A vendor responded to your review', '#/food/' + r.foodId);
  save(); closeModal(); render();
  toast('Response posted');
}

/* ================= LISTS ================= */
function viewLists(el) {
  const u = me();
  const mine = S.lists.filter(l => l.ownerId === u.id || l.collaborators.includes(u.id));
  const sponsored = sponsoredLists().filter(l => l.ownerId !== u.id && !l.collaborators.includes(u.id));
  const spIds = sponsored.map(l => l.id);
  const discover = S.lists.filter(l => l.ownerId !== u.id && !l.collaborators.includes(u.id) && !spIds.includes(l.id) &&
    (l.privacy === 'public' || (l.privacy === 'friends' && getUser(l.ownerId).followers.includes(u.id))));
  el.innerHTML =
    '<div class="row between"><h1 style="font-size:21px;font-weight:700;margin:4px 0 14px">Lists</h1>' +
    '<button class="btn small secondary" onclick="openNewList()">+ New list</button></div>' +
    (sponsored.length ?
      '<div class="muted" style="margin:0 2px 6px;font-size:11.5px;letter-spacing:.3px"><b style="color:var(--ink)">Sponsored</b> · influencer lists</div>' +
      sponsored.map(l => listRowHtml(l, { sponsored: true })).join('') : '') +
    '<div class="section-title"><span>Your lists</span></div>' +
    (mine.length ? mine.map(l => listRowHtml(l)).join('') :
      '<div class="empty"><span class="big">📋</span>No lists yet. Make one to plan your fair day!</div>') +
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
    '<div class="muted">' + (listRating(l).count ? '🌭 ' + listRating(l).avg.toFixed(1) + ' · ' : '') + userName(owner) + ' · ' + l.foodIds.length + ' foods · ' + l.likes.length + ' likes</div></span>' +
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
  const total = foods.reduce((a, f) => a + f.price, 0);

  el.innerHTML =
    '<div style="margin:4px 0 16px">' +
    '<div class="row between"><h1 style="font-size:21px;font-weight:700">' + esc(l.name) + (l.featured ? ' <span class="vbadge" title="Featured">★</span>' : '') + '</h1>' +
    '<span class="pill privacy">' + l.privacy + '</span></div>' +
    '<div class="muted" style="margin:6px 0 12px">' +
    (listRating(l).count ? '🌭 <b style="color:var(--ink)">' + listRating(l).avg.toFixed(1) + '</b> (' + listRating(l).count + ') · ' : '') +
    userName(owner) + ' · ' + foods.length + ' foods · est. $' + total.toFixed(2) + ' · ' + l.views.toLocaleString() + ' views</div>' +
    '<div class="row" style="flex-wrap:wrap">' +
    '<button class="btn small" onclick="location.hash=\'#/map?list=' + l.id + '\'">Map route</button>' +
    '<button class="btn small ghost ' + (liked ? 'on' : '') + '" aria-pressed="' + liked + '" onclick="likeList(\'' + l.id + '\')" style="' + (liked ? 'color:var(--accent);border-color:var(--accent)' : '') + '">♥ ' + l.likes.length + '</button>' +
    '<button class="btn small ghost" onclick="shareList(\'' + l.id + '\')">Share</button>' +
    '<button class="btn small ghost" onclick="duplicateList(\'' + l.id + '\')">Duplicate</button>' +
    (isOwner ? '<button class="btn small ghost" onclick="openListSettings(\'' + l.id + '\')">Settings</button>' : '') +
    (isOwner && u.role === 'influencer' && !l.featured && l.privacy === 'public' ? '<button class="btn small ghost" onclick="requestFeatured(\'' + l.id + '\')">★ Submit for featured</button>' : '') +
    '</div></div>' +

    (!canEdit ?
      '<div class="card row between">' +
      '<span><b style="font-size:14px">Rate this list</b><br><span class="muted">' +
      ((l.ratings || {})[u.id] ? 'You gave it ' + l.ratings[u.id] + ' Pronto Pup' + (l.ratings[u.id] > 1 ? 's' : '') + ' — tap to change' : 'Score the whole list, 1–5 Pronto Pups') +
      '</span></span>' +
      '<span class="pup-input" role="radiogroup" aria-label="Rate this list in Pronto Pups">' +
      [1, 2, 3, 4, 5].map(i =>
        '<button type="button" role="radio" aria-checked="' + ((l.ratings || {})[u.id] === i) + '" class="' + (i <= ((l.ratings || {})[u.id] || 0) ? 'on' : '') + '" style="font-size:22px" ' +
        'aria-label="' + i + ' Pronto Pup' + (i > 1 ? 's' : '') + '" onclick="rateList(\'' + l.id + '\',' + i + ')">🌭</button>').join('') +
      '</span></div>' : '') +

    (foods.length ? foods.map(f =>
      '<div class="card food-card">' +
      '<a href="#/food/' + f.id + '" aria-hidden="true" tabindex="-1">' + photoHtml(f, 'thumb') + '</a>' +
      '<span class="grow"><h3><a href="#/food/' + f.id + '">' + esc(f.name) + '</a></h3>' +
      '<div class="muted">' + esc(getVendor(f.vendorId).name) + ' · $' + f.price.toFixed(2).replace(/\.00$/, '') + '</div>' +
      ratingLine(f.id) + '</span>' +
      (canEdit ? '<button class="btn small ghost" aria-label="Remove ' + esc(f.name) + '" onclick="removeFromList(\'' + l.id + '\',\'' + f.id + '\')">✕</button>' : '') +
      '</div>').join('') :
      '<div class="empty"><span class="big">🍽️</span>Empty list — <a href="#/search">go find some food!</a></div>') +

    '<div class="section-title"><span>💬 Comments (' + l.comments.length + ')</span></div>' +
    '<div class="card">' +
    l.comments.map(c => {
      const cu = getUser(c.userId);
      return '<div class="comment">' + avatarHtml(cu, 'av') + '<div><b>' + userName(cu) + '</b> ' + esc(c.text) + ' <span class="muted">' + timeAgo(c.ts) + '</span></div></div>';
    }).join('') +
    '<div class="row" style="margin-top:10px"><input type="text" id="listComment" placeholder="Add a comment…" aria-label="Comment on this list" maxlength="200">' +
    '<button class="btn small" onclick="commentList(\'' + l.id + '\')">Post</button></div>' +
    '</div>';
}
function rateList(id, n) {
  const l = getList(id); const u = me();
  if (l.ownerId === u.id || l.collaborators.includes(u.id)) { toast('You can\'t rate your own list'); return; }
  l.ratings = l.ratings || {};
  const had = l.ratings[u.id];
  l.ratings[u.id] = n;
  if (!had) {
    notify(l.ownerId, u.name + ' rated your list "' + l.name + '" ' + n + ' 🌭', '#/list/' + id);
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
function shareList(id) {
  const l = getList(id);
  const link = location.origin + location.pathname + '#/list/' + id;
  const record = () => {
    if (l.ownerId !== S.currentUserId) notify(l.ownerId, me().name + ' shared your list "' + l.name + '"', '#/list/' + id);
    logActivity(S.currentUserId, 'shared list "' + l.name + '"', '#/list/' + id);
    save();
  };
  if (navigator.share) {
    // native share sheet: text message, WhatsApp, email, socials…
    navigator.share({ title: l.name, text: 'Rate my fair food list "' + l.name + '" on Fair Foodie:', url: link })
      .then(record).catch(() => {});
  } else {
    const done = () => { toast('Link copied — paste it into a text or post'); record(); };
    if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, done); else done();
  }
}
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
