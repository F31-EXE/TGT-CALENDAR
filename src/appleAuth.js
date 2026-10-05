import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

// Sign in with Apple (только iOS). Apple отдаёт имя лишь при первом входе,
// поэтому имя может прийти пустым — тогда остаётся уже сохранённое.
export async function appleAvailable() {
  if (Platform.OS !== 'ios') return false;
  try { return await AppleAuthentication.isAvailableAsync(); } catch (e) { return false; }
}

// Возвращает { ok, profile: { sub, name, identityToken } } или { ok:false, reason }.
export async function loginWithApple() {
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
    });
    if (!cred || !cred.user) return { ok: false, reason: 'no_user' };
    const fn = cred.fullName || {};
    const name = [fn.givenName, fn.familyName].filter(Boolean).join(' ').trim();
    return { ok: true, profile: { sub: cred.user, name, identityToken: cred.identityToken || '' } };
  } catch (e) {
    if (e && e.code === 'ERR_REQUEST_CANCELED') return { ok: false, reason: 'cancel' };
    return { ok: false, reason: (e && e.message) || 'apple' };
  }
}
