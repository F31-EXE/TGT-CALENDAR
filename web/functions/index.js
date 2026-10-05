// ════════════════════════════════════════════════════════════════════════
//  SEO-рендер для блога THE GRIM TEAM.
//
//  Проблема: сайт — одностраничное приложение (SPA). Робот Яндекса плохо
//  исполняет JavaScript, поэтому статьи блога, которые дорисовываются
//  скриптом, он почти не видит и не индексирует.
//
//  Решение: эта Cloud Function отдаёт роботам и людям ГОТОВЫЙ HTML статьи
//  (сервер-сайд рендер) по «человеческому» адресу /blog/<slug>, плюс
//  индекс блога /blog, карту сайта /sitemap.xml и /robots.txt. Всё это
//  Яндекс.Вебмастер спокойно проглотит.
//
//  Развёртывание:  firebase deploy --only functions,hosting
//  (нужен тариф Blaze — он у нас уже подключён).
// ════════════════════════════════════════════════════════════════════════

const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const sanitizeHtml = require('sanitize-html');

// Автопостинг барахолки в группу ВК. Нужен только секрет — токен сообщества;
// id группы определяется из токена автоматически (можно переопределить через
// переменную окружения VK_GROUP_ID в functions/.env, но это необязательно).
const VK_GROUP_TOKEN = defineSecret('VK_GROUP_TOKEN');
const VK_MINIAPP_ID = '54513499'; // id мини-аппа ВК (не менять)

admin.initializeApp();
const dbf = admin.firestore();

const SITE_NAME = 'THE GRIM TEAM КАЛЕНДАРЬ';
const DEFAULT_DESC =
  'Календарь страйкбольных игр Урала: расписание, полигоны, команды, организаторы и барахолка.';

// Канонический публичный домен сайта. Все SEO-адреса (canonical, og:url,
// sitemap, Schema.org, robots) строятся от него — чтобы поисковик видел один
// адрес, даже если страницу отдали через strikeball-calendar.web.app
// (его оставляем живым ради мини-аппа ВК). Это НЕ имя Firebase-проекта и НЕ
// storageBucket — их не трогаем.
const SITE_ORIGIN = 'https://airsoft-calendar-tgt.ru';

// ─── утилиты ─────────────────────────────────────────────────────────────
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Тот же слаг, что и на клиенте (латиница/цифры/дефис, транслит кириллицы).
function slugify(s) {
  const map = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  return String(s || '').toLowerCase().split('').map(c => (map[c] !== undefined ? map[c] : c)).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function excerpt(body) {
  const t = String(body || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  return t.length > 200 ? t.slice(0, 200) + '…' : t;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Yekaterinburg',
    });
  } catch (e) { return ''; }
}

function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Yekaterinburg' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yekaterinburg' });
    return date + ', ' + time;
  } catch (e) { return fmtDate(iso); }
}

