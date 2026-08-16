/* Sharing backend client (Supabase REST) with graceful local fallback.
   All calls are safe to make when unconfigured — they resolve to null/no-op,
   and seeded lists still resolve client-side by slug. */
/* global BACKEND, S, getFood, getUser */

const ListStore = {
  configured() { return !!(BACKEND && BACKEND.url && BACKEND.anonKey); },

  _headers(extra) {
    return Object.assign({
      'apikey': BACKEND.anonKey,
      'Authorization': 'Bearer ' + BACKEND.anonKey,
      'Content-Type': 'application/json',
    }, extra || {});
  },

  /* Publish (upsert) a list so any device can resolve its slug. */
  async publish(list, owner) {
    if (!this.configured()) return null;
    try {
      const body = [{
        slug: list.slug,
        title: list.name,
        creator_handle: owner ? owner.handle : 'fairgoer',
        creator_name: owner ? owner.name : 'A fair foodie',
        food_ids: list.foodIds,
        updated_at: new Date().toISOString(),
      }];
      const r = await fetch(BACKEND.url + '/rest/v1/shared_lists?on_conflict=slug', {
        method: 'POST',
        headers: this._headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify(body),
      });
      if (r.ok) this.recordEvent(list.slug, 'publish');
      return r.ok;
    } catch (e) { console.warn('publish failed', e); return null; }
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
      const r = await fetch(BACKEND.url + '/rest/v1/shared_lists?slug=eq.' + encodeURIComponent(slug) + '&select=*', {
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
