/* Backend configuration.
   Fill in your Supabase project's URL and anon (public) key to enable
   cross-device shared lists and share stats. The anon key is designed to be
   shipped client-side; row-level security governs what it can do.
   Until configured, the app runs fully client-side (seeded lists still share). */
/* The publishable key is designed to ship client-side; row-level security
   (docs/backend/schema.sql) governs what it can do. Never put a secret key here. */
const BACKEND = {
  url: 'https://muhbnazpmyvcvblzmfqo.supabase.co',
  anonKey: 'sb_publishable_5BIy5E6EkUzzD09nQ75jqg_nTBtWMdC',
  /* OAuth sign-in providers to show on the sign-in screen. Only list a provider
     AFTER you've configured it in Supabase → Authentication → Providers.
     Options: 'google', 'apple'. Email magic-link is always available. */
  oauthProviders: ['google'],
};

/* Demo mode surfaces the one-tap personas, the profile persona switcher, and
   the seeded analytics numbers. It's OFF for production so real visitors only
   see real sign-in. For a pitch or walkthrough, append ?demo=1 to any URL
   (?demo=0 forces it off); the choice is remembered on that device. */
const APP = { demo: false };
function demoMode() {
  try {
    const q = new URLSearchParams(location.search);
    if (q.has('demo')) {
      const on = q.get('demo') !== '0';
      localStorage.setItem('ff_demo', on ? '1' : '0');
      return on;
    }
    const saved = localStorage.getItem('ff_demo');
    if (saved !== null) return saved === '1';
  } catch (e) {}
  return !!APP.demo;
}