// Абзацы + кликабельные ссылки, всё экранировано.
function bodyToHtml(body) {
  return String(body || '')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const withLinks = esc(p).replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" rel="nofollow noopener" target="_blank">$1</a>'
      );
      return `<p>${withLinks.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

// Текст блока может содержать разметку (заголовки/списки/жирный) — например
// после вставки из Word. Есть ли в значении такая разметка?
function hasRichHtml(v) {
  return /<(p|h[1-6]|ul|ol|li|br|strong|b|em|i|u|a|blockquote)\b/i.test(String(v || ''));
}

// Безопасная санитизация rich-текста: только белый список тегов. H1 из Word
// понижаем до H2 (H1 — это заголовок статьи), H4-H6 — до H3.
function sanitizeRich(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'h2', 'h3', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'a', 'blockquote'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3', b: 'strong', i: 'em',
      p: (tagName, attribs) => {
        const cls = (attribs.class || '').toLowerCase();
        // Word/Docs размечают заголовки как <p class="MsoHeading…"> — поднимаем в H2
        if (/(mso)?heading|мсотитле|title/.test(cls)) return { tagName: 'h2', attribs: {} };
        return { tagName: 'p', attribs: {} };
      },
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: { href: attribs.href || '#', target: '_blank', rel: 'nofollow noopener' },
      }),
    },
  });
}

// Тело статьи из блоков [{t:'text'|'image', v}]. Старые статьи без blocks
// рендерим из body — обратная совместимость.
function contentToHtml(a) {
  let blocks = null;
  if (a && a.blocks) {
    try {
      const arr = JSON.parse(a.blocks);
      if (Array.isArray(arr) && arr.length) blocks = arr;
    } catch (e) {}
  }
  if (!blocks) return bodyToHtml(a && a.body);
  return blocks.map(b => {
    const type = b.t || b.type;
    const val = (b.v != null ? b.v : b.value) || '';
    if (type === 'image' && val) {
      return `<figure class="fig"><img src="${esc(val)}" alt="${esc(a.title || '')}" loading="lazy"></figure>`;
    }
    if (type === 'text' && String(val).trim()) {
      return hasRichHtml(val) ? sanitizeRich(val) : bodyToHtml(val);
    }
    return '';
  }).join('\n');
}

// Всегда возвращаем канонический домен (не хост запроса), чтобы канонические
// адреса не раздваивались между .web.app и .ru.
function baseUrl() {
  return SITE_ORIGIN;
}

// ─── общий каркас страницы ───────────────────────────────────────────────
function page({ title, desc, canonical, image, ogType, head, body }) {
  const img = image ? `<meta property="og:image" content="${esc(image)}">` : '';
  const twImg = image ? `<meta name="twitter:image" content="${esc(image)}">` : '';
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${esc(canonical)}">
<link rel="icon" type="image/png" href="/logo.png">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:type" content="${esc(ogType || 'website')}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="ru_RU">
${img}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${twImg}
${head || ''}
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#20241a;color:#e7e3d4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6}
  a{color:#c9d17a}
  .wrap{max-width:760px;margin:0 auto;padding:20px 18px 60px}
  header.site{border-bottom:1px solid #3c4230;background:#191c13}
  header.site .wrap{padding:14px 18px;display:flex;align-items:center;gap:12px}
  header.site img{height:38px;width:38px;object-fit:contain}
  header.site .name{font-family:Oswald,Impact,sans-serif;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:#e7e3d4;font-size:17px;text-decoration:none}
  h1{font-family:Oswald,Impact,sans-serif;text-transform:uppercase;line-height:1.15;font-size:30px;margin:6px 0 8px;color:#f2eede}
  .meta{font-family:Share Tech Mono,monospace;font-size:13px;color:#9aa07f;margin-bottom:20px}
  .cover{width:100%;border-radius:10px;margin:0 0 18px;display:block}
  .body p{margin:0 0 16px;font-size:17px}
  .body h2{font-family:Oswald,Impact,sans-serif;text-transform:uppercase;font-size:24px;line-height:1.2;margin:28px 0 10px;color:#f2eede}
  .body h3{font-family:Oswald,Impact,sans-serif;font-size:19px;line-height:1.25;margin:22px 0 8px;color:#e7e3d4}
  .body ul,.body ol{margin:0 0 16px;padding-left:22px;font-size:17px}
  .body li{margin:0 0 6px}
  .body blockquote{margin:16px 0;padding:8px 16px;border-left:3px solid #8a9a3a;color:#c8c6b6;font-style:italic}
  .fig{margin:20px 0}
  .fig img{width:100%;border-radius:10px;display:block}
  .facts{list-style:none;padding:0;margin:0 0 18px;font-size:16px}
  .facts li{margin:0 0 8px}
  .facts b{color:#c9d17a}
  .muted{color:#7b8163}
  .rating{font-family:Share Tech Mono,monospace;font-size:15px;color:#e7e3d4;margin:0 0 14px}
  .rating .stars{color:#d8b45a;letter-spacing:2px}
  .rating b{color:#c9d17a}
  .rev{background:#262b1c;border:1px solid #3c4230;border-radius:8px;padding:12px 14px;margin:0 0 10px}
  .rev-h{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .rev-h b{color:#f2eede}
  .rev .stars{color:#d8b45a;letter-spacing:2px;font-family:Share Tech Mono,monospace}
  .rev p{margin:8px 0 0;font-size:15px;color:#c8c6b6}
  .rev-d{font-size:12px;margin-top:8px}
  .tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
  .tag{font-family:Share Tech Mono,monospace;font-size:12px;background:#2f351f;border:1px solid #4a5330;color:#c9d17a;border-radius:20px;padding:3px 10px}
  .albums{margin:18px 0}
  .albums ul{margin:6px 0 0;padding-left:20px}
  h2.sec{font-family:Oswald,Impact,sans-serif;text-transform:uppercase;font-size:20px;margin:28px 0 12px;color:#c9d17a;border-bottom:1px solid #3c4230;padding-bottom:6px}
  .crumbs{font-family:Share Tech Mono,monospace;font-size:12px;color:#9aa07f;margin:0 0 12px}
  .crumbs a{color:#9aa07f}
  .cta{display:inline-block;margin-top:26px;background:#8a9a3a;color:#191c13;font-family:Oswald,sans-serif;text-transform:uppercase;font-weight:700;letter-spacing:1px;text-decoration:none;padding:12px 22px;border-radius:8px}
  .card{display:block;background:#262b1c;border:1px solid #3c4230;border-radius:10px;padding:16px;margin:0 0 14px;text-decoration:none;color:inherit}
  .card h2{font-family:Oswald,sans-serif;font-size:20px;margin:0 0 6px;color:#f2eede;text-transform:uppercase}
  .card .meta{margin:0 0 8px}
  .card p{margin:0;color:#c8c6b6;font-size:15px}
  footer.site{border-top:1px solid #3c4230;color:#7b8163;font-family:Share Tech Mono,monospace;font-size:12px;text-align:center;padding:24px 12px}
</style>
</head>
<body>
<header class="site"><div class="wrap">
  <img src="/logo.png" alt="${esc(SITE_NAME)}">
  <a class="name" href="/">THE GRIM TEAM</a>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="site">© ${new Date().getFullYear()} ${esc(SITE_NAME)} · Страйкбол Урала</footer>
</body>
</html>`;
}

