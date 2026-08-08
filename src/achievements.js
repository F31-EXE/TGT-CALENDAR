import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCollection } from './firestore';
import { loadGames } from './api';
import { getUser } from './identity';
import { EKB_TZ } from './theme';

// ── Определения ачивок ──
// tier задаёт цвет медальона; metric — по какому счётчику считается прогресс;
// target — сколько нужно для разблокировки. lib/icon — набор и имя иконки.
export const ACHIEVEMENTS = [
  { id: 'first_game', title: 'Первая вылазка', desc: 'Записаться на первую игру', lib: 'ion', icon: 'flag', tier: 'bronze', metric: 'going', target: 1 },
  { id: 'squad',      title: 'Боец',           desc: '5 игр в списке «Пойду»',   lib: 'mci', icon: 'medal', tier: 'bronze', metric: 'going', target: 5 },
  { id: 'veteran',    title: 'Ветеран',        desc: '15 игр в списке «Пойду»',  lib: 'mci', icon: 'medal-outline', tier: 'silver', metric: 'going', target: 15 },
  { id: 'legend',     title: 'Легенда',        desc: '30 игр в списке «Пойду»',  lib: 'mci', icon: 'trophy', tier: 'gold', metric: 'going', target: 30 },
  { id: 'critic',     title: 'Критик',         desc: 'Оставить первый отзыв',    lib: 'mci', icon: 'comment-text', tier: 'bronze', metric: 'reviews', target: 1 },
  { id: 'reviewer',   title: 'Обозреватель',   desc: 'Оставить 5 отзывов',       lib: 'mci', icon: 'star-box', tier: 'silver', metric: 'reviews', target: 5 },
  { id: 'night_owl',  title: 'Ночной дозор',   desc: 'Записаться на ночную игру', lib: 'mci', icon: 'weather-night', tier: 'special', metric: 'night', target: 1 },
  { id: 'marathon',   title: 'Марафонец',      desc: 'Записаться на многодневную игру', lib: 'mci', icon: 'calendar-range', tier: 'special', metric: 'multi', target: 1 },
  { id: 'chrono',     title: 'Хронометрист',   desc: 'Воспользоваться хронографом', lib: 'ion', icon: 'speedometer', tier: 'special', metric: 'chrono', target: 1 },
  { id: 'reader',     title: 'Читатель',       desc: 'Прочитать статью в блоге', lib: 'mci', icon: 'book-open-variant', tier: 'special', metric: 'article', target: 1 },
  { id: 'sentinel',   title: 'На стрёме',      desc: 'Поставить напоминание об игре', lib: 'ion', icon: 'notifications', tier: 'bronze', metric: 'reminder', target: 1 },
  { id: 'regular',    title: 'Старожил',       desc: 'Заходить в приложение 5 дней', lib: 'mci', icon: 'fire', tier: 'silver', metric: 'days', target: 5 },
  { id: 'trader',     title: 'Барахольщик',    desc: 'Заглянуть в барахолку',    lib: 'mci', icon: 'tag-multiple', tier: 'special', metric: 'market', target: 1 },
];

export const TIER_COLORS = {
  bronze:  { ring: '#b87333', glow: 'rgba(184,115,51,0.45)' },
  silver:  { ring: '#c4c4c4', glow: 'rgba(196,196,196,0.4)' },
  gold:    { ring: '#d8b45a', glow: 'rgba(216,180,90,0.5)' },
  special: { ring: '#8fa44f', glow: 'rgba(143,164,79,0.45)' },
};

// ── Локальные события (то, что нельзя вывести из Firestore) ──
const FLAGS_KEY = 'ach_flags';
const DAYS_KEY = 'ach_days';

async function readJson(key, def) {
  try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) : def; }
  catch (e) { return def; }
}
export async function recordFlag(name) {
  try {
    const flags = await readJson(FLAGS_KEY, {});
    if (flags[name]) return;
    flags[name] = true;
    await AsyncStorage.setItem(FLAGS_KEY, JSON.stringify(flags));
  } catch (e) {}
}
export async function recordDay() {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: EKB_TZ }); // YYYY-MM-DD
    const days = await readJson(DAYS_KEY, []);
    if (days.includes(today)) return;
    days.push(today);
    // Держим не больше 400 записей.
    await AsyncStorage.setItem(DAYS_KEY, JSON.stringify(days.slice(-400)));
  } catch (e) {}
}

