import AsyncStorage from '@react-native-async-storage/async-storage';

// Избранное барахолки — множество id, хранится локально. Реактивно через
// подписку: карточки и экраны перерисовываются при изменении.
const KEY = 'market_favs';
let favs = new Set();
const subs = new Set();
function emit() { subs.forEach(fn => { try { fn(); } catch (e) {} }); }

export async function loadFavs() {
  try { const raw = await AsyncStorage.getItem(KEY); favs = new Set(raw ? JSON.parse(raw) : []); }
  catch (e) { favs = new Set(); }
  emit();
  return favs;
}
export function isFav(id) { return favs.has(id); }
export function favCount() { return favs.size; }
export function favList() { return [...favs]; }
export async function toggleFav(id) {
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  try { await AsyncStorage.setItem(KEY, JSON.stringify([...favs])); } catch (e) {}
  emit();
  return favs.has(id);
}
export function subscribeFavs(fn) { subs.add(fn); return () => subs.delete(fn); }
