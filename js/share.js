/* Share flow: story/feed asset generation + native share sheet + public list view.
   Per docs/SHARING.md — the list is the first-class shareable object. */
/* global S, save, me, getUser, getFood, getList, getVendor, foodRating, blueRibbon, esc, toast, openModal, closeModal, render, ListStore, ensureSlug, listShareUrl, slugify, notify, uid, logActivity, fmtCount, ratingCompact, photoHtml, qrcode, listRating */

const BRAND = {
  gold: '#E89C31', goldSoft: '#F6C778', goldDeep: '#C97F1B', ketchup: '#D64533',
  ink: '#211A16', ink60: '#6E655C', cream: '#FFF7EC', paper: '#FFFFFF', line: '#EFE8DD',
  ribbon: '#2B4C9B', stick: '#8C5A2B', pupOff: '#E9E2D7', stickOff: '#D8D0C4',
};

function _loadImg(src) {
  return new Promise(res => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

/* the Pin-Pup mark, drawn in canvas vector (scale: height of the body+stick unit is ~320) */
function drawMark(ctx, x, y, h) {
  const s = h / 320;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // stick
  ctx.fillStyle = BRAND.stick;
  ctx.beginPath();
  ctx.moveTo(108, 200); ctx.lineTo(118, 294);
  ctx.quadraticCurveTo(120, 303, 122, 294);
  ctx.lineTo(132, 200); ctx.closePath(); ctx.fill();
  // body
  ctx.fillStyle = BRAND.gold;
  _rr(ctx, 72, 26, 96, 184, 48); ctx.fill();
  // highlight
  ctx.fillStyle = BRAND.goldSoft;
  _rr(ctx, 86, 46, 15, 42, 7.5); ctx.fill();
  // drizzle M, tilted 4°
  ctx.save();
  ctx.translate(120, 120); ctx.rotate(-4 * Math.PI / 180); ctx.translate(-120, -120);
  ctx.strokeStyle = BRAND.ketchup; ctx.lineWidth = 14.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(87, 138); ctx.lineTo(105, 98); ctx.lineTo(120, 142); ctx.lineTo(135, 98); ctx.lineTo(153, 138);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/* mini pup glyph for rating rows on the asset */
function drawPup(ctx, x, y, h, on) {
  const s = h / 320;
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = on ? BRAND.stick : BRAND.stickOff;
  ctx.beginPath();
  ctx.moveTo(108, 200); ctx.lineTo(118, 294);
  ctx.quadraticCurveTo(120, 303, 122, 294);
  ctx.lineTo(132, 200); ctx.closePath(); ctx.fill();
  ctx.fillStyle = on ? BRAND.gold : BRAND.pupOff;
  _rr(ctx, 72, 26, 96, 184, 48); ctx.fill();
  ctx.restore();
}

function _rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function _ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
  return text + '…';
}

/* Render the share asset. story = 1080x1920, feed = 1080x1080. */
async function renderShareAsset(list, owner, url, W, H) {
  try { await document.fonts.load('800 80px "Bricolage Grotesque"'); await document.fonts.load('600 40px "Plus Jakarta Sans"'); } catch (e) {}
  const story = H > W;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // canvas
  ctx.fillStyle = BRAND.paper; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = BRAND.cream; ctx.fillRect(0, 0, W, story ? 380 : 260);

  // header: mark + wordmark
  const markH = story ? 200 : 150;
  drawMark(ctx, 70, story ? 80 : 50, markH);
  ctx.fillStyle = BRAND.ketchup;
  ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
  ctx.save(); ctx.translate(0, 0);
  ctx.fillText('M N   F A I R', 300, story ? 160 : 110);
  ctx.restore();
  ctx.fillStyle = BRAND.ink;
  ctx.font = '800 76px "Bricolage Grotesque", sans-serif';
  ctx.fillText('Foodie Finder', 296, story ? 240 : 190);

  // list title + creator
  let y = story ? 500 : 350;
  ctx.fillStyle = BRAND.ink;
  ctx.font = '800 ' + (story ? 66 : 56) + 'px "Bricolage Grotesque", sans-serif';
  const title = list.name.toUpperCase();
  const words = title.split(' ');
  let line = '', lines = [];
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > W - 160 && line) { lines.push(line); line = w; } else line = t;
  }
  lines.push(line);
  lines.slice(0, 2).forEach(l => { ctx.fillText(l, 80, y); y += story ? 78 : 66; });
  ctx.fillStyle = BRAND.ink60;
  ctx.font = '600 40px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('by @' + (owner ? owner.handle : 'fairgoer'), 80, y + 8);
  y += story ? 90 : 70;

  // top foods (highest-rated first, photos preferred)
  const foods = list.foodIds.map(getFood).filter(Boolean)
    .sort((a, b) => foodRating(b.id).avg - foodRating(a.id).avg);
  const n = story ? 3 : 2;
  const rowH = story ? 260 : 230;
  for (let i = 0; i < Math.min(n, foods.length); i++) {
    const f = foods[i];
    const v = getVendor(f.vendorId);
    const imgSrc = f.heroImg || f.photo || (v && v.photo) || null;
    const img = imgSrc ? await _loadImg(imgSrc) : null;
    const px = 80, pw = story ? 210 : 190;
    // photo tile
    ctx.save();
    _rr(ctx, px, y, pw, pw, 28); ctx.clip();
    if (img) {
      const scale = Math.max(pw / img.width, pw / img.height);
      ctx.drawImage(img, px + (pw - img.width * scale) / 2, y + (pw - img.height * scale) / 2, img.width * scale, img.height * scale);
    } else {
      ctx.fillStyle = BRAND.goldSoft; ctx.fillRect(px, y, pw, pw);
      ctx.font = '90px serif'; ctx.fillText(f.emoji, px + 55, y + pw / 2 + 34);
    }
    ctx.restore();
    // name + rating
    const tx = px + pw + 44;
    ctx.fillStyle = BRAND.ink;
    ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(_ellipsize(ctx, f.name, W - tx - 260), tx, y + 86);
    const r = foodRating(f.id);
    drawPup(ctx, tx, y + 116, 66, true);
    ctx.font = '800 44px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(r.count ? r.avg.toFixed(1) : '—', tx + 66, y + 168);
    if (r.count) {
      ctx.fillStyle = BRAND.ink60;
      ctx.font = '500 34px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('(' + fmtCount(r.count) + ')', tx + 180, y + 168);
    }
    if (blueRibbon(f.id)) {
      ctx.fillStyle = BRAND.ribbon;
      _rr(ctx, W - 320, y + 20, 240, 56, 28); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('BLUE RIBBON', W - 296, y + 58);
    }
    y += rowH;
  }
  if (foods.length > n) {
    ctx.fillStyle = BRAND.ink60;
    ctx.font = '600 40px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('+ ' + (foods.length - n) + ' more on the list', 80, y + 10);
    y += 70;
  }

  // QR + link footer
  const qrSize = story ? 300 : 240;
  const qy = H - qrSize - 90;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const mods = qr.getModuleCount();
    const cell = qrSize / mods;
    ctx.fillStyle = BRAND.cream;
    _rr(ctx, 60, qy - 20, qrSize + 40, qrSize + 40, 24); ctx.fill();
    ctx.fillStyle = BRAND.ink;
    for (let r2 = 0; r2 < mods; r2++) for (let c2 = 0; c2 < mods; c2++) {
      if (qr.isDark(r2, c2)) ctx.fillRect(80 + c2 * cell, qy + r2 * cell, Math.ceil(cell), Math.ceil(cell));
    }
  } catch (e) { console.warn('qr failed', e); }
  ctx.fillStyle = BRAND.ink;
  ctx.font = '700 38px "Plus Jakarta Sans", sans-serif';
  const shortUrl = url.replace(/^https?:\/\//, '').split('?')[0];
  const linkX = 60 + qrSize + 80;
  // wrap the short link across two lines if needed
  const mid = shortUrl.lastIndexOf('/', Math.floor(shortUrl.length * 0.6));
  if (ctx.measureText(shortUrl).width > W - linkX - 60 && mid > 0) {
    ctx.fillText(shortUrl.slice(0, mid + 1), linkX, qy + qrSize / 2 - 16);
    ctx.fillText(shortUrl.slice(mid + 1), linkX, qy + qrSize / 2 + 36);
  } else {
    ctx.fillText(_ellipsize(ctx, shortUrl, W - linkX - 60), linkX, qy + qrSize / 2 + 10);
  }
  ctx.fillStyle = BRAND.ink60;
  ctx.font = '600 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Rated in pups on Foodie Finder', linkX, qy + qrSize / 2 + 90);

  return c;
}