// ─── загрузка статей ─────────────────────────────────────────────────────
async function loadArticles() {
  const snap = await dbf.collection('blog').orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function resolveSlug(a) {
  return (a.slug && String(a.slug).trim()) ? String(a.slug).trim() : slugify(a.title || a.id);
}

// ─── загрузка игр ────────────────────────────────────────────────────────
async function loadGames() {
  const snap = await dbf.collection('games').orderBy('startDate', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Слаг игры: название + дата (чтобы одноимённые игры в разные дни не совпадали)
function gameSlug(g) {
  const datePart = String(g.startDate || g.date || '').slice(0, 10);
  const base = slugify(g.title || g.id);
  return datePart ? base + '-' + datePart : base;
}

// Ссылки на фотоальбомы ВК: строки «Название | ссылка» или просто ссылка
function parseAlbumsSrv(str) {
  if (!str) return [];
  return String(str).split('\n').map(line => {
    line = line.trim(); if (!line) return null;
    let title = '', url = line;
    const pipe = line.indexOf('|');
    if (pipe >= 0) { title = line.slice(0, pipe).trim(); url = line.slice(pipe + 1).trim(); }
    if (!/^https?:\/\//i.test(url)) return null;
    return { title: title || 'Фотоальбом ВК', url };
  }).filter(Boolean);
}

function tagsHtmlSrv(tags) {
  const list = String(tags || '').split(',').map(t => t.trim()).filter(Boolean);
  if (!list.length) return '';
  return `<div class="tags">${list.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`;
}

// ─── отзывы и рейтинг (общая коллекция reviews) ───────────────────────────
// Ключ субъекта = поле gameId документа. У игр это id игры; у справочников —
// префикс типа + id (m_/w_/c_), как на клиенте.
async function loadReviewsBySubject() {
  const snap = await dbf.collection('reviews').get();
  const map = {};
  snap.docs.forEach(d => {
    const r = d.data() || {};
    const k = r.gameId;
    if (!k || typeof r.stars !== 'number') return;
    (map[k] = map[k] || []).push(r);
  });
  return map;
}
function ratingOf(list) {
  if (!list || !list.length) return null;
  const avg = list.reduce((s, r) => s + (r.stars || 0), 0) / list.length;
  return { avg, count: list.length };
}
function starsGlyphs(avg) {
  const n = Math.round(avg);
  return '★★★★★☆☆☆☆☆'.slice(5 - n, 10 - n);
}
function ratingLineHtml(r) {
  if (!r) return '';
  return `<div class="rating"><span class="stars">${starsGlyphs(r.avg)}</span> <b>${r.avg.toFixed(1)}</b> / 5 <span class="muted">· ${r.count} отз.</span></div>`;
}
function aggregateRatingLd(r) {
  return r ? { '@type': 'AggregateRating', ratingValue: r.avg.toFixed(1), reviewCount: r.count, bestRating: 5, worstRating: 1 } : null;
}
function reviewsLd(list) {
  return (list || []).slice(0, 20).map(r => ({
    '@type': 'Review',
    reviewRating: { '@type': 'Rating', ratingValue: r.stars, bestRating: 5, worstRating: 1 },
    author: { '@type': 'Person', name: r.author || 'Аноним' },
    ...(r.text ? { reviewBody: String(r.text).slice(0, 500) } : {}),
    ...(r.createdAt ? { datePublished: String(r.createdAt).slice(0, 10) } : {}),
  }));
}
function reviewsHtml(list) {
  if (!list || !list.length) return '<p class="muted">Отзывов пока нет.</p>';
  return list.map(r => `<div class="rev">
  <div class="rev-h"><b>${esc(r.author || 'Боец')}</b> <span class="stars">${starsGlyphs(r.stars || 0)}</span></div>
  ${r.text ? `<p>${esc(r.text)}</p>` : ''}
  ${r.createdAt ? `<div class="muted rev-d">${esc(fmtDate(r.createdAt))}</div>` : ''}
</div>`).join('\n');
}

// Справочники, отдаваемые роботам отдельными индексируемыми страницами.
const REF_TYPES = {
  org:    { col: 'workshops', prefix: 'w_', index: 'orgs',    title: 'Организаторы игр',   one: 'Организатор игр',   schema: 'Organization',  desc: 'Организаторы страйкбольных игр Урала — отзывы и рейтинг игроков.' },
  club:   { col: 'clubs',     prefix: 'c_', index: 'clubs',   title: 'Страйкбольные клубы', one: 'Страйкбольный клуб', schema: 'Organization', desc: 'Страйкбольные клубы Урала — отзывы и рейтинг игроков.' },
  master: { col: 'masters',   prefix: 'm_', index: 'masters', title: 'Мастера по ремонту', one: 'Мастер по ремонту', schema: 'LocalBusiness', desc: 'Мастера по ремонту и тюнингу привода на Урале — отзывы и рейтинг.' },
};
async function loadRefCol(col) {
  const snap = await dbf.collection(col).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
function refSlug(item) {
  return slugify(item.name || item.id);
}

// ─── страница игры ───────────────────────────────────────────────────────
async function renderGame(req, res, key) {
  const games = await loadGames();
  const g = games.find(x => gameSlug(x) === key) || games.find(x => x.id === key);

  if (!g) {
    res.status(404).set('Cache-Control', 'no-store').send(
      page({
        title: 'Игра не найдена — ' + SITE_NAME,
        desc: DEFAULT_DESC,
        canonical: baseUrl(req) + '/games',
        image: baseUrl(req) + '/logo.png',
        ogType: 'website',
        body: `<div class="crumbs"><a href="/games">← Все игры</a></div>
<h1>Игра не найдена</h1>
<p>Возможно, её удалили или адрес изменился.</p>
<a class="cta" href="/games">Все игры</a>`,
      })
    );
    return;
  }

  const base = baseUrl(req);
  const slug = gameSlug(g);
  const canonical = base + '/game/' + slug;
  const isPast = new Date(g.startDate || g.date) < new Date();
  const when = fmtDateTime(g.startDate || g.date);
  const title = g.title + ' — ' + when + (g.location ? ', ' + g.location : '');
  const descBase = g.description ? excerpt(g.description) : (g.title + ' — страйкбольная игра ' + when + (g.location ? ' в ' + g.location : '') + '.');
  const image = g.image || (base + '/logo.png');
  const hasPt = typeof g.lat === 'number' && typeof g.lng === 'number' && !isNaN(g.lat) && !isNaN(g.lng);
  const albums = parseAlbumsSrv(g.albums);

  const reviewsMap = await loadReviewsBySubject().catch(() => ({}));
  const gReviews = reviewsMap[g.id] || [];
  const gRating = ratingOf(gReviews);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: g.title || '',
    startDate: g.startDate || g.date || '',
    description: descBase,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    organizer: { '@type': 'Organization', name: SITE_NAME },
  };
  if (g.endDate) jsonLd.endDate = g.endDate;
  if (g.image) jsonLd.image = g.image;
  if (g.location) jsonLd.location = { '@type': 'Place', name: g.location };
  if (gRating) {
    jsonLd.aggregateRating = aggregateRatingLd(gRating);
    jsonLd.review = reviewsLd(gReviews);
  }

  const body = `
<div class="crumbs"><a href="/">Главная</a> · <a href="/games">Игры</a></div>
${g.image ? `<img class="cover" src="${esc(g.image)}" alt="${esc(g.title)}">` : ''}
<article>
  <h1>${esc(g.title)}</h1>
  ${ratingLineHtml(gRating)}
  ${tagsHtmlSrv(g.tags)}
  <ul class="facts">
    <li><b>Когда:</b> ${esc(when)}${g.endDate ? ' <span class="muted">(многодневная)</span>' : ''}</li>
    ${g.location ? `<li><b>Где:</b> ${esc(g.location)}</li>` : ''}
    ${hasPt ? `<li><a href="https://yandex.ru/maps/?ll=${g.lng}%2C${g.lat}&z=16&pt=${g.lng}%2C${g.lat}" rel="nofollow noopener" target="_blank">Открыть точку на Яндекс.Картах →</a></li>` : ''}
  </ul>
  ${g.description ? `<div class="body">${bodyToHtml(g.description)}</div>` : ''}
  ${albums.length ? `<div class="albums"><b>Фотоальбомы:</b><ul>${albums.map(a => `<li><a href="${esc(a.url)}" rel="nofollow noopener" target="_blank">${esc(a.title)}</a></li>`).join('')}</ul></div>` : ''}
  ${/^https?:\/\//i.test(g.announceUrl || '') ? `<p><a href="${esc(g.announceUrl)}" rel="nofollow noopener" target="_blank">Читать анонс ВКонтакте →</a></p>` : ''}
</article>
<a class="cta" href="/">${isPast ? 'Смотреть ближайшие игры →' : 'Записаться и смотреть детали →'}</a>
`;

  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=300, s-maxage=600')
    .send(
      page({
        title: g.title + ' — THE GRIM TEAM', desc: descBase, canonical, image, ogType: 'article',
        head: `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
        body,
      })
    );
}

// ─── архив игр ───────────────────────────────────────────────────────────
async function renderGamesIndex(req, res) {
  const games = await loadGames();
  const canonical = baseUrl(req) + '/games';
  const now = new Date();
  const upcoming = games.filter(g => new Date(g.startDate || g.date) >= now);
  const past = games.filter(g => new Date(g.startDate || g.date) < now);

  const card = g => `<a class="card" href="/game/${esc(gameSlug(g))}">
  <h2>${esc(g.title)}</h2>
  <div class="meta">${esc(fmtDateTime(g.startDate || g.date))}${g.location ? ' · ' + esc(g.location) : ''}</div>
  ${g.description ? `<p>${esc(excerpt(g.description))}</p>` : ''}
</a>`;

  const section = (name, list) => list.length
    ? `<h2 class="sec">${name}</h2>` + list.map(card).join('\n')
    : '';

  const body = `
<div class="crumbs"><a href="/">Главная</a> · Игры</div>
<h1>Страйкбольные игры Урала</h1>
<div class="meta">Расписание ближайших игр и архив прошедших</div>
${section('Ближайшие', upcoming)}
${section('Архив', past)}
${games.length ? '' : '<p>Игр пока нет.</p>'}
<a class="cta" href="/">Открыть календарь →</a>
`;

  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=300, s-maxage=600')
    .send(
      page({
        title: 'Страйкбольные игры Урала — расписание и архив — ' + SITE_NAME,
        desc: 'Календарь страйкбольных игр Урала: ближайшие игры и архив прошедших с описанием и фото.',
        canonical, image: baseUrl(req) + '/logo.png', ogType: 'website', body,
      })
    );
}

// ─── страница статьи ─────────────────────────────────────────────────────
async function renderArticle(req, res, key) {
  const arts = await loadArticles();
  const a =
    arts.find(x => resolveSlug(x) === key) ||
    arts.find(x => x.id === key);

  if (!a) {
    res.status(404).set('Cache-Control', 'no-store').send(
      page({
        title: 'Статья не найдена — ' + SITE_NAME,
        desc: DEFAULT_DESC,
        canonical: baseUrl(req) + '/blog',
        ogType: 'website',
        body: `<div class="crumbs"><a href="/blog">← Блог</a></div>
<h1>Статья не найдена</h1>
<p>Возможно, её удалили или адрес изменился.</p>
<a class="cta" href="/blog">Все статьи</a>`,
      })
    );
    return;
  }

  const slug = resolveSlug(a);
  const canonical = baseUrl(req) + '/blog/' + slug;
  const title = (a.seoTitle && a.seoTitle.trim()) ? a.seoTitle.trim() : (a.title + ' — THE GRIM TEAM');
  const desc = (a.seoDesc && a.seoDesc.trim()) ? a.seoDesc.trim() : excerpt(a.body);
  const published = a.createdAt || '';
  const modified = a.updatedAt || a.createdAt || '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title || '',
    description: desc,
    datePublished: published,
    dateModified: modified,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: baseUrl(req) + '/logo.png' },
    },
    mainEntityOfPage: canonical,
  };
  if (a.image) jsonLd.image = a.image;

  const body = `
<div class="crumbs"><a href="/">Главная</a> · <a href="/blog">Блог</a></div>
${a.image ? `<img class="cover" src="${esc(a.image)}" alt="${esc(a.title)}">` : ''}
<article>
  <h1>${esc(a.title)}</h1>
  <div class="meta">${esc(fmtDate(a.createdAt))}</div>
  <div class="body">${contentToHtml(a)}</div>
</article>
<a class="cta" href="/">Открыть календарь игр →</a>
`;

  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=300, s-maxage=600')
    .send(
      page({
        title, desc, canonical, image: a.image || (baseUrl(req) + '/logo.png'), ogType: 'article',
        head: `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
        body,
      })
    );
}

// ─── индекс блога ────────────────────────────────────────────────────────
async function renderBlogIndex(req, res) {
  const arts = await loadArticles();
  const canonical = baseUrl(req) + '/blog';
  const cards = arts.map(a => {
    const slug = resolveSlug(a);
    return `<a class="card" href="/blog/${esc(slug)}">
  <h2>${esc(a.title)}</h2>
  <div class="meta">${esc(fmtDate(a.createdAt))}</div>
  <p>${esc(excerpt(a.body))}</p>
</a>`;
  }).join('\n');

  const body = `
<div class="crumbs"><a href="/">Главная</a> · Блог</div>
<h1>Блог</h1>
<div class="meta">Новости, разборы и заметки о страйкболе на Урале</div>
${arts.length ? cards : '<p>Статей пока нет.</p>'}
<a class="cta" href="/">Открыть календарь игр →</a>
`;

  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=300, s-maxage=600')
    .send(
      page({
        title: 'Блог о страйкболе — ' + SITE_NAME,
        desc: 'Статьи, новости и разборы о страйкболе на Урале от THE GRIM TEAM.',
        canonical, image: baseUrl(req) + '/logo.png', ogType: 'website', body,
      })
    );
}

// ─── справочник: индекс типа (организаторы/клубы/мастера) ─────────────────
async function renderRefIndex(req, res, type) {
  const cfg = REF_TYPES[type];
  const base = baseUrl(req);
  const canonical = base + '/' + cfg.index;
  const [items, revMap] = await Promise.all([loadRefCol(cfg.col), loadReviewsBySubject().catch(() => ({}))]);
  const withR = items.map(it => ({ it, r: ratingOf(revMap[cfg.prefix + it.id]) }));
  withR.sort((a, b) =>
    ((b.r ? b.r.avg : 0) - (a.r ? a.r.avg : 0)) ||
    ((b.r ? b.r.count : 0) - (a.r ? a.r.count : 0)) ||
    String(a.it.name || '').localeCompare(String(b.it.name || ''), 'ru'));

  const cards = withR.map(({ it, r }) => `<a class="card" href="/${type}/${esc(refSlug(it))}">
  <h2>${esc(it.name)}</h2>
  <div class="meta">${it.city ? esc(it.city) : ''}${r ? (it.city ? ' · ' : '') + '★ ' + r.avg.toFixed(1) + ' (' + r.count + ')' : ''}</div>
  ${it.desc ? `<p>${esc(excerpt(it.desc))}</p>` : ''}
</a>`).join('\n');

  const body = `
<div class="crumbs"><a href="/">Главная</a> · ${esc(cfg.title)}</div>
<h1>${esc(cfg.title)} · Урал</h1>
<div class="meta">${esc(cfg.desc)}</div>
${withR.length ? cards : '<p>Пока пусто.</p>'}
<a class="cta" href="/">Открыть календарь игр →</a>
`;
  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=300, s-maxage=600')
    .send(page({
      title: cfg.title + ' Урала — отзывы и рейтинг — ' + SITE_NAME,
      desc: cfg.desc, canonical, image: base + '/logo.png', ogType: 'website', body,
    }));
}

// ─── справочник: карточка объекта с отзывами ──────────────────────────────
async function renderRefItem(req, res, type, key) {
  const cfg = REF_TYPES[type];
  const base = baseUrl(req);
  const [items, revMap] = await Promise.all([loadRefCol(cfg.col), loadReviewsBySubject().catch(() => ({}))]);
  const it = items.find(x => refSlug(x) === key) || items.find(x => x.id === key);

  if (!it) {
    res.status(404).set('Cache-Control', 'no-store').send(page({
      title: cfg.one + ' не найден — ' + SITE_NAME,
      desc: cfg.desc, canonical: base + '/' + cfg.index, ogType: 'website',
      body: `<div class="crumbs"><a href="/${cfg.index}">← ${esc(cfg.title)}</a></div>
<h1>Не найдено</h1><p>Возможно, запись удалили.</p>
<a class="cta" href="/${cfg.index}">${esc(cfg.title)}</a>`,
    }));
    return;
  }

  const slug = refSlug(it);
  const canonical = base + '/' + type + '/' + slug;
  const reviews = (revMap[cfg.prefix + it.id] || []).slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  const rating = ratingOf(reviews);
  const desc = it.desc ? excerpt(it.desc) : (it.name + ' — ' + cfg.one.toLowerCase() + (it.city ? ' (' + it.city + ')' : '') + '. Отзывы и рейтинг на THE GRIM TEAM.');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': cfg.schema,
    name: it.name || '',
    description: desc,
    ...(it.image ? { image: it.image } : {}),
    ...(it.city ? { address: { '@type': 'PostalAddress', addressLocality: it.city } } : {}),
    ...(/^https?:\/\//i.test(it.link || it.url || '') ? { sameAs: [it.link || it.url] } : {}),
    ...(rating ? { aggregateRating: aggregateRatingLd(rating), review: reviewsLd(reviews) } : {}),
  };

  const link = it.link || it.url || '';
  const body = `
<div class="crumbs"><a href="/">Главная</a> · <a href="/${cfg.index}">${esc(cfg.title)}</a></div>
${it.image ? `<img class="cover" src="${esc(it.image)}" alt="${esc(it.name)}">` : ''}
<article>
  <h1>${esc(it.name)}</h1>
  ${ratingLineHtml(rating)}
  <ul class="facts">
    <li><b>Тип:</b> ${esc(cfg.one)}</li>
    ${it.city ? `<li><b>Город:</b> ${esc(it.city)}</li>` : ''}
    ${/^https?:\/\//i.test(link) ? `<li><a href="${esc(link)}" rel="nofollow noopener" target="_blank">Профиль ВКонтакте →</a></li>` : ''}
  </ul>
  ${it.desc ? `<div class="body">${bodyToHtml(it.desc)}</div>` : ''}
  <h2 class="sec">Отзывы${rating ? ' · ★ ' + rating.avg.toFixed(1) : ''}</h2>
  ${reviewsHtml(reviews)}
</article>
<a class="cta" href="/">Открыть в приложении и оставить отзыв →</a>
`;
  res
    .status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=300, s-maxage=600')
    .send(page({
      title: it.name + ' — ' + cfg.one + (it.city ? ', ' + it.city : '') + ' — ' + SITE_NAME,
      desc, canonical, image: it.image || (base + '/logo.png'), ogType: 'website',
      head: `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`,
      body,
    }));
}

// ─── страница объявления барахолки (для превью ссылки в ВК/соцсетях) ──────
async function renderMarketItem(req, res, id) {
  const base = baseUrl(req);
  const appLink = 'https://vk.com/app54513499#market=' + id;
  let m = null;
  try { const doc = await dbf.collection('market').doc(id).get(); if (doc.exists) m = { id: doc.id, ...doc.data() }; } catch (e) {}

  if (!m) {
    res.status(404).set('Cache-Control', 'no-store').send(page({
      title: 'Объявление не найдено — ' + SITE_NAME, desc: DEFAULT_DESC,
      canonical: base + '/', ogType: 'website',
      body: `<h1>Объявление не найдено</h1><p>Возможно, оно уже продано или снято.</p><a class="cta" href="${appLink}">Открыть барахолку</a>`,
    }));
    return;
  }

  const price = (m.price != null && m.price !== '') ? Number(m.price).toLocaleString('ru') + ' ₽' : 'Договорная';
  const photos = marketPhotosSrv(m);
  const img = photos[0] || (base + '/logo.png');
  const desc = [price, m.city, m.desc ? excerpt(m.desc) : ''].filter(Boolean).join(' · ');
  const seller = m.authorProfile
    ? `<a href="${esc(m.authorProfile)}" rel="nofollow noopener" target="_blank">${esc(m.authorName || 'Продавец')}</a>`
    : esc(m.authorName || '');

  const body = `
${photos[0] ? `<img class="cover" src="${esc(photos[0])}" alt="${esc(m.title)}">` : ''}
<article>
  <h1>${esc(m.title)}</h1>
  <div class="rating"><b>${esc(price)}</b>${m.city ? ' · ' + esc(m.city) : ''}${m.sold ? ' · <span class="muted">Продано</span>' : ''}</div>
  ${(m.dealType && m.dealType !== 'sell' && m.exchangeFor) ? `<p>🔄 Обмен на: ${esc(m.exchangeFor)}</p>` : ''}
  ${m.desc ? `<div class="body">${bodyToHtml(m.desc)}</div>` : ''}
  ${seller ? `<p>Продавец: ${seller}</p>` : ''}
</article>
<a class="cta" href="${appLink}">Открыть в приложении →</a>
`;
  res.status(200)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Cache-Control', 'public, max-age=120, s-maxage=300')
    .send(page({
      title: m.title + ' — Барахолка — ' + SITE_NAME, desc,
      canonical: base + '/m/' + id, image: img, ogType: 'website', body,
    }));
}

// ─── sitemap.xml ─────────────────────────────────────────────────────────
async function renderSitemap(req, res) {
  const base = baseUrl(req);
  const [arts, games, orgs, clubs, masters] = await Promise.all([
    loadArticles(),
    loadGames().catch(() => []),
    loadRefCol('workshops').catch(() => []),
    loadRefCol('clubs').catch(() => []),
    loadRefCol('masters').catch(() => []),
  ]);
  const refUrls = (type, list) => list.map(it => ({
    loc: base + '/' + type + '/' + refSlug(it),
    lastmod: (it.updatedAt || it.createdAt || '').slice(0, 10),
    pri: '0.6',
  }));
  const urls = [
    { loc: base + '/', pri: '1.0' },
    { loc: base + '/games', pri: '0.9' },
    { loc: base + '/blog', pri: '0.8' },
    { loc: base + '/orgs', pri: '0.7' },
    { loc: base + '/clubs', pri: '0.7' },
    { loc: base + '/masters', pri: '0.7' },
    ...games.map(g => ({
      loc: base + '/game/' + gameSlug(g),
      lastmod: (g.updatedAt || g.startDate || g.createdAt || '').slice(0, 10),
      pri: '0.7',
    })),
    ...arts.map(a => ({
      loc: base + '/blog/' + resolveSlug(a),
      lastmod: (a.updatedAt || a.createdAt || '').slice(0, 10),
      pri: '0.7',
    })),
    ...refUrls('org', orgs),
    ...refUrls('club', clubs),
    ...refUrls('master', masters),
  ];
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u =>
      '  <url><loc>' + esc(u.loc) + '</loc>' +
      (u.lastmod ? '<lastmod>' + esc(u.lastmod) + '</lastmod>' : '') +
      '<priority>' + u.pri + '</priority></url>'
    ).join('\n') +
    '\n</urlset>\n';

  res
    .status(200)
    .set('Content-Type', 'application/xml; charset=utf-8')
    .set('Cache-Control', 'public, max-age=600, s-maxage=1200')
    .send(xml);
}

// ─── robots.txt ──────────────────────────────────────────────────────────
function renderRobots(req, res) {
  const base = baseUrl(req);
  res
    .status(200)
    .set('Content-Type', 'text/plain; charset=utf-8')
    .set('Cache-Control', 'public, max-age=3600')
    .send(
      'User-agent: *\n' +
      'Allow: /\n' +
      'Host: ' + base.replace(/^https?:\/\//, '') + '\n' +
      'Sitemap: ' + base + '/sitemap.xml\n'
    );
}

// ─── роутер ──────────────────────────────────────────────────────────────
exports.seo = onRequest({ region: 'us-central1', memory: '256MiB' }, async (req, res) => {
  try {
    const path = (req.path || '/').replace(/\/+$/, '') || '/';

    if (path === '/robots.txt') return renderRobots(req, res);
    if (path === '/sitemap.xml') return renderSitemap(req, res);
    if (path === '/blog') return renderBlogIndex(req, res);
    if (path === '/games') return renderGamesIndex(req, res);
    if (path === '/orgs') return renderRefIndex(req, res, 'org');
    if (path === '/clubs') return renderRefIndex(req, res, 'club');
    if (path === '/masters') return renderRefIndex(req, res, 'master');

    const mb = path.match(/^\/blog\/(.+)$/);
    if (mb) return renderArticle(req, res, decodeURIComponent(mb[1]));

    const mg = path.match(/^\/game\/(.+)$/);
    if (mg) return renderGame(req, res, decodeURIComponent(mg[1]));

    const mr = path.match(/^\/(org|club|master)\/(.+)$/);
    if (mr) return renderRefItem(req, res, mr[1], decodeURIComponent(mr[2]));

    const mm = path.match(/^\/m\/(.+)$/);
    if (mm) return renderMarketItem(req, res, decodeURIComponent(mm[1]));

    // Ничего не совпало — отдаём в SPA.
    res.redirect(302, '/');
  } catch (e) {
    console.error('seo function error', e);
    res.status(500).set('Cache-Control', 'no-store').send('Internal error');
  }
});

// ════════════════════════════════════════════════════════════════════════
//  ПУШ О НОВЫХ ИГРАХ. При создании документа в games рассылаем уведомление
//  на все токены из pushTokens через Expo Push API. Токены собирает
//  мобильное приложение (registerPushToken).
// ════════════════════════════════════════════════════════════════════════
function fmtGameWhen(iso) {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Yekaterinburg' });
    const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Yekaterinburg' });
    return date + ', ' + time;
  } catch (e) { return ''; }
}

async function sendExpoPush(messages) {
  // Expo принимает пачки до 100 сообщений.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) console.error('Expo push HTTP', res.status, await res.text());
    } catch (e) { console.error('Expo push error', e); }
  }
}

// Текущий час по Екатеринбургу (0–23)
function ekbHour() {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Yekaterinburg', hour: '2-digit', hour12: false }).format(new Date());
  return parseInt(h, 10) % 24;
}
// «Тихие часы»: 22:00–09:00 по ЕКБ — ночью пуши не шлём.
function isQuietHours() {
  const h = ekbHour();
  return h >= 22 || h < 9;
}

// Токены, подписанные на данную категорию. Значения по умолчанию, если поля
// в документе нет: игры — включены (старое поведение), барахолка/блог —
// выключены (подписка по желанию, чтобы не спамить существующих пользователей).
async function tokensFor(prefKey) {
  const snap = await dbf.collection('pushTokens').get();
  const def = prefKey === 'notifyGames';
  const out = [];
  snap.docs.forEach(d => {
    const t = d.data() || {};
    if (typeof t.token !== 'string' || !t.token.startsWith('ExponentPushToken')) return;
    const enabled = (t[prefKey] === undefined) ? def : !!t[prefKey];
    if (enabled) out.push(t.token);
  });
  return out;
}
async function pushToAll(prefKey, { title, body, data, channelId }) {
  const tokens = await tokensFor(prefKey);
  if (!tokens.length) return 0;
  const messages = tokens.map(to => ({
    to, sound: 'default', title, body: body || '', data: data || {}, channelId: channelId || 'games',
  }));
  await sendExpoPush(messages);
  return tokens.length;
}

// Собрать и разослать пуш «новая игра». Возвращает число адресатов.
async function pushForGame(g, gameId) {
  const when = fmtGameWhen(g.startDate || g.date);
  return pushToAll('notifyGames', {
    title: '⚔️ Новая игра: ' + g.title,
    body: when + (g.location ? ' · ' + g.location : ''),
    data: { gameId },
    channelId: 'games',
  });
}

function priceLabelSrv(p) {
  if (p == null || p === '') return 'Цена не указана';
  const n = Number(p);
  if (!isNaN(n) && n > 0) return n.toLocaleString('ru') + ' ₽';
  return String(p);
}
async function pushForMarket(m, id) {
  return pushToAll('notifyMarket', {
    title: '🛒 Барахолка: ' + m.title,
    body: (m.city ? m.city + ' · ' : '') + priceLabelSrv(m.price),
    data: { marketId: id },
    channelId: 'updates',
  });
}
async function pushForBlog(a, id) {
  return pushToAll('notifyBlog', {
    title: '📰 Новая статья',
    body: a.title,
    data: { blogId: id, slug: resolveSlug(a) },
    channelId: 'updates',
  });
}

exports.notifyNewGame = onDocumentCreated({ document: 'games/{gameId}', region: 'us-central1' }, async (event) => {
  const g = event.data && event.data.data();
  if (!g || !g.title) return;
  const gameId = event.params.gameId;

  // Не шлём для игр, добавленных задним числом (уже прошли).
  const start = new Date(g.startDate || g.date);
  if (isNaN(start) || start.getTime() < Date.now()) return;

  // Ночью не пикаем телефоны — откладываем до утра (см. sendPendingGamePushes).
  if (isQuietHours()) {
    try { await event.data.ref.update({ pushPending: true }); } catch (e) { console.error('mark pending', e); }
    console.log('notifyNewGame: quiet hours, deferred', gameId);
    return;
  }

  const n = await pushForGame(g, gameId);
  console.log('notifyNewGame: sent to', n, 'tokens');
});

// ════════════════════════════════════════════════════════════════════════
//  АВТОПОСТИНГ БАРАХОЛКИ В ГРУППУ ВК. При создании объявления публикуем его
//  на стене сообщества: фото, цена, город, ссылка в мини-апп и продавец.
// ════════════════════════════════════════════════════════════════════════
const VK_API = 'https://api.vk.com/method/';
const VK_V = '5.199';

async function vkCall(method, params, token) {
  const body = new URLSearchParams({ ...params, access_token: token, v: VK_V });
  const res = await fetch(VK_API + method, { method: 'POST', body });
  const json = await res.json();
  if (json.error) throw new Error(method + ': ' + (json.error.error_msg || 'vk error'));
  return json.response;
}

function marketPhotosSrv(m) {
  const a = String(m.photos || '').split('\n').map(x => x.trim()).filter(x => /^https?:\/\//.test(x));
  return a.length ? a : (m.image ? [m.image] : []);
}

// id группы: берём из VK_GROUP_ID, а если не задан — определяем из токена
// сообщества (community token сам «знает» свою группу). Кэшируем в инстансе.
let _resolvedGroupId = '';
async function resolveGroupId(token) {
  // 1) явный числовой id из окружения
  const manual = String(process.env.VK_GROUP_ID || '').replace(/[^0-9]/g, '');
  if (manual) return manual;
  if (_resolvedGroupId) return _resolvedGroupId;
  // 2) короткое имя группы (например VK_GROUP=tgt_ural) — для пользовательского токена
  const screen = String(process.env.VK_GROUP || '').trim().replace(/^.*\//, '');
  if (screen) {
    const r = await vkCall('utils.resolveScreenName', { screen_name: screen }, token);
    if (r && r.object_id) { _resolvedGroupId = String(r.object_id); return _resolvedGroupId; }
  }
  // 3) групповой токен «знает» свою группу (для user-токена этот шаг не сработает)
  const g = await vkCall('groups.getById', {}, token);
  const gg = Array.isArray(g) ? g[0] : (g && g.groups && g.groups[0]);
  if (!gg || !gg.id) throw new Error('cannot resolve group (set VK_GROUP or VK_GROUP_ID)');
  _resolvedGroupId = String(gg.id);
  return _resolvedGroupId;
}

// Загрузка одной фотографии на стену группы → строка attachment «photo…_…»
async function uploadWallPhoto(imageUrl, groupId, token) {
  const up = await vkCall('photos.getWallUploadServer', { group_id: groupId }, token);
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error('image fetch ' + imgRes.status);
  let ct = (imgRes.headers.get('content-type') || '').toLowerCase();
  if (!/^image\//.test(ct)) ct = 'image/jpeg'; // ВК не примет octet-stream
  const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const form = new FormData();
  form.append('photo', new Blob([buf], { type: ct }), 'photo.' + ext);
  const upRes = await fetch(up.upload_url, { method: 'POST', body: form });
  const txt = await upRes.text();
  let upJson;
  try { upJson = JSON.parse(txt); } catch (e) { throw new Error('upload resp: ' + txt.slice(0, 140)); }
  if (!upJson.photo || upJson.photo === '[]') throw new Error('upload rejected (photo=' + upJson.photo + ')');
  const saved = await vkCall('photos.saveWallPhoto',
    { group_id: groupId, photo: upJson.photo, server: upJson.server, hash: upJson.hash }, token);
  const p = saved && (Array.isArray(saved) ? saved[0] : (saved.items && saved.items[0]));
  if (!p) throw new Error('saveWallPhoto empty');
  return 'photo' + p.owner_id + '_' + p.id;
}

exports.postMarketToVk = onDocumentCreated(
  { document: 'market/{id}', region: 'us-central1', secrets: [VK_GROUP_TOKEN] },
  async (event) => {
    const token = VK_GROUP_TOKEN.value();
    if (!token) { console.log('postMarketToVk: no token, skip'); return; }

    const m = event.data && event.data.data();
    if (!m || !m.title) return;
    const id = event.params.id;

    let groupId;
    try { groupId = await resolveGroupId(token); }
    catch (e) { console.error('postMarketToVk group:', e.message); return; }

    const price = (m.price != null && m.price !== '') ? Number(m.price).toLocaleString('ru') + ' ₽' : 'Договорная';
    const digits = String(m.vkId || '').match(/\d+/);
    const seller = digits
      ? `[id${digits[0]}|${m.authorName || 'продавец'}]`
      : (m.authorProfile ? (m.authorName || 'Продавец') + ' — ' + m.authorProfile : (m.authorName || ''));
    const appLink = 'https://vk.com/app' + VK_MINIAPP_ID + '#market=' + id;

    const message = [
      '🛒 Барахолка · ' + m.title,
      '💰 ' + price,
      m.city ? '📍 ' + m.city : '',
      (m.dealType && m.dealType !== 'sell' && m.exchangeFor) ? '🔄 Обмен на: ' + m.exchangeFor : '',
      '',
      m.desc ? String(m.desc).slice(0, 400) : '',
      '',
      seller ? '👤 Продавец: ' + seller : '',
      '📲 Открыть в приложении: ' + appLink,
    ].filter(Boolean).join('\n');

    // Прикрепляем ссылку на страницу объявления — ВК подтянет фото из её
    // OG-тегов как превью (загрузка фото через API групповому токену недоступна).
    const attachments = SITE_ORIGIN + '/m/' + id;

    try {
      await vkCall('wall.post', { owner_id: '-' + groupId, from_group: 1, message, attachments }, token);
      console.log('postMarketToVk: posted', id);
    } catch (e) { console.error('postMarketToVk wall.post:', e.message); }
  }
);

// Новое объявление в барахолке → пуш подписанным (с учётом тихих часов).
exports.notifyNewMarket = onDocumentCreated({ document: 'market/{id}', region: 'us-central1' }, async (event) => {
  const m = event.data && event.data.data();
  if (!m || !m.title) return;
  const id = event.params.id;
  if (isQuietHours()) {
    try { await event.data.ref.update({ pushPending: true }); } catch (e) { console.error('mark pending', e); }
    return;
  }
  const n = await pushForMarket(m, id);
  console.log('notifyNewMarket: sent to', n, 'tokens');
});

// Новая статья блога → пуш подписанным (с учётом тихих часов).
exports.notifyNewBlog = onDocumentCreated({ document: 'blog/{id}', region: 'us-central1' }, async (event) => {
  const a = event.data && event.data.data();
  if (!a || !a.title) return;
  const id = event.params.id;
  if (isQuietHours()) {
    try { await event.data.ref.update({ pushPending: true }); } catch (e) { console.error('mark pending', e); }
    return;
  }
  const n = await pushForBlog(a, id);
  console.log('notifyNewBlog: sent to', n, 'tokens');
});

// Утренняя рассылка отложенных ночью пушей — каждый день в 09:00 по ЕКБ.
// Обрабатывает игры (только будущие), барахолку и блог.
exports.sendPendingGamePushes = onSchedule(
  { schedule: '0 9 * * *', timeZone: 'Asia/Yekaterinburg', region: 'us-central1' },
  async () => {
    const gsnap = await dbf.collection('games').where('pushPending', '==', true).get();
    for (const doc of gsnap.docs) {
      const g = doc.data() || {};
      const start = new Date(g.startDate || g.date);
      if (!isNaN(start) && start.getTime() >= Date.now() && g.title) {
        const n = await pushForGame(g, doc.id);
        console.log('pending game', doc.id, '→', n);
      }
      try { await doc.ref.update({ pushPending: false }); } catch (e) { console.error('clear pending', e); }
    }

    const msnap = await dbf.collection('market').where('pushPending', '==', true).get();
    for (const doc of msnap.docs) {
      const m = doc.data() || {};
      if (m.title) { const n = await pushForMarket(m, doc.id); console.log('pending market', doc.id, '→', n); }
      try { await doc.ref.update({ pushPending: false }); } catch (e) { console.error('clear pending', e); }
    }

    const bsnap = await dbf.collection('blog').where('pushPending', '==', true).get();
    for (const doc of bsnap.docs) {
      const a = doc.data() || {};
      if (a.title) { const n = await pushForBlog(a, doc.id); console.log('pending blog', doc.id, '→', n); }
      try { await doc.ref.update({ pushPending: false }); } catch (e) { console.error('clear pending', e); }
    }
  }
);
