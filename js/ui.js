/* UI helpers */
/* global S, save, me, getUser, getFood, getVendor, foodRating */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function timeAgo(ts) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

function toast(msg, type) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.setAttribute('role', 'status');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

/* simulated push notification (PRD: push notifications for interactions) */
function pushToast(msg) { toast('🔔 ' + msg, 'push'); }

function openModal(html, onOpen) {
  const root = document.getElementById('modalRoot');
  root.innerHTML =
    '<div class="modal-backdrop" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal" role="dialog" aria-modal="true">' +
    '<button class="modal-close" aria-label="Close dialog" onclick="closeModal()">✕</button>' +
    html + '</div></div>';
  document.body.style.overflow = 'hidden';
  const first = root.querySelector('input, textarea, select, button:not(.modal-close)');
  if (first) first.focus();
  if (onOpen) onOpen(root);
}
function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* Prontopup rating — the brand's simplified pup glyph: capsule + stick, no drizzle */
function pupSvg() {
  return '<svg class="pup-ico" viewBox="0 0 240 320" aria-hidden="true">' +
    '<path class="pup-stick" d="M108 200 L118 294 Q120 303 122 294 L132 200 Z"/>' +
    '<rect class="pup-body" x="72" y="26" width="96" height="184" rx="48"/>' +
    '</svg>';
}
function pupOne(on) {
  return '<span class="pup ' + (on ? 'on' : 'off') + '">' + pupSvg() + '</span>';
}
function pups(n, opts) {
  opts = opts || {};
  let h = '<span class="pups' + (opts.big ? ' big' : '') + '" role="img" aria-label="' +
    (n ? n.toFixed(1) + ' out of 5 pups' : 'Not yet rated') + '">';
  for (let i = 1; i <= 5; i++) h += pupOne(i <= Math.round(n));
  return h + '</span>';
}
function fmtCount(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n);
}
function ratingLine(foodId) {
  const r = foodRating(foodId);
  if (!r.count) return '<span class="rating-line"><span class="muted">Not rated yet — be the first</span></span>';
  return '<span class="rating-line">' + pups(r.avg) + ' <b>' + r.avg.toFixed(1) + '</b> <span class="muted">(' + fmtCount(r.count) + ')</span></span>';
}

function avatarHtml(user, cls) {
  if (!user) return '<span class="' + (cls || 'av') + '">🙂</span>';
  const inner = user.avatar && user.avatar.startsWith('data:')
    ? '<img src="' + user.avatar + '" alt="">'
    : esc(user.avatar || '🙂');
  return '<span class="' + (cls || 'av') + '" aria-hidden="true">' + inner + '</span>';
}
function userName(user) {
  if (!user) return 'Unknown';
  return esc(user.name) + (user.verified ? ' <span class="vbadge" title="Verified" aria-label="Verified">✔</span>' : '');
}

function foodPills(f) {
  let h = '';
  f.cats.forEach(c => { h += '<span class="pill">' + esc(c) + '</span>'; });
  f.dietary.forEach(d => { h += '<span class="pill diet">' + esc(d) + '</span>'; });
  return h;
}

/* latest user-uploaded review photo for a food, if any */
function foodPhoto(f) {
  const r = S.reviews
    .filter(x => x.foodId === f.id && !x.removed && x.photos.length)
    .sort((a, b) => b.ts - a.ts)[0];
  return r ? r.photos[0] : null;
}

/* brand-board placeholder gradients: gold, ketchup, ribbon-soft — no pink/coral */
const CAT_GRADS = {
  'Deep Fried': ['#F6C778', '#E89C31'],
  'On a Stick': ['#F1DAB2', '#DFAE59'],
  'Sweet':      ['#F3A08F', '#D64533'],
  'Savory':     ['#EFE7D8', '#D9C8A8'],
  'Drinks':     ['#9DB6E8', '#2B4C9B'],
  'Dairy':      ['#FFF3DE', '#EED9AE'],
};
/* image precedence: uploaded hero -> official new-food photo -> latest guest
   photo -> vendor's official photo -> category placeholder */
function photoHtml(f, cls) {
  const v = getVendor(f.vendorId);
  const img = f.heroImg || f.photo || foodPhoto(f) || (v && v.photo) || null;
  const g = CAT_GRADS[f.cats[0]] || CAT_GRADS.Savory;
  let badges = '';
  if (typeof blueRibbon === 'function' && blueRibbon(f.id)) badges += '<span class="pbadge ribbon">BLUE RIBBON</span>';
  else if (f.isNew) badges += '<span class="pbadge">New for 2026</span>';
  if (f.soldOut) badges += '<span class="pbadge dark">Sold out</span>';
  return '<div class="photo' + (cls ? ' ' + cls : '') + '"' +
    (img ? ' style="background-image:url(' + img + ')"'
         : ' style="background:linear-gradient(140deg,' + g[0] + ',' + g[1] + ')"') + '>' +
    (img ? '' : '<span class="ph-emoji" aria-hidden="true">' + f.emoji + '</span>') +
    badges + '</div>';
}

/* compact rating: one pup + score + count, e.g. "4.7 (1.8k)" */
function ratingCompact(foodId) {
  const r = foodRating(foodId);
  if (!r.count) return '<span class="rate" aria-label="Not yet rated">' + pupOne(false) + ' <span class="count">—</span></span>';
  return '<span class="rate" aria-label="' + r.avg.toFixed(1) + ' out of 5 pups, ' + r.count + ' ratings">' +
    pupOne(true) + ' ' + r.avg.toFixed(1) + ' <span class="count">(' + fmtCount(r.count) + ')</span></span>';
}

function foodCardHtml(f) {
  const v = getVendor(f.vendorId);
  return '<a class="pcard" href="#/food/' + f.id + '" aria-label="' + esc(f.name) + '">' +
    photoHtml(f) +
    '<div class="pcard-body">' +
    '<div class="pcard-top"><span class="pcard-title">' + esc(f.name) + '</span>' + ratingCompact(f.id) + '</div>' +
    '<div class="sub">' + esc(v ? v.name : '') + '</div>' +
    '<div class="sub">' + (f.price ? '$' + f.price.toFixed(2).replace(/\.00$/, '') + ' · ' : '') + esc(f.cats[0]) + (f.isNew && !f.official ? ' · New' : '') + '</div>' +
    '</div></a>';
}

function foodMiniCardHtml(f) {
  return foodCardHtml(f);
}

function updateBell() {
  const badge = document.getElementById('bellBadge');
  if (!S.currentUserId) { badge.hidden = true; return; }
  const unread = S.notifications.filter(n => n.userId === S.currentUserId && !n.read).length;
  badge.hidden = unread === 0;
  badge.textContent = unread;
}
function updateAvatarBtn() {
  const btn = document.getElementById('avatarBtn');
  const u = me();
  if (!u) { btn.textContent = '🙂'; return; }
  btn.innerHTML = u.avatar && u.avatar.startsWith('data:') ? '<img src="' + u.avatar + '" alt="">' : esc(u.avatar);
}

/* read file input -> dataURL with size limit (PRD: 5MB, JPEG/PNG) */
function readImage(file, maxMB, cb) {
  if (!file) return;
  if (!/^image\/(png|jpe?g)$/i.test(file.type)) { toast('Only JPEG or PNG images allowed'); return; }
  if (file.size > maxMB * 1024 * 1024) { toast('Image too large (max ' + maxMB + 'MB)'); return; }
  const r = new FileReader();
  r.onload = () => cb(r.result);
  r.readAsDataURL(file);
}