/* ---------------- share modal ---------------- */
const shareState = { canvases: {}, mode: 'story', url: '', listId: '' };

async function openShareModal(listId) {
  const l = getList(listId);
  if (!l) return;
  const owner = getUser(l.ownerId);
  ensureSlug(l);
  const u = me();
  shareState.url = listShareUrl(l, u ? u.handle : '', 'share');
  shareState.listId = listId;
  shareState.mode = 'story';
  ListStore.publish(l, owner); // fire and forget; slug resolves cross-device once backend is configured

  openModal('<h2>Share this list</h2><div class="empty" id="shareBody">Rendering your story card…</div>');
  const story = await renderShareAsset(l, owner, shareState.url, 1080, 1920);
  const feed = await renderShareAsset(l, owner, shareState.url, 1080, 1080);
  shareState.canvases = { story, feed };
  const body = document.getElementById('shareBody');
  if (!body) return; // modal was closed while rendering
  body.className = '';
  body.innerHTML = shareBodyHtml();
}

function shareBodyHtml() {
  return '<div class="chip-row" style="margin-top:0">' +
    '<button class="chip ' + (shareState.mode === 'story' ? 'on' : '') + '" onclick="setShareMode(\'story\')">Story 9:16</button>' +
    '<button class="chip ' + (shareState.mode === 'feed' ? 'on' : '') + '" onclick="setShareMode(\'feed\')">Feed 1:1</button>' +
    '</div>' +
    '<img id="sharePreview" src="' + shareState.canvases[shareState.mode].toDataURL('image/png') + '" alt="Share card preview" style="width:100%;max-height:46vh;object-fit:contain;border-radius:14px;background:var(--cream)">' +
    '<div class="action-row" style="margin-top:14px">' +
    '<button class="btn" onclick="shareAssetNow()">Share</button>' +
    '<button class="btn secondary" onclick="copyShareLink()">Copy link</button>' +
    '<button class="btn ghost" onclick="downloadShareAsset()">Download image</button>' +
    '</div>' +
    '<div class="muted" style="margin-top:10px">On Instagram: post the image to your story, then add a link sticker with your copied link.</div>';
}

