import { Platform } from 'react-native';

// Приложения VK ID (id.vk.ru): свой client_id на каждую платформу.
// Android — 54697161, iOS — 54697162 (твои приложения VK ID).
// В каждом приложении VK ID (вкладка «Авторизация») должны быть заданы:
//   • Доверенный redirect (Trusted redirect URL): grimteam://vkid
//   • Android: пакет ru.thegrimteam.calendar + отпечаток SHA-256
//   • iOS: bundle ru.thegrimteam.calendar
const CLIENT_IDS = { android: '54697161', ios: '54697162' };
const clientId = CLIENT_IDS[Platform.OS] || CLIENT_IDS.android;

// VK ID для мобильных приложений сам выводит redirect из ID приложения по
// схеме vk<ID>://vk.com/blank.html (проверка — пакет/bundle + SHA-256), поэтому
// отдельного поля redirect в консоли нет. Схема регистрируется в app.json.
export const VKID = {
  clientId,
  redirect: `vk${clientId}://vk.com/blank.html`,
  scope: 'vkid.personal_info',             // имя, аватар
  authorize: 'https://id.vk.com/authorize',
  token: 'https://id.vk.com/oauth2/auth',
  userInfo: 'https://id.vk.com/oauth2/user_info',
};

export function vkidConfigured() {
  return /^\d+$/.test(String(VKID.clientId));
}
