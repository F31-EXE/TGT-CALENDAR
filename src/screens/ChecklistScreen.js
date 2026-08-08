import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';

const KEY = 'gear_checklist';

const GROUPS = [
  { title: 'Обязательное', items: ['Защита глаз (очки/маска)', 'Привод', 'Шары', 'Заряженный аккумулятор / газ', 'Красная повязка 50×50'] },
  { title: 'Экипировка', items: ['Форма по погоде', 'Крепкая обувь', 'Разгрузка / подсумки', 'Перчатки', 'Головной убор / кавер'] },
  { title: 'Расходники и питание', items: ['Запасные магазины', 'Зарядное устройство', 'Вода', 'Перекус', 'Влажные салфетки'] },
  { title: 'Полезное', items: ['Аптечка', 'Сменная одежда', 'Пауэрбанк', 'Средство от клещей', 'Мусорный пакет'] },
];

export default function ChecklistScreen() {
  const [checked, setChecked] = useState({});

  useEffect(() => {
    (async () => {
      try { const raw = await AsyncStorage.getItem(KEY); if (raw) setChecked(JSON.parse(raw)); } catch (e) {}
    })();
  }, []);

  const persist = (next) => {
    setChecked(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  };
  const toggle = (item) => persist({ ...checked, [item]: !checked[item] });
  const reset = () => persist({});

  const all = GROUPS.flatMap(g => g.items);
  const done = all.filter(i => checked[i]).length;
  const pct = Math.round((done / all.length) * 100);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.head}>
        <Text style={styles.h}>Чек-лист снаряжения</Text>
        <Text style={styles.count}>{done}/{all.length}</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: pct + '%' }]} /></View>
      <Text style={styles.hint}>Отметь, что уже в рюкзаке. Список сохраняется — вернёшься перед следующей игрой.</Text>

      {GROUPS.map(g => (
        <View key={g.title} style={styles.group}>
          <Text style={styles.groupTitle}>{g.title}</Text>
          {g.items.map(item => {
            const on = !!checked[item];
            return (
              <Pressable key={item} style={styles.row} onPress={() => toggle(item)}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? C.oliveLt : C.textDim} />
                <Text style={[styles.item, on && styles.itemOn]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      <Pressable style={styles.reset} onPress={reset}>
        <Ionicons name="refresh" size={16} color={C.textDim} />
        <Text style={styles.resetText}>Сбросить всё</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  h: { color: C.sand, fontSize: 21, fontFamily: F.title, textTransform: 'uppercase' },
  count: { color: C.oliveLt, fontSize: 18, fontFamily: F.title },
  track: { height: 8, borderRadius: 4, backgroundColor: C.surface, marginTop: 10, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.oliveLt },
  hint: { color: C.textDim, fontSize: 12, fontFamily: F.mono, marginTop: 8, marginBottom: 14, lineHeight: 17 },
  group: { marginBottom: 14 },
  groupTitle: { color: C.oliveLt, fontSize: 12, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8 },
  item: { color: C.text, fontSize: 15, fontFamily: F.mono, flex: 1 },
  itemOn: { color: C.textDim, textDecorationLine: 'line-through' },
  reset: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 4 },
  resetText: { color: C.textDim, fontSize: 13, fontFamily: F.mono },
});
