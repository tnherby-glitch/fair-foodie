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
    const { data, error } = await sbClient.from('profiles').select('id,handle,name,avatar,bio').eq('id', id).maybeSingle();
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
      real: true,
    };
    S.users.push(u);
    ['u_inf2', 'u_inf1'].forEach(id => { const inf = getUser(id); if (inf && !inf.followers.includes(u.id)) inf.followers.push(u.id); });
  } else {
    u.name = profile.name || u.name;
    u.handle = profile.handle || u.handle;
    u.avatar = profile.avatar || u.avatar;
    if (profile.bio) u.bio = profile.bio;
    u.real = true;
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
