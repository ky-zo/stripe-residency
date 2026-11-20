const cookieName = '__Host-palm_hours';

export function hasInvitation(request, key) {
  return Boolean(key) && (request.headers.get('Cookie') || '').split(/;\s*/).includes(cookieName + '=' + key);
}

export function invitationCookie(key) {
  return cookieName + '=' + key + '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=31536000';
}

export function invitationPage() {
  const html = '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Palm Hours</title><body style="margin:12vh 10vw;background:#faf8f1;color:#293e2e;font:18px/1.5 system-ui"><h1 style="font:64px Georgia;margin-bottom:12px">Palm Hours</h1><p>Open the residency invitation link to enter the island.</p></body></html>';
  return new Response(html, {status:403, headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
}

const encoder = new TextEncoder();
const lifetime = 60000;
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign','verify']);
}
function signedData(origin, expiry) {
  return encoder.encode('palm-hours/live\n' + origin + '\n' + expiry);
}

export async function issueRoomPass(origin, secret, now=Date.now()) {
  const expiry = now + lifetime;
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), signedData(origin, expiry));
  const hex = [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2,'0')).join('');
  return expiry + '.' + hex;
}

export async function acceptsRoomPass(value, origin, secret, now=Date.now()) {
  if (!origin || !secret || !value || !/^\d{13}\.[a-f0-9]{64}$/.test(value)) return false;
  const [expiry, signature] = value.split('.');
  if (Number(expiry) < now || Number(expiry) > now + lifetime + 5000) return false;
  const bytes = Uint8Array.from(signature.match(/../g), pair => parseInt(pair,16));
  return crypto.subtle.verify('HMAC', await hmacKey(secret), bytes, signedData(origin, expiry));
}