// ── Подсчёт метрик и статусов ──
export async function evaluateAchievements() {
  const user = await getUser();
  const flags = await readJson(FLAGS_KEY, {});
  const days = await readJson(DAYS_KEY, []);

  let going = 0, reviews = 0, night = 0, multi = 0;
  let favTag = '', favPolygon = '';
  if (user) {
    const uid = user.id;
    try {
      const [games, rsvps, revs] = await Promise.all([
        loadGames(), getCollection('rsvps'), getCollection('reviews'),
      ]);
      const suffix = '_' + uid;
      const myGoing = rsvps.filter(r => typeof r.id === 'string' && r.id.endsWith(suffix) && r.status === 'going');
      const goingIds = new Set(myGoing.map(r => r.gameId));
      going = goingIds.size;
      const goingGames = games.filter(g => goingIds.has(g.id));
      night = goingGames.some(g => /ноч/i.test(String(g.tags || '') + ' ' + String(g.title || ''))) ? 1 : 0;
      multi = goingGames.some(g => !!g.endDate) ? 1 : 0;
      reviews = revs.filter(r => typeof r.id === 'string' && r.id.endsWith(suffix)).length;
      favTag = topOf(goingGames.flatMap(g => String(g.tags || '').split(',').map(t => t.trim()).filter(Boolean)));
      favPolygon = topOf(goingGames.map(g => String(g.location || '').trim()).filter(Boolean));
    } catch (e) { /* офлайн без кэша — метрики останутся 0 */ }
  }

  const metrics = {
    going, reviews, night, multi,
    chrono: flags.chrono ? 1 : 0,
    reminder: flags.reminder ? 1 : 0,
    market: flags.market ? 1 : 0,
    article: flags.article ? 1 : 0,
    days: days.length,
  };

  const list = ACHIEVEMENTS.map(a => {
    const value = metrics[a.metric] || 0;
    return { ...a, value: Math.min(value, a.target), unlocked: value >= a.target };
  });
  const unlockedCount = list.filter(a => a.unlocked).length;

  const xp = computeXp(metrics, unlockedCount);
  const { rank, next } = rankForXp(xp);

  return {
    list, unlockedCount, total: list.length, hasUser: !!user,
    xp, rank, next,
    stats: { going, reviews, days: days.length, achievements: unlockedCount, favTag, favPolygon },
    userName: user ? user.name : '',
  };
}

// Самый частый элемент массива (или '')
function topOf(arr) {
  const c = {};
  let best = '', bestN = 0;
  for (const x of arr) { c[x] = (c[x] || 0) + 1; if (c[x] > bestN) { bestN = c[x]; best = x; } }
  return best;
}

// ── Опыт и звания ──
export const RANKS = [
  { name: 'Рекрут',    min: 0,    icon: 'shield-outline',   color: '#8a8570' },
  { name: 'Боец',      min: 100,  icon: 'shield-half-full', color: '#b87333' },
  { name: 'Сержант',   min: 300,  icon: 'shield',           color: '#c4c4c4' },
  { name: 'Прапорщик', min: 700,  icon: 'medal',            color: '#d8b45a' },
  { name: 'Легенда',   min: 1500, icon: 'crown',            color: '#8fa44f' },
];
export function computeXp(m, unlockedCount) {
  return (m.going || 0) * 50
    + (m.reviews || 0) * 20
    + (unlockedCount || 0) * 15
    + (m.days || 0) * 3
    + (m.chrono ? 10 : 0)
    + (m.reminder ? 5 : 0)
    + (m.market ? 5 : 0);
}
export function rankForXp(xp) {
  let rank = RANKS[0], next = null;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].min) { rank = RANKS[i]; next = RANKS[i + 1] || null; }
  }
  return { rank, next };
}

// ── Детект новых наград (для всплывашки) ──
const SEEN_KEY = 'ach_seen';
const listeners = new Set();
export function onAchievementCheck(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function requestAchievementCheck() { listeners.forEach(f => { try { f(); } catch (e) {} }); }

// Возвращает список наград, разблокированных с прошлой проверки, и запоминает
// текущее состояние. На самом первом запуске ничего не показываем — просто
// фиксируем уже открытые, чтобы не сыпать старыми ачивками.
export async function pullNewlyUnlocked() {
  const res = await evaluateAchievements();
  const unlockedIds = res.list.filter(a => a.unlocked).map(a => a.id);
  let seen = null;
  try { const raw = await AsyncStorage.getItem(SEEN_KEY); seen = raw ? JSON.parse(raw) : null; } catch (e) {}
  if (seen === null) {
    try { await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(unlockedIds)); } catch (e) {}
    return [];
  }
  const seenSet = new Set(seen);
  const fresh = res.list.filter(a => a.unlocked && !seenSet.has(a.id));
  if (fresh.length) { try { await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(unlockedIds)); } catch (e) {} }
  return fresh;
}
