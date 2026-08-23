/* Real accounts via Supabase Auth (email magic link).
   The rest of the app keeps its local user model; a signed-in real user is
   mirrored into S.users with id = the Supabase auth uid. Demo personas
   (obDemo) still work when you just want to explore without an account. */
/* global BACKEND, S, save, render, getUser, toast, uid */

let sbClient = null;

function authConfigured() {
  return !!(BACKEND && BACKEND.url && BACKEND.anonKey && window.supabase);
}
function appBaseUrl() {
  return location.origin + location.pathname.replace(/index\.html$/, '');
}

function authInit() {
  if (!authConfigured()) return Promise.resolve(null);
  if (!sbClient) {
    sbClient = window.supabase.createClient(BACKEND.url, BACKEND.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    });
    sbClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        applySession(session).then(() => { if (event === 'SIGNED_IN') render(); });
      } else if (event === 'SIGNED_OUT') {
        S.currentUserId = null; save(); render();
      }
    });
  }
  return sbClient.auth.getSession().then(({ data }) => applySession(data && data.session));
}

async function fetchProfile(id) {
  try {
    const { data, error } = await sbClient.from('profiles').select('id,handle,name,avatar,bio,is_admin').eq('id', id).maybeSingle();
    return error ? null : data;
  } catch (e) { return null; }
}
async function upsertProfile(id, p) {
  const row = { id };
  ['name', 'handle', 'avatar', 'bio'].forEach(k => { if (p[k]) row[k] = p[k]; });
  try {
    let { data, error } = await sbClient.from('profiles').upsert(row).select('id,handle,name,avatar,bio').maybeSingle();
    if (error && row.handle) { // handle collision — take a suffixed one
      row.handle = row.handle.slice(0, 12) + Math.random().toString(36).slice(2, 5);
      ({ data, error } = await sbClient.from('profiles').upsert(row).select('id,handle,name,avatar,bio').maybeSingle());
    }
    return error ? null : data;
  } catch (e) { return null; }
}

function _readPending() {
  try { return JSON.parse(localStorage.getItem('ff_signup') || 'null'); } catch (e) { return null; }
}
function _clearPending() { try { localStorage.removeItem('ff_signup'); } catch (e) {} }

/* Turn a Supabase session into the app's current user. */
async function applySession(session) {
  if (!session || !session.user) return null;
  const authUid = session.user.id;
  let profile = await fetchProfile(authUid);
  const pending = _readPending();
  if (pending && (!profile || !profile.handle)) {
    const merged = await upsertProfile(authUid, pending);
    if (merged) profile = merged;
    _clearPending();
  }
  if (!profile) {
    const local = (session.user.email || 'fairgoer').split('@')[0];
    profile = { id: authUid, name: local, handle: local.replace(/[^a-z0-9]/gi, '').toLowerCase(), avatar: '🙂', bio: 'Here for the food.' };
  }
  mergeAuthUser(profile, session.user.email);
  S.currentUserId = authUid;
  save();
  loadUserLists(); // pull this account's lists from the server (async, re-renders)
  return profile;
}

/* Mirror a real account into the local user model the rest of the app reads. */
function mergeAuthUser(profile, email) {
  let u = S.users.find(x => x.id === profile.id);
  if (!u) {
    u = {
      id: profile.id, name: profile.name || 'Fairgoer', handle: profile.handle || 'fairgoer',
      avatar: profile.avatar || '🙂', role: 'attendee', verified: false,
      bio: profile.bio || 'Here for the food.', email: email || '',
      followers: [], following: ['u_inf2', 'u_inf1'], badges: [], banned: false, warned: 0, qualityReviews: 0,
      real: true, isAdmin: !!profile.is_admin, role: profile.is_admin ? 'admin' : 'attendee',
    };
    S.users.push(u);
    ['u_inf2', 'u_inf1'].forEach(id => { const inf = getUser(id); if (inf && !inf.followers.includes(u.id)) inf.followers.push(u.id); });
  } else {
    u.name = profile.name || u.name;
    u.handle = profile.handle || u.handle;
    u.avatar = profile.avatar || u.avatar;
    if (profile.bio) u.bio = profile.bio;
    u.real = true;
    u.isAdmin = !!profile.is_admin;
    if (profile.is_admin) u.role = 'admin';
  }
  return u;
}

