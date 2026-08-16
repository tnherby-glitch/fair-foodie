/* Sharing backend client (Supabase REST) with graceful local fallback.
   All calls are safe to make when unconfigured — they resolve to null/no-op,
   and seeded lists still resolve client-side by slug. */
/* global BACKEND, S, getFood, getUser */

const ListStore = {
  configured() { return !!(BACKEND && BACKEND.url && BACKEND.anonKey); },

  _headers(extra) {
    const h = { 'apikey': BACKEND.anonKey, 'Content-Type': 'application/json' };
    // legacy JWT anon keys also go in Authorization; new sb_publishable_* keys must not
    if (/^eyJ/.test(BACKEND.anonKey)) h['Authorization'] = 'Bearer ' + BACKEND.anonKey;
    return Object.assign(h, extra || {});
  },

  /* Publish a list so any device can resolve its slug.
     Writes go through the publish_list RPC: the first publisher's owner token
     claims the slug; only that token can update it. Falls back to the legacy
     open upsert if the v2 migration hasn't been applied yet. */
  async publish(list, owner) {
    if (!this.configured()) return null;
    if (!list.ownerToken) { list.ownerToken = _uuid4(); save(); }
    const attempt = async () => {
      const r = await fetch(BACKEND.url + '/rest/v1/rpc/publish_list', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({
          p_slug: list.slug,
          p_title: list.name,
          p_handle: owner ? owner.handle : 'fairgoer',
          p_name: owner ? owner.name : 'A fair foodie',
          p_food_ids: list.foodIds,
          p_token: list.ownerToken,
        }),
      });
      return r;
    };
    try {
      let r = await attempt();
      if (r.status === 404) return this._legacyPublish(list, owner); // migration not applied yet
      let result = r.ok ? await r.json() : null;
      if (result === 'slug_taken') {
        // someone else owns that slug — take a fresh one and retry once
        list.aliases = list.aliases || [];
        list.slug = slugify(list.name) + '-' + _uuid4().slice(0, 6);
        save();
        r = await attempt();
        result = r.ok ? await r.json() : null;
      }
      const ok = result === 'created' || result === 'updated';
      if (ok) this.recordEvent(list.slug, 'publish');
      else if (result) console.warn('publish rejected:', result);
      return ok;
    } catch (e) { console.warn('publish failed', e); return null; }
  },

  async _legacyPublish(list, owner) {
    try {
      const body = [{
        slug: list.slug, title: list.name,
        creator_handle: owner ? owner.handle : 'fairgoer',
        creator_name: owner ? owner.name : 'A fair foodie',
        food_ids: list.foodIds, updated_at: new Date().toISOString(),
      }];
      const r = await fetch(BACKEND.url + '/rest/v1/shared_lists?on_conflict=slug', {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(body),
      });
      if (r.ok) this.recordEvent(list.slug, 'publish');
      return r.ok;
    } catch (e) { return null; }
  },

  /* Resolve a slug: local list first (seeded or own), then the backend. */
  async fetchBySlug(slug) {
    const local = S.lists.find(l => l.slug === slug || (l.aliases || []).includes(slug));
    if (local) {
      const owner = getUser(local.ownerId);
      return {
        slug, title: local.name,
        creator_handle: owner ? owner.handle : 'fairgoer',
        creator_name: owner ? owner.name : 'A fair foodie',
        food_ids: local.foodIds, localListId: local.id,
      };
    }
    if (!this.configured()) return null;
    try {
      // explicit columns — the owner_token column is not granted to the public key
      const cols = 'slug,title,creator_handle,creator_name,food_ids';
      const r = await fetch(BACKEND.url + '/rest/v1/shared_lists?slug=eq.' + encodeURIComponent(slug) + '&select=' + cols, {
        headers: this._headers(),
      });
      if (!r.ok) return null;
      const rows = await r.json();
      return rows.length ? rows[0] : null;
    } catch (e) { console.warn('fetch failed', e); return null; }
  },

  /* Fire-and-forget attribution/event recording. */
  recordEvent(slug, event, ref, channel) {
    if (!this.configured()) return;
    try {
      fetch(BACKEND.url + '/rest/v1/share_events', {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'return=minimal' }),
        body: JSON.stringify([{ slug, event, ref: ref || null, channel: channel || null }]),
      }).catch(() => {});
    } catch (e) { /* never block UX on stats */ }
  },

  /* Creator-facing stats for a shared list. */
  async stats(slug) {
    if (!this.configured()) return null;
    try {
      const r = await fetch(BACKEND.url + '/rest/v1/share_stats?slug=eq.' + encodeURIComponent(slug), {
        headers: this._headers(),
      });
      if (!r.ok) return null;
      const rows = await r.json();
      return rows.length ? rows[0] : { views: 0, saves: 0, shares: 0 };
    } catch (e) { return null; }
  },
};

/* uuid v4 (owner tokens) with a fallback for older WebViews */
function _uuid4() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* slug helpers */
function slugify(t) {
  return String(t || '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'list';
}
function ensureSlug(list) {
  if (!list.slug) {
    list.slug = slugify(list.name) + '-' + list.id.replace(/^l_?/, '').slice(0, 6);
    save();
  }
  return list.slug;
}
function listShareUrl(list, ref, channel) {
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  let u = base + 'l/' + ensureSlug(list);
  const q = [];
  if (ref) q.push('ref=' + encodeURIComponent(ref));
  if (channel) q.push('ch=' + encodeURIComponent(channel));
  return q.length ? u + '?' + q.join('&') : u;
}
