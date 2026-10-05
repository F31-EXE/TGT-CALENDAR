import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { getNewGamePref, setNewGameNotify, getMarketPref, setMarketNotify, getBlogPref, setBlogNotify } from '../notify';
import { cacheCount, clearCache } from '../firestore';
import { blockedCount, clearBlocks, subscribeBlocks } from '../blocks';

export default function SettingsScreen() {
  const [newGames, setNewGames] = useState(true);
  const [market, setMarket] = useState(false);
  const [blog, setBlog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cacheN, setCacheN] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [blockedN, setBlockedN] = useState(blockedCount());
  useEffect(() => subscribeBlocks(() => setBlockedN(blockedCount())), []);

  useEffect(() => {
    getNewGamePref().then(setNewGames);
    getMarketPref().then(setMarket);
    getBlogPref().then(setBlog);
    cacheCount().then(setCacheN);
  }, []);

  const onClearCache = () => {
    Alert.alert(
      'Очистить кэш?',
      'Удалятся сохранённые данные для офлайна (игры, блог, барахолка, справочники). При следующем открытии с сетью они загрузятся заново. Ваши настройки и напоминания не затрагиваются.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить', style: 'destructive', onPress: async () => {
            setClearing(true);
            await clearCache();
            setCacheN(0);
            setClearing(false);
            Alert.alert('Готово', 'Кэш очищен.');
          },
        },
      ]
    );
  };

  const wrap = (setLocal, apply) => async (val) => {
    setLocal(val);
    setBusy(true);
    await apply(val);
    setBusy(false);
  };
  const toggleGames = wrap(setNewGames, setNewGameNotify);
  const toggleMarket = wrap(setMarket, setMarketNotify);
  const toggleBlog = wrap(setBlog, setBlogNotify);

  const SwitchRow = ({ value, onValueChange }) => (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={busy}
      trackColor={{ true: C.olive, false: C.oliveDim }}
      thumbColor={C.sand}
    />
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.section}>Уведомления</Text>

      <View style={styles.row}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.label}>Новые игры</Text>
          <Text style={styles.hint}>Пуш, когда добавлена новая игра. Ночью (22:00–09:00) уведомления не приходят — придут утром.</Text>
        </View>
        <SwitchRow value={newGames} onValueChange={toggleGames} />
      </View>

      <View style={[styles.row, { marginTop: 10 }]}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.label}>Новые объявления</Text>
          <Text style={styles.hint}>Пуш о новых объявлениях в барахолке. По умолчанию выключено.</Text>
        </View>
        <SwitchRow value={market} onValueChange={toggleMarket} />
      </View>

      <View style={[styles.row, { marginTop: 10 }]}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.label}>Новые статьи</Text>
          <Text style={styles.hint}>Пуш, когда выходит новая статья в блоге. По умолчанию выключено.</Text>
        </View>
        <SwitchRow value={blog} onValueChange={toggleBlog} />
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle" size={16} color={C.oliveLt} />
        <Text style={styles.noteText}>Напоминание о конкретной игре ставится кнопкой на её странице (за 3 дня до старта) и работает независимо от этой настройки.</Text>
      </View>

      <Text style={[styles.section, { marginTop: 28 }]}>Данные</Text>
      <Pressable style={styles.row} onPress={onClearCache} disabled={clearing}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.label}>Очистить кэш</Text>
          <Text style={styles.hint}>
            {cacheN === null ? 'Офлайн-данные для работы без сети.'
              : cacheN > 0 ? `Сохранено разделов: ${cacheN}. Данные для работы без сети.`
              : 'Кэш пуст — данные подгрузятся при открытии с сетью.'}
          </Text>
        </View>
        {clearing
          ? <ActivityIndicator size="small" color={C.oliveLt} />
          : <Ionicons name="trash-outline" size={20} color={C.danger} />}
      </Pressable>

      {blockedN > 0 && (
        <Pressable style={[styles.row, { marginTop: 10 }]} onPress={() => Alert.alert(
          'Показать скрытых?', 'Отзывы и объявления скрытых пользователей снова будут видны.',
          [{ text: 'Отмена', style: 'cancel' }, { text: 'Показать', onPress: clearBlocks }]
        )}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.label}>Скрытые пользователи</Text>
            <Text style={styles.hint}>Скрыто: {blockedN}. Нажмите, чтобы снова показывать их отзывы и объявления.</Text>
          </View>
          <Ionicons name="eye-outline" size={20} color={C.oliveLt} />
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  section: { color: C.textDim, fontSize: 12, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 16 },
  label: { color: C.sand, fontSize: 16, fontFamily: F.h, textTransform: 'uppercase' },
  hint: { color: C.textDim, fontSize: 12, fontFamily: F.mono, lineHeight: 17, marginTop: 4 },
  note: { flexDirection: 'row', gap: 8, marginTop: 16, paddingHorizontal: 4 },
  noteText: { color: C.textDim, fontSize: 12, fontFamily: F.mono, lineHeight: 17, flex: 1 },
});
