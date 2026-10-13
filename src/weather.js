import { EKB_TZ } from './theme';

// Прогноз погоды на время игры — Open-Meteo (бесплатно, без ключа).
// Прогноз есть на 16 дней вперёд; дальше — статус 'far'.
const API = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 16;
const EKB = { lat: 56.8389, lng: 60.6057 }; // если у игры нет координат полигона
const TTL = 30 * 60 * 1000;
const cache = new Map();

// WMO weather code → подпись и иконка Ionicons
export function weatherLabel(code) {
  if (code === 0) return { text: 'Ясно', icon: 'sunny' };
  if (code === 1) return { text: 'Преимущественно ясно', icon: 'partly-sunny' };
  if (code === 2) return { text: 'Переменная облачность', icon: 'partly-sunny' };
  if (code === 3) return { text: 'Пасмурно', icon: 'cloudy' };
  if (code === 45 || code === 48) return { text: 'Туман', icon: 'cloudy' };
  if (code >= 51 && code <= 57) return { text: 'Морось', icon: 'rainy' };
  if (code === 61) return { text: 'Небольшой дождь', icon: 'rainy' };
  if (code === 63) return { text: 'Дождь', icon: 'rainy' };
  if (code === 65) return { text: 'Сильный дождь', icon: 'rainy' };
  if (code === 66 || code === 67) return { text: 'Ледяной дождь', icon: 'rainy' };
  if (code >= 71 && code <= 77) return { text: 'Снег', icon: 'snow' };
  if (code >= 80 && code <= 82) return { text: 'Ливень', icon: 'rainy' };
  if (code === 85 || code === 86) return { text: 'Снегопад', icon: 'snow' };
  if (code >= 95) return { text: 'Гроза', icon: 'thunderstorm' };
  return { text: '', icon: 'cloud' };
}

// Короткий совет по погоде (или '')
export function weatherTip(w) {
  if (w.code >= 95) return 'Гроза — следите за объявлениями организатора';
  if (w.precipProb >= 60) return 'Вероятен дождь — возьмите дождевик и сменную одежду';
  if (w.temp <= 0) return 'Мороз — термобельё, перчатки и запасные аккумуляторы в тепле';
  if (w.temp <= 7) return 'Прохладно — оденьтесь потеплее';
  if (w.temp >= 27) return 'Жара — возьмите больше воды';
  if (w.wind >= 10) return 'Сильный ветер — учтите при стрельбе на дистанции';
  return '';
}

function ekbParts(date) {
  const day = date.toLocaleDateString('en-CA', { timeZone: EKB_TZ }); // YYYY-MM-DD
  const hour = date.toLocaleTimeString('en-GB', { hour: '2-digit', hour12: false, timeZone: EKB_TZ }).slice(0, 2);
  return { day, key: `${day}T${hour === '24' ? '00' : hour}:00` };
}

// Разбор ответа Open-Meteo: погода в час начала игры + мин/макс за день.
export function parseForecast(data, start) {
  const h = data && data.hourly;
  if (!h || !Array.isArray(h.time)) return null;
  const { key } = ekbParts(start);
  let i = h.time.indexOf(key);
  if (i < 0) i = 0;
  const d = data.daily || {};
  return {
    temp: Math.round(h.temperature_2m[i]),
    precipProb: h.precipitation_probability ? (h.precipitation_probability[i] ?? 0) : 0,
    wind: Math.round(h.wind_speed_10m[i]),
    gust: h.wind_gusts_10m ? Math.round(h.wind_gusts_10m[i]) : null,
    code: h.weather_code[i],
    tmin: d.temperature_2m_min ? Math.round(d.temperature_2m_min[0]) : null,
    tmax: d.temperature_2m_max ? Math.round(d.temperature_2m_max[0]) : null,
  };
}

// Возвращает { status: 'ok', weather, approx } | { status: 'far' } | { status: 'past' }.
// approx — координат полигона нет, прогноз по Екатеринбургу.
export async function loadGameWeather(game) {
  const start = new Date(game.startDate || game.date);
  if (isNaN(start)) return { status: 'past' };
  const now = Date.now();
  if (start.getTime() < now - 3 * 3600 * 1000) return { status: 'past' };
  if (start.getTime() > now + (FORECAST_DAYS - 1) * 86400000) return { status: 'far' };

  const hasPt = typeof game.lat === 'number' && typeof game.lng === 'number' && !isNaN(game.lat) && !isNaN(game.lng);
  const pt = hasPt ? { lat: game.lat, lng: game.lng } : EKB;
  const { day } = ekbParts(start);
  const ck = `${pt.lat.toFixed(3)},${pt.lng.toFixed(3)},${day}`;
  const hit = cache.get(ck);
  let data = hit && now - hit.at < TTL ? hit.data : null;
  if (!data) {
    const url = `${API}?latitude=${pt.lat}&longitude=${pt.lng}`
      + '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m'
      + '&daily=temperature_2m_max,temperature_2m_min'
      + `&wind_speed_unit=ms&timezone=${encodeURIComponent(EKB_TZ)}&start_date=${day}&end_date=${day}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
    cache.set(ck, { at: now, data });
  }
  const weather = parseForecast(data, start);
  if (!weather) throw new Error('bad forecast');
  return { status: 'ok', weather, approx: !hasPt };
}
