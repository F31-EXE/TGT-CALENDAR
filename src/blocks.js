import AsyncStorage from '@react-native-async-storage/async-storage';

// Скрытые пользователи (блокировка автора отзывов/объявлений) — множество id
// вида «vk123»/«apple…»/«g…», хранится локально. Реактивно через подписку.
const KEY = 'blocked_users';
let blocked = new Set();
const subs = new Set();
function emit() { subs.forEach(fn => { try { fn(); } catch (e) {} }); }

export async function loadBlocks() {
  try { const raw = await AsyncStorage.getItem(KEY); blocked = new Set(raw ? JSON.parse(raw) : []); }
  catch (e) { blocked = new Set(); }
  emit();
  return blocked;
}
export function isBlocked(id) { return !!id && blocked.has(id); }
export function blockedCount() { return blocked.size; }
export async function blockUser(id) {
  if (!id) return;
  blocked.add(id);
  try { await AsyncStorage.setItem(KEY, JSON.stringify([...blocked])); } catch (e) {}
  emit();
}
export async function clearBlocks() {
  blocked = new Set();
  try { await AsyncStorage.removeItem(KEY); } catch (e) {}
  emit();
}
export function subscribeBlocks(fn) { subs.add(fn); return () => subs.delete(fn); }
