import React, { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';
import * as AppleAuthentication from 'expo-apple-authentication';
import { getUser, setVkUser, setAppleUser, isLinked } from '../identity';
import { loginWithVk } from '../vkAuth';
import { loginWithApple, appleAvailable } from '../appleAuth';
import { vkidConfigured } from '../vkid.config';

const KEY = 'login_prompt_shown';

export default function LoginPromptModal() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasApple, setHasApple] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!vkidConfigured()) return;                       // ВК-вход не настроен — не предлагаем
        const seenWelcome = await AsyncStorage.getItem('seen_welcome');
        if (!seenWelcome) return;                            // не мешаем онбордингу на 1-м запуске
        if (await AsyncStorage.getItem(KEY)) return;         // уже предлагали
        const u = await getUser();
        if (isLinked(u)) return;                             // уже вошёл через ВК/Apple
        setHasApple(await appleAvailable());
        setTimeout(() => { if (alive) setShow(true); }, 900);
      } catch (e) {}
    })();
    return () => { alive = false; };
  }, []);

  const close = (remember = true) => {
    if (remember) AsyncStorage.setItem(KEY, '1').catch(() => {});
    setShow(false);
  };
  const onLogin = async () => {
    setBusy(true);
    const r = await loginWithVk();
    setBusy(false);
    if (r.ok) { await setVkUser(r.profile); close(); }
    else if (r.reason !== 'cancel') Alert.alert('Вход через ВК', 'Не получилось войти. Попробуйте позже в профиле.');
  };

  const onApple = async () => {
    const r = await loginWithApple();
    if (r.ok) { await setAppleUser(r.profile); close(); }
    else if (r.reason !== 'cancel') Alert.alert('Вход через Apple', 'Не получилось войти. Попробуйте позже в профиле.');
  };

  if (!show) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => close()}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badge}><Ionicons name="logo-vk" size={30} color="#4a76a8" /></View>
          <Text style={styles.title}>{hasApple ? 'Войти в профиль' : 'Войти через ВКонтакте'}</Text>
          <Text style={styles.text}>Подтянем имя и аватар, а отметки «Пойду» и отзывы станут общими с сайтом и мини-аппом. Можно и без входа.</Text>
          {hasApple && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={10}
              style={styles.apple}
              onPress={onApple}
            />
          )}
          <Pressable style={[styles.btn, styles.primary, busy && { opacity: 0.6 }]} onPress={onLogin} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color={C.white} /> : <Ionicons name="logo-vk" size={17} color={C.white} />}
            <Text style={styles.primaryText}>Войти через ВК</Text>
          </Pressable>
          <Pressable style={styles.ghost} onPress={() => close()}>
            <Text style={styles.ghostText}>Позже</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, backgroundColor: C.bg2, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: 'center' },
  badge: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#4a76a8', backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: C.sand, fontSize: 19, fontFamily: F.title, textTransform: 'uppercase', textAlign: 'center' },
  text: { color: C.text, fontSize: 14, fontFamily: F.mono, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 13, width: '100%', marginTop: 16 },
  apple: { width: '100%', height: 48, marginTop: 16 },
  primary: { backgroundColor: '#4a76a8' },
  primaryText: { color: C.white, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  ghost: { paddingVertical: 10, marginTop: 4 },
  ghostText: { color: C.textDim, fontFamily: F.mono, fontSize: 13 },
});