/* Send a magic link. profileData (name/handle/avatar) is captured now and
   applied when the link is opened in this browser. */
async function sendMagicLink(email, profileData) {
  if (!authConfigured()) return { ok: false, error: 'Accounts are not configured yet.' };
  try {
    if (profileData) localStorage.setItem('ff_signup', JSON.stringify(profileData));
  } catch (e) {}
  try {
    const { error } = await sbClient.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: appBaseUrl(), data: profileData || {} },
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

/* Real OAuth sign-in (Google / Apple). Requires the provider to be configured
   in Supabase → Authentication → Providers, and listed in BACKEND.oauthProviders. */
function oauthProviders() {
  return (authConfigured() && Array.isArray(BACKEND.oauthProviders)) ? BACKEND.oauthProviders : [];
}
async function signInWithProvider(provider) {
  if (!authConfigured()) { toast('Accounts are not configured yet.'); return; }
  try {
    // capture avatar/name intent so the profile can be refined after redirect
    try {
      const name = (document.getElementById('obName') || {}).value;
      localStorage.setItem('ff_signup', JSON.stringify({ name: (name || '').trim() || undefined, avatar: (typeof obPhoto !== 'undefined' && obPhoto) || (typeof obAvatar !== 'undefined' ? obAvatar : undefined) }));
    } catch (e) {}
    const { error } = await sbClient.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: appBaseUrl() },
    });
    if (error) toast(provider[0].toUpperCase() + provider.slice(1) + ' sign-in isn’t available yet.');
    // on success the browser redirects to the provider, then back to the app
  } catch (e) { toast('Could not start sign-in.'); }
}

/* Running inside the iOS (Capacitor) shell? Native gets the Apple sheet;
   Google/magic-link stay web-only (they misbehave in embedded webviews). */
function isNativeApp() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

/* Native Sign in with Apple: Face ID sheet via the SignInWithApple plugin,
   then exchange Apple's identity token for a Supabase session.
   Nonce dance: Apple must receive the SHA-256 of a random nonce; Supabase
   must receive the raw nonce to verify the token is ours and fresh. */
async function signInWithAppleNative() {
  if (!authConfigured() || !isNativeApp()) { toast('Apple sign-in is not available here.'); return; }
  const plugin = window.Capacitor.Plugins && window.Capacitor.Plugins.SignInWithApple;
  if (!plugin) { toast('Apple sign-in isn’t available in this build yet.'); return; }
  try {
    // capture profile intent from the form (same as the web OAuth path)
    try {
      const name = (document.getElementById('obName') || {}).value;
      localStorage.setItem('ff_signup', JSON.stringify({ name: (name || '').trim() || undefined, avatar: (typeof obPhoto !== 'undefined' && obPhoto) || (typeof obAvatar !== 'undefined' ? obAvatar : undefined) }));
    } catch (e) {}
    const raw = _randomNonce();
    const hashed = await _sha256Hex(raw);
    const result = await plugin.authorize({
      clientId: 'com.mnfoodiefairguide.app',
      redirectURI: appBaseUrl(),
      scopes: 'email name',
      nonce: hashed,
    });
    const idToken = result && result.response && result.response.identityToken;
    if (!idToken) { toast('Apple sign-in was cancelled.'); return; }
    // Apple only shares the name on the FIRST authorization — keep it if present
    try {
      const given = result.response.givenName;
      if (given) {
        const pending = JSON.parse(localStorage.getItem('ff_signup') || '{}');
        if (!pending.name) { pending.name = (given + ' ' + (result.response.familyName || '')).trim(); localStorage.setItem('ff_signup', JSON.stringify(pending)); }
      }
    } catch (e) {}
    const { error } = await sbClient.auth.signInWithIdToken({ provider: 'apple', token: idToken, nonce: raw });
    if (error) { console.warn('apple native', error.message); toast('Apple sign-in failed: ' + error.message); }
    // success: onAuthStateChange fires SIGNED_IN → applySession → render
  } catch (e) {
    if (!/cancel/i.test(String(e))) toast('Apple sign-in didn’t complete.');
  }
}
function _randomNonce() {
  const a = new Uint8Array(24);
  (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => { a[i] = Math.floor(Math.random() * 256); });
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}
async function _sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('');
}

