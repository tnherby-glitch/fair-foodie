/* Views: map, feed, notifications, profile, vendor dashboard, admin console */
/* global S, save, uid, me, getUser, getFood, getVendor, getList, getReview, foodReviews, foodRating, listCountForFood, trendingFoods, notify, myNotifications, logActivity, esc, timeAgo, toast, pushToast, openModal, closeModal, pups, ratingLine, avatarHtml, userName, foodPills, foodCardHtml, updateBell, updateAvatarBtn, readImage, render, resetState, avatarInline */

/* ================= MAP ================= */
const mapState = { listId: '', vendorSel: '', amen: { restroom: true, atm: false, firstaid: false } };
const ENTRANCE = { x: 400, y: 578 };

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function routeFor(listId) {
  const l = getList(listId);
  if (!l) return [];
  const stops = [];
  const seen = {};
  l.foodIds.forEach(fid => {
    const f = getFood(fid);
    if (f && !seen[f.vendorId]) { seen[f.vendorId] = true; stops.push(getVendor(f.vendorId)); }
  });
  // nearest-neighbor from the main gate
  const route = [];
  let cur = ENTRANCE;
  const left = stops.slice();
  while (left.length) {
    left.sort((a, b) => dist(cur, a) - dist(cur, b));
    const nxt = left.shift();
    route.push(nxt);
    cur = nxt;
  }
  return route;
}

