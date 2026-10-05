import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { getUser, isVkUser, isAppleUser, logout } from './identity';
import { loginWithVk } from './vkAuth';
import { loginWithApple } from './appleAuth';
import { deleteAccountRemote } from './api';
import { unregisterPushToken } from './notify';
import { loadFavs } from './favorites';
import { loadBlocks } from './blocks';

// Удаление аккаунта: подтверждаем личность повторным входом (ВК/Apple),
// сервер стирает отметки, отзывы, оценки, объявления и жалобы пользователя,
// затем чистим всё локальное. Возвращает { ok } или { ok:false, reason }.
export async function deleteMyAccount() {
  const u = await getUser();
  if (u) {
    let proof;
    if (isVkUser(u)) {
      const r = await loginWithVk();
      if (!r.ok) return { ok: false, reason: r.reason === 'cancel' ? 'cancel' : 'verify' };
      if (r.profile.userId !== u.vk) return { ok: false, reason: 'mismatch' };
      proof = { provider: 'vk', vkToken: r.profile.accessToken, vkClientId: r.profile.clientId };
    } else if (isAppleUser(u)) {
      const r = await loginWithApple();
      if (!r.ok) return { ok: false, reason: r.reason === 'cancel' ? 'cancel' : 'verify' };
      if (r.profile.sub !== u.apple) return { ok: false, reason: 'mismatch' };
      proof = { provider: 'apple', appleToken: r.profile.identityToken };
    } else {
      proof = { provider: 'guest' };
    }
    try { await deleteAccountRemote(u.id, proof); }
    catch (e) { return { ok: false, reason: 'server' }; }
  }
  await wipeLocal();
  return { ok: true };
}

async function wipeLocal() {
  // Токен есть, только если уведомления разрешены — иначе не дёргаем запрос разрешения.
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') await unregisterPushToken();
  } catch (e) {}
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch (e) {}
  try { await AsyncStorage.clear(); } catch (e) {}
  await logout();
  await loadFavs();
  await loadBlocks();
}