function authIsReal() {
  const u = getUser(S.currentUserId);
  return !!(u && u.real);
}
async function authSignOut() {
  if (sbClient) { try { await sbClient.auth.signOut(); } catch (e) {} }
  S.currentUserId = null; save();
}
/* push profile edits to the server for a real account */
function syncProfile() {
  if (!authIsReal() || !sbClient) return;
  const u = getUser(S.currentUserId);
  upsertProfile(u.id, { name: u.name, handle: u.handle, avatar: u.avatar, bio: u.bio });
}

/* ---------- personal list sync (Phase 2) ----------
   A real user's own lists persist to user_lists so they follow the account.
   Uses the authenticated supabase client, so RLS sees auth.uid(). */
let _listSyncTimer = null;
function onSaveSync() {
  if (!authIsReal() || !sbClient) return;
  clearTimeout(_listSyncTimer);
  _listSyncTimer = setTimeout(flushListSync, 800);
}
async function flushListSync() {
  if (!authIsReal() || !sbClient) return;
  const owner = S.currentUserId;
  const rows = S.lists.filter(l => l.ownerId === owner).map(l => ({
    id: l.id, owner: owner, name: l.name, food_ids: l.foodIds || [],
    privacy: l.privacy || 'private', slug: l.slug || null, ratings: l.ratings || {},
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  try { await sbClient.from('user_lists').upsert(rows); } catch (e) { console.warn('list sync', e); }
}
async function loadUserLists() {
  if (!authIsReal() || !sbClient) return;
  try {
    const { data, error } = await sbClient.from('user_lists').select('*').eq('owner', S.currentUserId);
    if (error || !data) return;
    data.forEach(r => {
      const existing = S.lists.find(l => l.id === r.id);
      const fields = {
        id: r.id, name: r.name, ownerId: S.currentUserId, foodIds: r.food_ids || [],
        privacy: r.privacy, slug: r.slug || undefined, ratings: r.ratings || {},
        featured: false, likes: [], views: 0, comments: [], collaborators: [],
        ts: new Date(r.created_at).getTime(),
      };
      if (existing) Object.assign(existing, fields); else S.lists.push(fields);
    });
    save();
    if (typeof render === 'function') render();
  } catch (e) { console.warn('load lists', e); }
}
async function deleteUserList(id) {
  if (!authIsReal() || !sbClient) return;
  try { await sbClient.from('user_lists').delete().eq('id', id); } catch (e) {}
}

/* ---------- reviews (Phase 3) ----------
   Post a review to the shared backend for a real account (author = auth.uid()).
   Demo personas keep reviewing locally only. */
async function postReview(r) {
  if (!authIsReal() || !sbClient) return false;
  const u = getUser(S.currentUserId);
  try {
    const { error } = await sbClient.from('reviews').insert({
      id: r.id, food_id: r.foodId, author: u.id,
      author_name: u.name, author_handle: u.handle, author_avatar: u.avatar,
      score: r.rating, body: r.text || '', photos: r.photos || [],
    });
    if (error) { console.warn('review post', error.message); return false; }
    return true;
  } catch (e) { console.warn('review post', e); return false; }
}

/* Admin moderation: hide/unhide any review (server enforces is_admin). */
async function hideReview(id, hide) {
  if (!sbClient) return false;
  try {
    const { error } = await sbClient.rpc('set_review_hidden', { p_id: id, p_hidden: !!hide });
    return !error;
  } catch (e) { return false; }
}

/* Pull recent community reviews for one food into S.reviews (dedup by id) so
   the detail page shows what everyone said, not just this device. */
async function loadReviewsForFood(foodId) {
  const rows = await ListStore.reviewsForFood(foodId, 50);
  if (!rows || !rows.length) return false;
  let added = 0;
  rows.forEach(row => {
    if (S.reviews.some(x => x.id === row.id)) return;
    S.reviews.push({
      id: row.id, foodId: row.food_id, userId: row.author || ('remote_' + row.author_handle),
      rating: row.score, text: row.body || '', photos: row.photos || [],
      likes: [], comments: [], reported: false, removed: false,
      ts: new Date(row.created_at).getTime(), vendorResponse: null,
      remote: true, authorName: row.author_name, authorHandle: row.author_handle, authorAvatar: row.author_avatar,
    });
    added++;
  });
  if (added) { dataRev++; }
  return added > 0;
}
