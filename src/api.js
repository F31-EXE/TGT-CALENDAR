import { getCollection, setDoc } from './firestore';
import { getUser } from './identity';
import { EKB_TZ } from './theme';

// Жалоба на объявление барахолки (модерация). Пишем в коллекцию reports —
// один документ на жалобщика-объявление, как на сайте.
export async function reportMarket(item) {
  const user = await getUser();
  const reporter = user ? user.id : ('anon' + Math.random().toString(36).slice(2, 8));
  return setDoc('reports', item.id + '_' + reporter, {
    marketId: item.id,
    title: item.title || '',
    reporterId: reporter,
    createdAt: new Date().toISOString(),
  });
}

// ── Игры ──
export async function loadGames() {
  const games = await getCollection('games');
  return games.sort((a, b) => String(a.startDate || a.date || '').localeCompare(String(b.startDate || b.date || '')));
}
export function splitGames(games) {
  const now = new Date();
  const upcoming = games.filter(g => new Date(g.startDate || g.date) >= now);
  const past = games.filter(g => new Date(g.startDate || g.date) < now).reverse();
  return { upcoming, past };
}

// ── Блог ──
export async function loadBlog() {
  const items = await getCollection('blog');
  return items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

// ── Барахолка ──
const EXPIRE_DAYS = 14;
export async function loadMarket() {
  const items = await getCollection('market');
  const cutoff = Date.now() - EXPIRE_DAYS * 86400000;
  return items
    .filter(m => !m.createdAt || new Date(m.createdAt).getTime() >= cutoff)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

// ── Форматирование ──
export function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: EKB_TZ });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: EKB_TZ });
    return `${date}, ${time}`;
  } catch (e) { return ''; }
}
export function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: EKB_TZ }); }
  catch (e) { return ''; }
}
export function priceLabel(p) {
  return (p != null && p !== '') ? Number(p).toLocaleString('ru') + ' ₽' : 'Договорная';
}
export function parseTags(t) {
  return String(t || '').split(',').map(x => x.trim()).filter(Boolean);
}
export function parsePhotos(m) {
  const arr = String(m.photos || '').split('\n').map(x => x.trim()).filter(x => /^https?:\/\//.test(x));
  return arr.length ? arr : (m.image ? [m.image] : []);
}
export function marketWriteLink(m) {
  // vkId бывает числом ("12345") или строкой ("vk12345"/"id12345") — берём цифры.
  const digits = String(m.vkId || '').match(/\d+/);
  if (digits) return 'https://vk.com/write' + digits[0];
  if (m.authorProfile) return m.authorProfile;
  return '';
}

// ── Контент статьи блога → массив сегментов для нативного рендера ──
// Блоки: [{t:'text'|'image', v}]. Текст может быть простым или c HTML
// (заголовки/списки после вставки из Word). Приводим к сегментам:
// {type:'h2'|'h3'|'p'|'li'|'image', text|uri}.
export function articleSegments(a) {
  let blocks = null;
  if (a.blocks) {
    try { const arr = JSON.parse(a.blocks); if (Array.isArray(arr) && arr.length) blocks = arr; } catch (e) {}
  }
  if (!blocks) blocks = [{ t: 'text', v: a.body || '' }];
  const out = [];
  for (const b of blocks) {
    const type = b.t || b.type;
    const val = (b.v != null ? b.v : b.value) || '';
    if (type === 'image' && val) { out.push({ type: 'image', uri: val }); continue; }
    if (type === 'text' && String(val).trim()) out.push(...textToSegments(val));
  }
  return out;
}

function decodeEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&hellip;/g, '…');
}

