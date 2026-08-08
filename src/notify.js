import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setDoc, deleteDoc } from './firestore';

// Настройки категорий пушей. Игры — по умолчанию включены; барахолка и блог —
// по желанию (выключены), чтобы не спамить. Значения храним в AsyncStorage,
// а флаги — в документе токена (pushTokens), по ним рассылает Cloud Function.
const PREF = 'notifyNewGames';       // совместимость со старой настройкой игр
const PREF_MARKET = 'notifyNewMarket';
const PREF_BLOG = 'notifyNewBlog';

async function readPref(key, def) {
  try { const v = await AsyncStorage.getItem(key); return v == null ? def : v === 'on'; }
  catch (e) { return def; }
}
export async function getNewGamePref() {
  // Историческое значение хранилось как 'off'/'on'; отсутствие = включено.
  try { const v = await AsyncStorage.getItem(PREF); return v !== 'off'; } catch (e) { return true; }
}
export async function getMarketPref() { return readPref(PREF_MARKET, false); }
export async function getBlogPref() { return readPref(PREF_BLOG, false); }

async function currentPrefs() {
  return {
    notifyGames: await getNewGamePref(),
    notifyMarket: await getMarketPref(),
    notifyBlog: await getBlogPref(),
  };
}

// Храним, для каких игр стоит напоминание: { gameId: notificationId }
const RKEY = 'gameReminders';
async function readReminders() {
  try { return JSON.parse(await AsyncStorage.getItem(RKEY)) || {}; } catch (e) { return {}; }
}
async function writeReminders(m) {
  try { await AsyncStorage.setItem(RKEY, JSON.stringify(m)); } catch (e) {}
}
export async function isReminderSet(gameId) {
  const m = await readReminders();
  return !!m[gameId];
}
export async function cancelGameReminder(gameId) {
  const m = await readReminders();
  const v = m[gameId];
  const ids = Array.isArray(v) ? v : (v ? [v] : []); // совместимость со старым форматом
  for (const id of ids) { try { await Notifications.cancelScheduledNotificationAsync(id); } catch (e) {} }
  delete m[gameId];
  await writeReminders(m);
  return true;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensurePermissions() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('games', {
      name: 'Игры и напоминания',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6b7c3f',
    });
    await Notifications.setNotificationChannelAsync('updates', {
      name: 'Барахолка и блог',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#6b7c3f',
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

// Регистрируем устройство для серверных пушей: получаем Expo push token и
// сохраняем его в Firestore (коллекция pushTokens). Cloud Function рассылает
// по этим токенам уведомления о новых играх. Всё best-effort — если нет
// разрешения/projectId/симулятор, просто тихо выходим.
async function getExpoToken() {
  if (!Device.isDevice) return null;
  const ok = await ensurePermissions();
  if (!ok) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) return null;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  return token || null;
}

export async function registerPushToken() {
  try {
    const prefs = await currentPrefs();
    // Если пользователь отключил все категории — снимаем токен целиком.
    if (!prefs.notifyGames && !prefs.notifyMarket && !prefs.notifyBlog) {
      await unregisterPushToken();
      return null;
    }
    const token = await getExpoToken();
    if (!token) return null;
    const id = token.replace(/[^\w-]/g, '_');
    // PATCH перезаписывает документ целиком — пишем токен и все флаги сразу.
    await setDoc('pushTokens', id, {
      token, platform: Platform.OS, updatedAt: new Date().toISOString(),
      notifyGames: prefs.notifyGames, notifyMarket: prefs.notifyMarket, notifyBlog: prefs.notifyBlog,
    });
    return token;
  } catch (e) {
    return null;
  }
}

export async function unregisterPushToken() {
  try {
    const token = await getExpoToken();
    if (!token) return;
    const id = token.replace(/[^\w-]/g, '_');
    await deleteDoc('pushTokens', id);
  } catch (e) {}
}

// Вкл/выкл категории пушей: сохраняем настройку и пересобираем токен
// (перезапись флагов или удаление, если всё выключено).
export async function setNewGameNotify(on) {
  try { await AsyncStorage.setItem(PREF, on ? 'on' : 'off'); } catch (e) {}
  await registerPushToken();
}
export async function setMarketNotify(on) {
  try { await AsyncStorage.setItem(PREF_MARKET, on ? 'on' : 'off'); } catch (e) {}
  await registerPushToken();
}
export async function setBlogNotify(on) {
  try { await AsyncStorage.setItem(PREF_BLOG, on ? 'on' : 'off'); } catch (e) {}
  await registerPushToken();
}

// Локальное напоминание об игре. За 3 дня до старта в 10:00; если игра ближе —
// за сутки в 10:00; ещё ближе — за 3 часа. Дневное время, чтобы не будить ночью.
function atHour(d, h) { const x = new Date(d); x.setHours(h, 0, 0, 0); return x; }

export async function scheduleGameReminder(game) {
  const ok = await ensurePermissions();
  if (!ok) return { ok: false, reason: 'denied' };

  const start = new Date(game.startDate || game.date);
  if (isNaN(start)) return { ok: false, reason: 'nodate' };

  const now = Date.now();
  let fireDate = atHour(new Date(start.getTime() - 3 * 86400000), 10);
  if (fireDate.getTime() <= now) fireDate = atHour(new Date(start.getTime() - 86400000), 10);
  if (fireDate.getTime() <= now) fireDate = new Date(start.getTime() - 3 * 3600 * 1000);
  if (fireDate.getTime() <= now) return { ok: false, reason: 'toolate' };

  // Защита от дублей: снимаем всё, что уже стояло на эту игру, и ставим заново.
  await cancelGameReminder(game.id);

  const ids = [];
  const mainId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚔️ Скоро игра: ' + (game.title || ''),
      body: (game.location ? game.location + ' · ' : '') + 'Не забудь снаряжение!',
      data: { gameId: game.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
  });
  ids.push(mainId);

  // «Собери рюкзак» — вечером накануне в 18:00, если это время ещё впереди.
  const packDate = atHour(new Date(start.getTime() - 86400000), 18);
  if (packDate.getTime() > now && packDate.getTime() !== fireDate.getTime()) {
    try {
      const packId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎒 Завтра игра — собери рюкзак',
          body: (game.title || '') + ' · открой чек-лист снаряжения',
          data: { gameId: game.id, screen: 'checklist' },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: packDate },
      });
      ids.push(packId);
    } catch (e) {}
  }

  const m = await readReminders();
  m[game.id] = ids;
  await writeReminders(m);
  return { ok: true, ids, fireDate };
}
