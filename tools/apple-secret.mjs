// Mints the Sign in with Apple client secret (ES256 JWT) that Supabase's Apple
// provider requires. Apple caps validity at 6 months — rerun this script and
// re-paste into Supabase before it expires.
// Usage: node tools/apple-secret.mjs <path-to-AuthKey.p8> <keyId> <teamId> <servicesId>
import { readFileSync, writeFileSync } from 'fs';
import { createPrivateKey, sign } from 'crypto';

const [, , p8Path, keyId, teamId, servicesId] = process.argv;
if (!p8Path || !keyId || !teamId || !servicesId) {
  console.error('usage: node tools/apple-secret.mjs <AuthKey.p8> <keyId> <teamId> <servicesId>');
  process.exit(1);
}

const b64url = buf => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const now = Math.floor(Date.now() / 1000);
const exp = now + 15550000; // ~180 days (Apple max is 6 months)

const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
const payload = b64url(JSON.stringify({
  iss: teamId, iat: now, exp: exp,
  aud: 'https://appleid.apple.com', sub: servicesId,
}));
const input = header + '.' + payload;
const key = createPrivateKey(readFileSync(p8Path, 'utf8'));
const sig = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
const jwt = input + '.' + b64url(sig);

const out = p8Path.replace(/[^\\\/]+$/, 'apple-client-secret.txt');
writeFileSync(out, jwt);
console.log('secret written to:', out);
console.log('expires:', new Date(exp * 1000).toISOString().slice(0, 10));
