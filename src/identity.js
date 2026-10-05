import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tgt_rsvp_user';

// Локальная личность для участия в играх — как запасной вход в вебе:
// имя + сгенерированный id (без VK). VK-вход добавим отдельным этапом.
let cached = null;

export async function getUser() {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) { cached = JSON.parse(raw); return cached; }
  } catch (e) {}
  return null;
}

// Название команды бойца (для «военного билета»). Хранится отдельно от имени —
// имя со временем будет подтягиваться из ВК-профиля, а команду вводит сам игрок.
const TEAM_KEY = 'tgt_team';
export async function getTeam() {
  try { return (await AsyncStorage.getItem(TEAM_KEY)) || ''; } catch (e) { return ''; }
}
export async function setTeam(name) {
  const clean = String(name || '').trim().slice(0, 40);
  try { await AsyncStorage.setItem(TEAM_KEY, clean); } catch (e) {}
  return clean;
}

export async function setUserName(name) {
  const clean = String(name || '').trim().slice(0, 40);
  if (!clean) return null;
  const existing = await getUser();
  const user = { id: existing?.id || ('g' + Math.random().toString(36).slice(2, 10)), name: clean, avatar: existing?.avatar || '' };
  cached = user;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(user)); } catch (e) {}
  return user;
}

// Сохранить ВК-профиль как личность. Формат id — «vk<число>», как на сайте,
// чтобы отметки участия и отзывы были общими между приложением и сайтом/ВК.
export async function setVkUser(p) {
  const user = {
    id: 'vk' + p.userId,
    vk: String(p.userId),
    name: (p.name || 'Боец').slice(0, 60),
    avatar: p.avatar || '',
    profile: 'https://vk.com/id' + p.userId,
  };
  cached = user;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(user)); } catch (e) {}
  return user;
}
export function isVkUser(u) { return !!(u && u.vk); }

// Профиль Sign in with Apple. id — «apple<sub без точек>»: только буквы и
// цифры, чтобы суффикс «_<id>» в id документов был однозначным.
export async function setAppleUser(p) {
  const existing = await getUser();
  const user = {
    id: 'apple' + String(p.sub).replace(/[^A-Za-z0-9]/g, ''),
    apple: String(p.sub),
    name: (p.name || (existing && existing.name) || 'Боец').slice(0, 60),
    avatar: '',
  };
  cached = user;
  try { await AsyncStorage.setItem(KEY, JSON.stringify(user)); } catch (e) {}
  return user;
}
export function isAppleUser(u) { return !!(u && u.apple); }
export function isLinked(u) { return isVkUser(u) || isAppleUser(u); }
export async function logout() {
  cached = null;
  try { await AsyncStorage.removeItem(KEY); } catch (e) {}
}
