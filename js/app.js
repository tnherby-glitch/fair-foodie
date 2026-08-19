/* Router + bootstrap */
/* global S, loadState, save, me, esc, updateBell, updateAvatarBtn, viewOnboarding, viewHome, viewSearch, viewFood, viewLists, viewListDetail, viewMap, viewFeed, viewNotifications, viewProfile, viewUser, viewAdmin */

function parseHash() {
  const raw = (location.hash || '#/home').slice(1); // e.g. /food/f1?x=1
  const qi = raw.indexOf('?');
  const path = (qi >= 0 ? raw.slice(0, qi) : raw).replace(/^\//, '');
  const params = new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : '');
  const parts = path.split('/');
  return { page: parts[0] || 'home', arg: parts[1] || '', params };
}

function render() {
  const el = document.getElementById('view');
  const { page, arg, params } = parseHash();

  updateBell();
  updateAvatarBtn();

  const tabbar = document.getElementById('tabbar');
  const topActions = document.querySelector('.topbar-actions');

  /* Shared lists are public: fully viewable with zero login (docs/SHARING.md) */
  if (page === 'l') {
    tabbar.style.display = S.currentUserId ? 'flex' : 'none';
    topActions.style.visibility = S.currentUserId ? 'visible' : 'hidden';
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'lists'));
    viewSharedList(el, arg);
    return;
  }
  if (!S.currentUserId) {
    tabbar.style.display = 'none';
    topActions.style.visibility = 'hidden';
    viewOnboarding(el);
    return;
  }
  if (me().banned) {
    tabbar.style.display = 'none';
    el.innerHTML = '<div class="empty"><span class="big">🚫</span><b>Account suspended</b><br>This account was banned for violating community guidelines.<br><br><button class="btn" onclick="signOut()">Sign out</button></div>';
    return;
  }
  tabbar.style.display = 'flex';
  topActions.style.visibility = 'visible';

  // active tab highlight (4-tab IA: Explore, Map, My Lists, Profile)
  const tabFor = { home: 'explore', search: 'explore', food: 'explore', vendor: 'explore', vendors: 'explore', new: 'explore', map: 'map', lists: 'lists', list: 'lists', feed: 'profile', user: 'profile', notifications: 'profile', profile: 'profile', admin: 'profile' };
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === (tabFor[page] || '')));

  switch (page) {
    case 'home':          viewHome(el); break;
    case 'search':        viewSearch(el, params); break;
    case 'vendors':       viewVendors(el); break;
    case 'new':           viewNew(el); break;
    case 'food':          viewFood(el, arg); break;
    case 'vendor':        viewVendorPage(el, arg); break;
    case 'map':           viewMap(el, params); break;
    case 'lists':         viewLists(el); break;
    case 'list':          viewListDetail(el, arg); break;
    case 'feed':          viewFeed(el); break;
    case 'notifications': viewNotifications(el); break;
    case 'profile':       viewProfile(el); break;
    case 'user':          viewUser(el, arg); break;
    case 'admin':         viewAdmin(el); break;
    default:              viewHome(el);
  }
  el.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
async function bootApp() {
  loadState();
  if (typeof reconcileBadges === 'function') reconcileBadges();
  /* capture share attribution (?ref=&ch=) for the deferred-deep-link moment */
  try {
    const q = new URLSearchParams(location.search);
    if (q.get('ref')) sessionStorage.setItem('ff_ref', JSON.stringify({ ref: q.get('ref'), ch: q.get('ch') || '' }));
  } catch (e) {}
  if (!location.hash) location.hash = '#/home';
  render();
  if (typeof maybePromptA2HS === 'function') maybePromptA2HS();
  /* pull live community pup scores (public read) so rankings reflect real reviews */
  if (typeof ListStore !== 'undefined' && ListStore.configured()) {
    ListStore.foodScores().then(map => { if (map) { S.remoteScores = map; dataRev++; render(); } })
      .catch(() => {});
  }
  /* restore a real Supabase session if present (async); re-renders when ready */
  if (typeof authInit === 'function') {
    try { await authInit(); render(); } catch (e) { console.warn('auth init', e); }
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootApp);
else bootApp();
