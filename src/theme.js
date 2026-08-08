// Военная палитра — как в вебе (олива/хаки/песок).
export const C = {
  bg: '#20241a',
  bg2: '#191c13',
  surface: '#262b1c',
  olive: '#6b7c3f',
  oliveLt: '#8fa44f',
  oliveDim: '#4a5628',
  sand: '#e8ddb0',
  text: '#d8d0b0',
  textDim: '#8a8570',
  danger: '#c0392b',
  border: 'rgba(107,124,63,0.35)',
  white: '#ffffff',
};

// Шрифты как на сайте: Oswald (заголовки) + Share Tech Mono (текст/мета).
export const F = {
  title: 'Oswald_700Bold',
  h: 'Oswald_600SemiBold',
  med: 'Oswald_500Medium',
  mono: 'ShareTechMono_400Regular',
};

export const EKB_TZ = 'Asia/Yekaterinburg';

// Теги игр и их цвета (как в вебе)
export const TAG_COLORS = {
  'Ночная': '#3b5aa0',
  'Сценарная': '#7a4aa0',
  'Тренировка': '#4a7a4a',
  'CQB': '#a05a3b',
  'Для новичков': '#4a8a8a',
};

export const MARKET_CATS = [
  { key: 'privod', name: 'Приводы', icon: 'restaurant' },
  { key: 'magazin', name: 'Магазины', icon: 'albums' },
  { key: 'zashchita', name: 'Защита', icon: 'shield' },
  { key: 'ekip', name: 'Экип', icon: 'shirt' },
  { key: 'piro', name: 'Пиротехника', icon: 'flame' },
  { key: 'drugoe', name: 'Другое', icon: 'cube' },
];
export function marketCatName(k) { const c = MARKET_CATS.find(x => x.key === k); return c ? c.name : ''; }
