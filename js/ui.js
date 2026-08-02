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

/* Pronto Pup rating display — a battered corn dog on a stick, drawn as SVG */
function pupSvg() {
  return '<svg class="pup-ico" viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect class="pup-stick" x="11.1" y="13.5" width="1.8" height="9.5" rx=".9"/>' +
    '<rect class="pup-body" x="5.4" y="1.2" width="13.2" height="15.8" rx="6.6"/>' +
    '<path class="pup-glaze" d="M8 5.4c1.6 1.1 6.4 1.1 8 0M8 8.2c1.6 1.1 6.4 1.1 8 0M8 11c1.6 1.1 6.4 1.1 8 0" />' +
    '</svg>';
}
function pupOne(on) {
  return '<span class="pup ' + (on ? 'on' : 'off') + '">' + pupSvg() + '</span>';
}
function pups(n, opts) {
  opts = opts || {};
  let h = '<span class="pups' + (opts.big ? ' big' : '') + '" role="img" aria-label="' +
    (n ? n.toFixed(1) + ' out of 5 Pronto Pups' : 'Not yet rated') + '">';
  for (let i = 1; i <= 5; i++) h += pupOne(i <= Math.round(n));
  return h + '</span>';
}
function ratingLine(foodId) {
  const r = foodRating(foodId);
  if (!r.count) return '<span class="rating-line"><span class="muted">No ratings yet</span></span>';
  return '<span class="rating-line">' + pupOne(true) + ' <b>' + r.avg.toFixed(1) + '</b> <span class="muted">· ' + r.count + ' review' + (r.count > 1 ? 's' : '') + '</span></span>';
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

const CAT_GRADS = {
  'Deep Fried': ['#ece3d2', '#d8c6a6'],
  'On a Stick': ['#e9ded0', '#d0bda1'],
  'Sweet':      ['#ebe0dd', '#d6c1bd'],
  'Savory':     ['#e8e4da', '#cabfa8'],
  'Drinks':     ['#e0e6e7', '#bfccce'],
  'Dairy':      ['#eae6dc', '#cfc8b5'],
};
/* image precedence: uploaded hero -> official new-food photo -> latest guest
   photo -> vendor's official photo -> category placeholder */
function photoHtml(f, cls) {
  const v = getVendor(f.vendorId);
  const img = f.heroImg || f.photo || foodPhoto(f) || (v && v.photo) || null;
  const g = CAT_GRADS[f.cats[0]] || CAT_GRADS.Savory;
  let badges = '';
  if (f.isNew) badges += '<span class="pbadge">New 2026</span>';
  if (f.soldOut) badges += '<span class="pbadge dark">Sold out</span>';
  return '<div class="photo' + (cls ? ' ' + cls : '') + '"' +
    (img ? ' style="background-image:url(' + img + ')"'
         : ' style="background:linear-gradient(140deg,' + g[0] + ',' + g[1] + ')"') + '>' +
    (img ? '' : '<span class="ph-emoji" aria-hidden="true">' + f.emoji + '</span>') +
    badges + '</div>';
}

/* compact rating: one pup + score */
function ratingCompact(foodId) {
  const r = foodRating(foodId);
  return '<span class="rate" aria-label="' + (r.count ? r.avg.toFixed(1) + ' out of 5 Pronto Pups' : 'Not yet rated') + '">' +
    pupOne(!!r.count) + ' ' + (r.count ? r.avg.toFixed(1) : '—') + '</span>';
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