function setShareMode(m) {
  shareState.mode = m;
  const body = document.getElementById('shareBody');
  if (body) body.innerHTML = shareBodyHtml();
}

function _shareFileName() {
  const l = getList(shareState.listId);
  return slugify(l ? l.name : 'list') + '-' + shareState.mode + '.png';
}

function copyShareLink() {
  const done = () => toast('Link copied — add it as a link sticker.');
  if (navigator.clipboard) navigator.clipboard.writeText(shareState.url).then(done, done); else done();
  ListStore.recordEvent((getList(shareState.listId) || {}).slug, 'share', (me() || {}).handle, 'copy');
}

function downloadShareAsset() {
  const a = document.createElement('a');
  a.href = shareState.canvases[shareState.mode].toDataURL('image/png');
  a.download = _shareFileName();
  a.click();
  toast('Image saved. Post it, then add your link sticker.');
}

function shareAssetNow() {
  const l = getList(shareState.listId);
  shareState.canvases[shareState.mode].toBlob(async blob => {
    const file = new File([blob], _shareFileName(), { type: 'image/png' });
    ListStore.recordEvent(l.slug, 'share', (me() || {}).handle, 'sheet');
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: l.name, text: 'Rate my fair food list "' + l.name + '" in pups:', url: shareState.url });
        copyShareLink();
        return;
      } catch (e) { /* user cancelled or unsupported combo — fall through */ }
    }
    downloadShareAsset();
    copyShareLink();
  }, 'image/png');
}

