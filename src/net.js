// Простой глобальный флаг «работаем из кэша» (нет сети). Обновляется слоем
// чтения Firestore: успех → онлайн, отдали кэш → офлайн. Экраны/баннер
// подписываются, чтобы показать плашку «показаны сохранённые данные».
let offline = false;
const subs = new Set();

export function setOffline(v) {
  if (offline === v) return;
  offline = v;
  subs.forEach(fn => { try { fn(v); } catch (e) {} });
}
export function isOffline() { return offline; }
export function subscribeOffline(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
