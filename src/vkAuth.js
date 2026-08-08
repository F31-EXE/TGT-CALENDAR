import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { VKID, vkidConfigured } from './vkid.config';

WebBrowser.maybeCompleteAuthSession();

// PKCE: verifier — случайная hex-строка (валидные символы), challenge — base64url(sha256).
async function makeVerifier() {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function makeChallenge(verifier) {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256, verifier, { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseParams(url) {
  const out = {};
  const grab = (s) => { if (!s) return; s.split('&').forEach(kv => { const i = kv.indexOf('='); const k = decodeURIComponent(kv.slice(0, i < 0 ? kv.length : i)); const v = i < 0 ? '' : decodeURIComponent(kv.slice(i + 1)); if (!(k in out)) out[k] = v; }); };
  const hash = url.split('#')[1];
  const q = url.split('#')[0].split('?')[1];
  grab(q); grab(hash);
  return out;
}

async function postForm(url, data) {
  const body = Object.entries(data)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body });
  try { return await res.json(); } catch (e) { return { error: 'bad_response' }; }
}

// Полный вход через VK ID. Возвращает { ok, profile } или { ok:false, reason }.
export async function loginWithVk() {
  if (!vkidConfigured()) return { ok: false, reason: 'not_configured' };

  const redirectUri = VKID.redirect;
  const verifier = await makeVerifier();
  const codeChallenge = await makeChallenge(verifier);
  const state = (await makeVerifier()).slice(0, 24);

  const authUrl = `${VKID.authorize}?response_type=code`
    + `&client_id=${encodeURIComponent(VKID.clientId)}`
    + `&scope=${encodeURIComponent(VKID.scope)}`
    + `&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&state=${encodeURIComponent(state)}`
    + `&code_challenge=${codeChallenge}&code_challenge_method=s256`;

  let res;
  try { res = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri); }
  catch (e) { return { ok: false, reason: 'browser' }; }
  if (!res || res.type !== 'success' || !res.url) return { ok: false, reason: 'cancel' };

  const p = parseParams(res.url);
  if (p.error) return { ok: false, reason: p.error_description || p.error };
  if (!p.code) return { ok: false, reason: 'no_code' };
  if (p.state && p.state !== state) return { ok: false, reason: 'state' };

  const tok = await postForm(VKID.token, {
    grant_type: 'authorization_code',
    code: p.code, code_verifier: verifier,
    client_id: VKID.clientId, device_id: p.device_id,
    redirect_uri: redirectUri, state,
  });
  if (!tok.access_token) return { ok: false, reason: tok.error_description || tok.error || 'no_token' };

  const info = await postForm(VKID.userInfo, { client_id: VKID.clientId, access_token: tok.access_token });
  const u = (info && info.user) || {};
  const userId = String(u.user_id || tok.user_id || '');
  if (!userId) return { ok: false, reason: 'no_user' };
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Боец';
  const avatar = u.avatar || u.photo_200 || '';
  return { ok: true, profile: { userId, name, avatar } };
}