function viewMap(el, params) {
  if (params.get('vendor')) { mapState.vendorSel = params.get('vendor'); }
  if (params.get('list')) { mapState.listId = params.get('list'); }
  const u = me();
  const myLists = S.lists.filter(l => l.ownerId === u.id || l.collaborators.includes(u.id) || (l.privacy === 'public' && l.featured));
  const route = mapState.listId ? routeFor(mapState.listId) : [];
  const routeIds = route.map(v => v.id);
  const routePts = [ENTRANCE].concat(route);
  let walkMeters = 0;
  for (let i = 1; i < routePts.length; i++) walkMeters += dist(routePts[i - 1], routePts[i]) * 1.6; // ~1.6 m per px
  const walkMin = Math.round(walkMeters / 75); // 75 m/min fair-crowd pace

  let svg = '<svg class="map-svg" viewBox="0 0 800 620" role="img" aria-label="Fairgrounds map with vendor locations">' +
    '<rect width="800" height="620" fill="#f2f3ef"/>' +
    // blocks
    '<rect x="60" y="60" width="680" height="500" fill="#f8f9f5" stroke="#e4e6de" rx="18"/>' +
    // streets
    streetH(185, 'Randall Ave') + streetH(295, 'Judson Ave') + streetH(410, 'Carnes Ave') + streetH(515, 'Dan Patch Ave') +
    streetV(140) + streetV(420) + streetV(690) +
    // landmarks
    '<rect x="600" y="300" width="120" height="70" fill="#eeeade" stroke="#ddd5bd" rx="8"/><text x="660" y="340" text-anchor="middle" font-size="13" fill="#8a8060">Food Bldg</text>' +
    '<rect x="470" y="70" width="200" height="80" fill="#eae6f0" stroke="#d5cee0" rx="8"/><text x="570" y="115" text-anchor="middle" font-size="13" fill="#7d6f99">Midway</text>' +
    '<circle cx="120" cy="120" r="38" fill="#e2ecf2" stroke="#c3d6e2"/><text x="120" y="125" text-anchor="middle" font-size="11" fill="#5b7c92">Ye Old Mill</text>' +
    '<rect x="330" y="530" width="140" height="34" fill="#222" rx="8"/><text x="400" y="552" text-anchor="middle" font-size="13" fill="#fff" font-weight="bold">MAIN GATE</text>';

  // route polyline
  if (route.length) {
    const ptsStr = routePts.map(p => p.x + ',' + p.y).join(' ');
    svg += '<polyline points="' + ptsStr + '" fill="none" stroke="#e0243c" stroke-width="3.5" stroke-dasharray="8 6" stroke-linecap="round" opacity=".8"/>';
  }

  // amenities
  S.amenities.forEach(a => {
    if (!mapState.amen[a.type]) return;
    a.spots.forEach(s => {
      svg += '<text x="' + s.x + '" y="' + s.y + '" text-anchor="middle" font-size="20" aria-label="' + a.label + '">' + a.icon + '</text>';
    });
  });

  // vendor pins
  S.vendors.forEach(v => {
    const onRoute = routeIds.indexOf(v.id);
    const sel = mapState.vendorSel === v.id;
    const color = sel ? '#222222' : (onRoute >= 0 ? '#e0243c' : '#9a938a');
    const r = sel || onRoute >= 0 ? 15 : 10;
    svg += '<g class="map-pin" role="button" tabindex="0" aria-label="' + esc(v.name) + '" onclick="mapPick(\'' + v.id + '\')" onkeydown="if(event.key===\'Enter\')mapPick(\'' + v.id + '\')">' +
      '<circle cx="' + v.x + '" cy="' + v.y + '" r="' + r + '" fill="' + color + '" stroke="#fff" stroke-width="2.5"/>' +
      (onRoute >= 0
        ? '<text x="' + v.x + '" y="' + (v.y + 5) + '" text-anchor="middle" font-size="14" fill="#fff" font-weight="bold">' + (onRoute + 1) + '</text>'
        : '<circle cx="' + v.x + '" cy="' + v.y + '" r="4" fill="#fff"/>') +
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
    (route.length ? '<div class="muted" style="margin-bottom:8px">🚶 Optimal route: <b>' + route.length + ' stops</b> · ~<b>' + walkMin + ' min</b> walking from Main Gate (numbered pins)</div>' : '') +
    '<div class="chip-row" style="margin:0">' +
    S.amenities.map(a => '<button class="chip ' + (mapState.amen[a.type] ? 'on' : '') + '" aria-pressed="' + mapState.amen[a.type] + '" onclick="mapState.amen.' + a.type + '=!mapState.amen.' + a.type + ';render()">' + a.icon + ' ' + a.label + '</button>').join('') +
    '</div></div></div>' +
    (selVendor ? vendorCardHtml(selVendor, routeIds.indexOf(selVendor.id)) : '<div class="muted" style="margin:10px 4px">Tap a pin to see the vendor\'s menu. Red numbered pins are your list route.</div>');
}
function streetH(y, name) {
  return '<line x1="70" y1="' + y + '" x2="730" y2="' + y + '" stroke="#fff" stroke-width="14"/>' +
    '<line x1="70" y1="' + y + '" x2="730" y2="' + y + '" stroke="#e2e2de" stroke-width="16" opacity=".4"/>' +
    '<text x="78" y="' + (y - 12) + '" font-size="11" fill="#9a938a">' + name + '</text>';
}
function streetV(x) {
  return '<line x1="' + x + '" y1="70" x2="' + x + '" y2="550" stroke="#fff" stroke-width="12" opacity=".9"/>';
}
function mapPick(vid) {
  mapState.vendorSel = mapState.vendorSel === vid ? '' : vid;
  render();
}
function vendorCardHtml(v, routeIdx) {
  const menu = S.foods.filter(f => f.vendorId === v.id);
  return '<div class="card">' +
    '<div class="row between"><h2 style="font-size:16px;margin:0;font-weight:600">' + esc(v.name) + (v.verified ? ' <span class="vbadge">✔</span>' : '') + '</h2>' +
    (routeIdx >= 0 ? '<span class="pill new">Stop ' + (routeIdx + 1) + '</span>' : '') + '</div>' +
    '<div class="muted" style="margin:4px 0">' + esc(v.desc) + ' · Open ' + esc(v.hours) + '</div>' +
    (v.specials ? '<div class="vendor-reply">Today: ' + esc(v.specials) + '</div>' : '') +
    '<div class="muted" style="margin:8px 0 4px">Est. wait <b>' + waitEstimate(v) + ' min</b> · ' + Math.round(dist(ENTRANCE, v) * 1.6 / 75) + ' min walk from Main Gate</div>' +
    menu.map(f => '<a class="row between" style="padding:7px 0;border-top:1px solid var(--line);color:inherit" href="#/food/' + f.id + '">' +
      '<span>' + f.emoji + ' ' + esc(f.name) + (f.soldOut ? ' <span class="pill soldout">SOLD OUT</span>' : '') + '</span>' +
      '<span class="muted">$' + f.price.toFixed(2).replace(/\.00$/, '') + '</span></a>').join('') +
    '</div>';
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
    '<div class="stat"><b>' + (avg ? avg.toFixed(1) + '🌭' : '—') + '</b><span>Avg rating</span></div>' +
    '</div>' +
    '<div class="row" style="justify-content:center;flex-wrap:wrap">' +
    '<button class="btn small secondary" onclick="openEditProfile()">✏️ Edit profile</button>' +
    (u.role === 'vendor' ? '<button class="btn small" onclick="location.hash=\'#/vendor\'">🏪 Vendor dashboard</button>' : '') +
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
  S.currentUserId = null;
  save();
  location.hash = '#/home';
  render();
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
  readImage(input.files[0], 5, data => { me().avatar = data; save(); toast('Photo updated'); updateAvatarBtn(); });
}
function saveProfile() {
  const u = me();
  u.name = document.getElementById('epName').value.trim() || u.name;
  u.bio = document.getElementById('epBio').value.trim();
  save(); closeModal(); render();
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
    '<div class="stat"><b>' + avg + '🌭</b><span>Avg rating given</span></div>' +
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

/* ================= VENDOR DASHBOARD ================= */
function viewVendorDash(el) {
  const u = me();
  const myVendors = S.vendors.filter(v => v.ownerUserId === u.id);
  if (!myVendors.length) {
    const unclaimed = S.vendors.filter(v => !v.ownerUserId);
    el.innerHTML = '<h1 style="font-size:21px;font-weight:700;margin:4px 0 14px">Claim your booth</h1>' +
      '<div class="card"><p style="font-size:14px">Are you a fair vendor? Claim your business profile — a fair administrator will verify your request.</p>' +
      '<label class="field">Your booth<select id="claimVendor">' + unclaimed.map(v => '<option value="' + v.id + '">' + esc(v.name) + '</option>').join('') + '</select></label>' +
      '<label class="field">Business license # / note<input type="text" id="claimNote" placeholder="e.g. MN-1234"></label>' +
      '<button class="btn block" onclick="submitClaim()">Submit claim for verification</button></div>';
    return;
  }
  const v = myVendors[0];
  const menu = S.foods.filter(f => f.vendorId === v.id);
  const menuReviews = S.reviews.filter(r => !r.removed && menu.some(f => f.id === r.foodId));
  const unanswered = menuReviews.filter(r => !r.vendorResponse);
  const peak = [15, 30, 55, 80, 100, 85, 60, 35];
  const peakLabels = ['9a', '11a', '1p', '3p', '5p', '7p', '9p', '11p'];

  el.innerHTML =
    '<h1 style="font-size:21px;font-weight:700;margin:4px 0 14px">' + esc(v.name) + (v.verified ? ' <span class="vbadge" style="font-size:13px">✔ Verified</span>' : ' <span class="pill">verification pending</span>') + '</h1>' +

    '<div class="card"><h3 style="margin:0 0 8px;font-size:15px">Booth info</h3>' +
    '<label class="field">Operating hours<input type="text" id="vdHours" value="' + esc(v.hours) + '"></label>' +
    '<label class="field">Today\'s special <span class="muted">(shown on your foods)</span><input type="text" id="vdSpecial" value="' + esc(v.specials) + '" placeholder="e.g. 2-for-1 after 8pm"></label>' +
    '<button class="btn small" onclick="saveVendorInfo(\'' + v.id + '\')">Save booth info</button></div>' +

    '<div class="section-title"><span>Menu (' + menu.length + ')</span></div>' +
    menu.map(f => {
      const r = foodRating(f.id);
      return '<div class="card">' +
        '<div class="row between"><b>' + f.emoji + ' ' + esc(f.name) + '</b><span class="muted">$' + f.price.toFixed(2) + '</span></div>' +
        '<div class="muted" style="margin:4px 0">' + (r.count ? r.avg.toFixed(1) + '🌭 avg · ' + r.count + ' reviews' : 'No reviews yet') + ' · on ' + listCountForFood(f.id) + ' lists</div>' +
        '<div class="row" style="flex-wrap:wrap">' +
        '<button class="btn small ' + (f.soldOut ? 'secondary' : 'ghost') + '" aria-pressed="' + f.soldOut + '" onclick="toggleSoldOut(\'' + f.id + '\')">' + (f.soldOut ? 'Sold out — tap to restock' : 'Mark sold out') + '</button>' +
        '<button class="btn small ghost" onclick="openEditFood(\'' + f.id + '\')">Edit item</button>' +
        '<button class="btn small ghost" onclick="openHeroModal(\'' + f.id + '\')">' + (f.heroImg ? 'Change photo' : 'Add photo') + '</button>' +
        '</div></div>';
    }).join('') +

    '<div class="section-title"><span>📊 Booth analytics</span></div>' +
    '<div class="card"><h3 style="margin:0;font-size:14px">Peak interest by hour</h3>' +
    '<div class="bars" role="img" aria-label="Peak interest by hour, busiest at 5pm">' +
    peak.map((p, i) => '<div class="bar" style="height:' + p + '%"><em>' + p + '</em><span>' + peakLabels[i] + '</span></div>').join('') +
    '</div><div style="height:22px"></div>' +
    '<div class="muted">Total reviews: <b>' + menuReviews.length + '</b> · List adds: <b>' + menu.reduce((a, f) => a + listCountForFood(f.id), 0) + '</b></div></div>' +

    '<div class="section-title"><span>💬 Reviews needing a response (' + unanswered.length + ')</span></div>' +
    (unanswered.length ? '<div class="card">' + unanswered.map(r =>
      '<div class="review"><div class="row between"><b>' + esc(getFood(r.foodId).name) + '</b>' + pups(r.rating) + '</div>' +
      '<div style="font-size:13.5px;margin:4px 0">' + esc(r.text) + '</div>' +
      '<button class="btn small secondary" onclick="openVendorReply(\'' + r.id + '\')">↩️ Respond</button></div>').join('') + '</div>' :
      '<div class="empty">All caught up! 🎉</div>');
}
function submitClaim() {
  const vid = document.getElementById('claimVendor').value;
  S.vendorRequests.push({ id: uid('vr'), vendorId: vid, requesterName: me().name, requesterUserId: S.currentUserId, email: '', note: document.getElementById('claimNote').value, status: 'pending', ts: Date.now() });
  save();
  toast('Claim submitted — an admin will verify it. ✅');
  location.hash = '#/home';
}
function saveVendorInfo(vid) {
  const v = getVendor(vid);
  v.hours = document.getElementById('vdHours').value.trim() || v.hours;
  v.specials = document.getElementById('vdSpecial').value.trim();
  save(); toast('Booth info updated');
}
function toggleSoldOut(fid) {
  const f = getFood(fid);
  f.soldOut = !f.soldOut;
  save(); render();
  toast(f.soldOut ? f.name + ' marked sold out for today' : f.name + ' is back!');
}
/* ---- official (hero) photo: set by owning vendor or admin ---- */
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
  getFood(fid).heroImg = heroTemp;
  save(); closeModal(); render();
  toast('Official photo updated');
}
function removeHero(fid) {
  getFood(fid).heroImg = null;
  save(); closeModal(); render();
  toast('Official photo removed — guest photos will show instead');
}

function openEditFood(fid) {
  const f = getFood(fid);
  openModal('<h2>✏️ Edit menu item</h2>' +
    '<label class="field">Name<input type="text" id="efName" value="' + esc(f.name) + '"></label>' +
    '<label class="field">Price ($)<input type="number" id="efPrice" step="0.5" min="0" value="' + f.price + '"></label>' +
    '<label class="field">Description<textarea id="efDesc">' + esc(f.desc) + '</textarea></label>' +
    '<label class="field">Dietary info <span class="muted">(comma separated: vegetarian, vegan, gluten-free, dairy-free)</span>' +
    '<input type="text" id="efDiet" value="' + f.dietary.join(', ') + '"></label>' +
    '<button class="btn block" onclick="saveFood(\'' + fid + '\')">Save item</button>');
}
function saveFood(fid) {
  const f = getFood(fid);
  f.name = document.getElementById('efName').value.trim() || f.name;
  f.price = parseFloat(document.getElementById('efPrice').value) || f.price;
  f.desc = document.getElementById('efDesc').value.trim();
  f.dietary = document.getElementById('efDiet').value.split(',').map(s => s.trim()).filter(Boolean);
  save(); closeModal(); render();
  toast('Menu item updated');
}

/* ================= ADMIN CONSOLE ================= */
let adminTab = 'moderation';
function viewAdmin(el) {
  const u = me();
  if (u.role !== 'admin') { el.innerHTML = '<div class="empty"><span class="big">🚫</span>Admins only.</div>'; return; }
  const tabs = [['moderation', '🚩 Reports'], ['users', '👥 Users'], ['vendors', '🏪 Vendors'], ['featured', '⭐ Featured'], ['analytics', '📈 Analytics'], ['push', '📣 Push']];
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
  if (adminTab === 'vendors') {
    const pending = S.vendorRequests.filter(r => r.status === 'pending');
    return pending.length ? pending.map(r =>
      '<div class="card"><b>' + (r.isFeatureRequest ? '⭐ Featured list request' : '🏪 Vendor claim: ' + esc(getVendor(r.vendorId).name)) + '</b>' +
      '<div class="muted">' + esc(r.requesterName) + (r.email ? ' · ' + esc(r.email) : '') + ' · ' + timeAgo(r.ts) + '</div>' +
      '<div style="font-size:13.5px;margin:4px 0">' + esc(r.note) + '</div>' +
      '<div class="row"><button class="btn small" onclick="adminApprove(\'' + r.id + '\')">Approve</button>' +
      '<button class="btn small ghost" onclick="adminDeny(\'' + r.id + '\')">Deny</button></div></div>').join('') :
      '<div class="empty"><span class="big">✅</span>No pending vendor requests.</div>';
  }
  if (adminTab === 'featured') {
    const pub = S.lists.filter(l => l.privacy === 'public');
    return '<p class="muted" style="margin:2px 2px 12px">Featured lists appear as Sponsored placements above organic results. The <b>default</b> list is pinned first for every user.</p>' +
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
      mostReviewed.map(f => '<tr><td>' + f.emoji + ' ' + esc(f.name) + '</td><td>' + foodReviews(f.id).length + ' reviews</td><td>' + (foodRating(f.id).avg || 0).toFixed(1) + '🌭</td></tr>').join('') +
      '</table></div>' +
      '<button class="btn secondary block" onclick="adminExport()">⬇️ Export data (JSON)</button>';
  }
  if (adminTab === 'push') {
    return '<div class="card"><h3 style="margin:0 0 8px;font-size:14px">Send push notification</h3>' +
      '<label class="field">Audience<select id="pushSeg"><option value="all">All users</option><option value="attendee">Attendees</option><option value="vendor">Vendors</option><option value="influencer">Influencers</option></select></label>' +
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
  if (r.isFeatureRequest) {
    const l = getList(r.featuredListId);
    if (l) { l.featured = true; notify(l.ownerId, '⭐ Your list "' + l.name + '" is now Featured!', '#/list/' + l.id); }
  } else {
    const v = getVendor(r.vendorId);
    v.verified = true;
    if (r.requesterUserId) { v.ownerUserId = r.requesterUserId; notify(r.requesterUserId, '✅ Your claim for ' + v.name + ' was approved!', '#/vendor'); }
  }
  save(); render();
  toast('Approved ✅');
}
function adminDeny(reqId) {
  const r = S.vendorRequests.find(x => x.id === reqId);
  r.status = 'denied';
  if (r.requesterUserId) notify(r.requesterUserId, 'Your vendor claim was denied. Contact fair admin for details.', '');
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
