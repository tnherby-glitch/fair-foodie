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
  const tabFor = { home: 'explore', search: 'explore', food: 'explore', map: 'map', lists: 'lists', list: 'lists', feed: 'profile', user: 'profile', notifications: 'profile', profile: 'profile', admin: 'profile' };
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === (tabFor[page] || '')));

  switch (page) {
    case 'home':          viewHome(el); break;
    case 'search':        viewSearch(el, params); break;
    case 'food':          viewFood(el, arg); break;
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
function bootApp() {
  loadState();
  if (!location.hash) location.hash = '#/home';
  render();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootApp);
else bootApp();