function textToSegments(val) {
  const s = String(val);
  const hasHtml = /<(p|h[1-6]|ul|ol|li|br|strong|b|em|i|u|a|blockquote)\b/i.test(s);
  if (!hasHtml) {
    // Абзацы по пустой строке; одиночные переносы внутри абзаца (жёсткий
    // перенос при наборе) схлопываем в пробел, чтобы текст «не съезжал».
    return s.split(/\n{2,}/)
      .map(p => decodeEntities(p).replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean)
      .map(p => ({ type: 'p', text: p }));
  }
  const segs = [];
  // Разбиваем по блочным тегам
  const blockRe = /<(h2|h3|h1|h4|li|p|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  let matched = false;
  while ((m = blockRe.exec(s))) {
    matched = true;
    const tag = m[1].toLowerCase();
    const inner = decodeEntities(
      m[2]
        .replace(/<br\s*\/?>/gi, '\n')
        // Сохраняем ссылки: <a href="url">label</a> → «label url» (url ловит linkify)
        .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (mm, href, label) => {
          const t = label.replace(/<[^>]+>/g, '').trim();
          return t && !/https?:\/\//i.test(t) ? t + ' ' + href : href;
        })
        .replace(/<[^>]+>/g, '')
    ).trim();
    if (!inner) continue;
    let type = 'p';
    if (tag === 'h1' || tag === 'h2') type = 'h2';
    else if (tag === 'h3' || tag === 'h4') type = 'h3';
    else if (tag === 'li') type = 'li';
    else if (tag === 'blockquote') type = 'quote';
    segs.push({ type, text: inner });
  }
  if (!matched) {
    const plain = decodeEntities(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
    if (plain) segs.push({ type: 'p', text: plain });
  }
  return segs;
}

export function blogExcerpt(a) {
  const t = String(a.body || '').replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 140 ? t.slice(0, 140) + '…' : t;
}

export function yandexMapsUrl(lat, lng) {
  return `https://yandex.ru/maps/?ll=${lng}%2C${lat}&z=16&pt=${lng}%2C${lat}`;
}

// Публичный домен и слаги — для кнопки «Поделиться» (ведёт на серверные страницы)
export const SITE_ORIGIN = 'https://airsoft-calendar-tgt.ru';
export function slugify(s) {
  const map = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  return String(s || '').toLowerCase().split('').map(c => (map[c] !== undefined ? map[c] : c)).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
export function gameShareUrl(g) {
  const datePart = String(g.startDate || g.date || '').slice(0, 10);
  const base = slugify(g.title || g.id);
  return `${SITE_ORIGIN}/game/${datePart ? base + '-' + datePart : base}`;
}
export function blogShareUrl(a) {
  const slug = (a.slug && a.slug.trim()) ? a.slug.trim() : slugify(a.title || a.id);
  return `${SITE_ORIGIN}/blog/${slug}`;
}

// ── Участники игры (RSVP) ──
export async function loadRsvpsForGame(gameId) {
  const all = await getCollection('rsvps');
  return all.filter(r => r.gameId === gameId);
}
export async function loadGoing(gameId) {
  return (await loadRsvpsForGame(gameId)).filter(r => r.status === 'going');
}
// Записать участие: status ∈ going|maybe|declined. id документа = gameId_userId.
export async function setRsvp(gameId, user, status) {
  return setDoc('rsvps', `${gameId}_${user.id}`, {
    gameId,
    name: user.name,
    status,
    updatedAt: new Date().toISOString(),
  });
}
export function rsvpDocId(gameId, userId) { return `${gameId}_${userId}`; }

// ── Справочники (команды/мастера/организаторы/клубы) ──
export async function loadRef(collection) {
  const items = await getCollection(collection);
  return items.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
}
export async function loadFaq() {
  const items = await getCollection('faq');
  return items.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
}

// ── Отзывы о справочниках (та же коллекция reviews, что и у игр на сайте) ──
// Ключ субъекта — с префиксом коллекции, чтобы не пересекаться с id игр.
// Поле в документе называется gameId (как у игр) и служит универсальным ключом.
export function refSubjectKey(collection, id) {
  const p = collection === 'masters' ? 'm_'
    : collection === 'workshops' ? 'w_'
    : collection === 'clubs' ? 'c_'
    : collection === 'polygons' ? 't_' : 'r_';
  return p + id;
}
export async function loadRefReviews() {
  return getCollection('reviews');
}
export function reviewsForSubject(all, subjectKey) {
  return (all || [])
    .filter(r => r.gameId === subjectKey)
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}
export function reviewStats(reviews) {
  const list = (reviews || []).filter(r => typeof r.stars === 'number');
  if (!list.length) return { avg: 0, count: 0 };
  return { avg: list.reduce((s, r) => s + (r.stars || 0), 0) / list.length, count: list.length };
}
export async function submitReview(subjectKey, user, stars, text) {
  return setDoc('reviews', `${subjectKey}_${user.id}`, {
    gameId: subjectKey,
    author: user.name,
    text: text || '',
    stars,
    createdAt: new Date().toISOString(),
  });
}

// Ключ дня (YYYY-MM-DD) в зоне ЕКБ — для календарной сетки
export function ekbDateKey(iso) {
  try { return new Date(iso).toLocaleDateString('en-CA', { timeZone: EKB_TZ }); }
  catch (e) { return ''; }
}
export function fmtDayFull(dateKey) {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' });
  } catch (e) { return dateKey; }
}
export function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: EKB_TZ }); }
  catch (e) { return ''; }
}
