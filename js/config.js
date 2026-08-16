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
  oauthProviders: [],
};
