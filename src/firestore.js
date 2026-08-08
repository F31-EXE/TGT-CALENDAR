// Тот же бэкенд, что и у веб-версии: Firestore REST API (чтение открыто
// правилами). Пишущие операции (участие, барахолка) добавим на этапе с
// авторизацией — сейчас приложение читает данные.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { setOffline } from './net';

const PROJECT = 'strikeball-calendar';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

// Кэш последних успешных чтений — чтобы приложение открывалось без сети.
const CACHE_PREFIX = 'cache_v1_';

function parseVal(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(parseVal);
  if (v.mapValue !== undefined) {
    const o = {};
    for (const [k, vv] of Object.entries(v.mapValue.fields || {})) o[k] = parseVal(vv);
    return o;
  }
  return null;
}

function parseDoc(doc) {
  const id = doc.name.split('/').pop();
  const o = { id };
  for (const [k, v] of Object.entries(doc.fields || {})) o[k] = parseVal(v);
  return o;
}

export async function getCollection(col) {
  try {
    let docs = [];
    let pageToken = '';
    do {
      let url = `${BASE}/${col}?pageSize=300`;
      if (pageToken) url += '&pageToken=' + encodeURIComponent(pageToken);
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      docs = docs.concat((data.documents || []).map(parseDoc));
      pageToken = data.nextPageToken || '';
    } while (pageToken);
    // Успех — сохраняем в кэш и помечаем «онлайн».
    setOffline(false);
    try { await AsyncStorage.setItem(CACHE_PREFIX + col, JSON.stringify(docs)); } catch (e) {}
    return docs;
  } catch (err) {
    // Нет сети/ошибка — отдаём последнее сохранённое, если оно есть.
    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + col);
      if (raw) {
        const docs = JSON.parse(raw);
        if (Array.isArray(docs)) { setOffline(true); return docs; }
      }
    } catch (e) {}
    throw err;
  }
}

// ── Запись (правила Firestore разрешают эти коллекции) ──
function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) fields[k] = { nullValue: null };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number' && Number.isInteger(v)) fields[k] = { integerValue: String(v) };
    else if (typeof v === 'number') fields[k] = { doubleValue: v };
    else fields[k] = { stringValue: String(v) };
  }
  return fields;
}

// Создать/перезаписать документ с заданным id (PATCH).
export async function setDoc(col, id, data) {
  const url = `${BASE}/${col}/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return parseDoc(await res.json());
}

// Добавить документ с автогенерируемым id.
export async function addDoc(col, data) {
  const res = await fetch(`${BASE}/${col}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return parseDoc(await res.json());
}

export async function deleteDoc(col, id) {
  const res = await fetch(`${BASE}/${col}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
}

// ── Управление офлайн-кэшем ──
export async function cacheCount() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(k => k.startsWith(CACHE_PREFIX)).length;
  } catch (e) { return 0; }
}
export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const mine = keys.filter(k => k.startsWith(CACHE_PREFIX));
    if (mine.length) await AsyncStorage.multiRemove(mine);
    return mine.length;
  } catch (e) { return 0; }
}