/* ---------------- public shared-list view (no login required) ---------------- */
async function viewSharedList(el, slug) {
  el.innerHTML = '<div class="empty"><span class="big">🍴</span>Finding that list…</div>';
  const params = new URLSearchParams(location.search);
  ListStore.recordEvent(slug, 'visit', params.get('ref'), params.get('ch'));
  const row = await ListStore.fetchBySlug(slug);
  if (!row) {
    el.innerHTML = '<div class="empty"><span class="big">🫙</span>That list isn\'t here anymore.<br><a href="#/home" style="text-decoration:underline">Head to Foodie Finder</a></div>';
    return;
  }
  const foods = (row.food_ids || []).map(getFood).filter(Boolean);
  const signedIn = !!S.currentUserId;
  el.innerHTML =
    '<div class="muted" style="margin:2px 0 4px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:700">Shared list</div>' +
    '<h1 class="greet" style="margin:0 0 4px">' + esc(row.title) + '</h1>' +
    '<div class="muted" style="margin-bottom:14px">by <b>' + esc(row.creator_name) + '</b> · @' + esc(row.creator_handle) + ' · ' + foods.length + ' foods</div>' +
    '<div class="action-row" style="margin:0 0 16px">' +
    (signedIn
      ? '<button class="btn" onclick="saveSharedList(\'' + esc(slug) + '\')">Save this list</button>' +
        (row.localListId ? '<button class="btn ghost" onclick="location.hash=\'#/list/' + row.localListId + '\'">Open in app</button>' : '')
      : '<button class="btn" onclick="ctaGetApp(\'' + esc(slug) + '\')">Get the app to save this list</button>') +
    '</div>' +
    foods.map(f => {
      const v = getVendor(f.vendorId);
      return '<div class="card food-card">' +
        '<a href="#/food/' + f.id + '" aria-hidden="true" tabindex="-1">' + photoHtml(f, 'thumb') + '</a>' +
        '<span class="grow"><h3><a href="#/food/' + f.id + '">' + esc(f.name) + '</a></h3>' +
        '<div class="muted">' + esc(v ? v.name : '') + (v && v.loc ? ' · ' + esc(v.loc.slice(0, 44)) : '') + '</div>' +
        ratingCompact(f.id) + '</span></div>';
    }).join('') +
    '<div class="muted" style="text-align:center;margin:18px 0">Every rating is in prontopups on MN Fair Foodie Finder.</div>';
}

function ctaGetApp(slug) {
  const params = new URLSearchParams(location.search);
  try { sessionStorage.setItem('ff_pending', JSON.stringify({ slug, ref: params.get('ref') || '' })); } catch (e) {}
  location.hash = '#/home'; // routes to onboarding when signed out
  render();
}

async function saveSharedList(slug) {
  const row = await ListStore.fetchBySlug(slug);
  if (!row) { toast('That list isn\'t available right now.'); return; }
  const u = me();
  const copy = {
    id: uid('l'), name: row.title, ownerId: u.id,
    foodIds: (row.food_ids || []).filter(id => getFood(id)),
    privacy: 'private', featured: false, likes: [], ratings: {}, views: 0, comments: [],
    collaborators: [], ts: Date.now(), via: '@' + row.creator_handle,
  };
  S.lists.push(copy);
  save();
  ListStore.recordEvent(slug, 'save', row.creator_handle, 'app');
  location.hash = '#/list/' + copy.id;
  toast('Saved — via @' + row.creator_handle);
}

/* after signup, land the new user on the list that brought them */
function resumePendingShare() {
  let p = null;
  try { p = JSON.parse(sessionStorage.getItem('ff_pending') || 'null'); } catch (e) {}
  if (!p || !p.slug) return false;
  try { sessionStorage.removeItem('ff_pending'); } catch (e) {}
  location.hash = '#/l/' + p.slug;
  toast(p.ref ? 'Welcome! Here\'s @' + p.ref + '\'s list.' : 'Welcome! Here\'s the list that brought you.');
  return true;
}
