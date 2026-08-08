import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Pressable } from 'react-native';
import { C, F } from '../theme';
import { recordFlag, requestAchievementCheck } from '../achievements';

// Пороги по джоулям (типовые лимиты страйкбольных полигонов)
const LIMITS = [
  { j: 1.5, label: 'Здания / CQB', color: '#4a8a8a' },
  { j: 2.4, label: 'Поле / штурмовое', color: '#6b7c3f' },
  { j: 2.9, label: 'Снайперская', color: '#a0803b' },
];

const WEIGHTS = [0.20, 0.25, 0.28, 0.30, 0.32, 0.36, 0.40, 0.43, 0.45, 0.48];

export default function ChronoScreen() {
  const [speed, setSpeed] = useState('');
  const [weight, setWeight] = useState(0.20);

  useEffect(() => { recordFlag('chrono').then(requestAchievementCheck); }, []); // ачивка «Хронометрист»

  // Скорость: заменяем запятую на точку, оставляем только цифры и одну точку
  const onSpeed = (t) => {
    let s = t.replace(',', '.').replace(/[^0-9.]/g, '');
    const i = s.indexOf('.');
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '');
    setSpeed(s);
  };

  const v = parseFloat(speed);
  const joules = useMemo(() => (!isNaN(v) && v > 0 ? (weight / 1000) * v * v / 2 : null), [v, weight]);

  const cat = joules != null ? LIMITS.find(l => joules <= l.j) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.h}>Хронограф — расчёт энергии</Text>
      <Text style={styles.hint}>Введите скорость шара и его вес — получите энергию в джоулях и категорию по лимитам.</Text>

      <Text style={styles.label}>Скорость, м/с</Text>
      <TextInput
        style={styles.input}
        value={speed}
        onChangeText={onSpeed}
        keyboardType="decimal-pad"
        placeholder="напр. 120"
        placeholderTextColor={C.textDim}
      />

      <Text style={styles.label}>Вес шара, г</Text>
      <View style={styles.weights}>
        {WEIGHTS.map(w => {
          const on = weight === w;
          return (
            <Pressable key={w} style={[styles.wchip, on && styles.wchipOn]} onPress={() => setWeight(w)}>
              <Text style={[styles.wchipText, on && styles.wchipTextOn]}>{w.toFixed(2)}</Text>
            </Pressable>
          );
        })}
      </View>

      {joules != null && (
        <View style={styles.result}>
          <Text style={styles.joules}>{joules.toFixed(2)} Дж</Text>
          {cat ? (
            <View style={[styles.catBox, { borderColor: cat.color }]}>
              <Text style={[styles.catText, { color: cat.color }]}>До {cat.j} Дж · {cat.label}</Text>
            </View>
          ) : (
            <View style={[styles.catBox, { borderColor: C.danger }]}>
              <Text style={[styles.catText, { color: C.danger }]}>Свыше 2.9 Дж — вне типовых лимитов</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.tableTitle}>Лимиты полигонов</Text>
      {LIMITS.map(l => (
        <View key={l.j} style={styles.limitRow}>
          <View style={[styles.dot, { backgroundColor: l.color }]} />
          <Text style={styles.limitJ}>{l.j} Дж</Text>
          <Text style={styles.limitLabel}>{l.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  h: { color: C.sand, fontSize: 21, fontFamily: F.title, textTransform: 'uppercase' },
  hint: { color: C.textDim, fontSize: 13, fontFamily: F.mono, marginTop: 6, marginBottom: 16, lineHeight: 19 },
  label: { color: C.oliveLt, fontSize: 12, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, color: C.text, fontSize: 18, fontFamily: F.mono, paddingHorizontal: 14, paddingVertical: 12 },
  weights: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wchip: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  wchipOn: { backgroundColor: C.olive, borderColor: C.oliveLt },
  wchipText: { color: C.textDim, fontFamily: F.mono, fontSize: 13 },
  wchipTextOn: { color: C.white },
  result: { alignItems: 'center', marginTop: 24 },
  joules: { color: C.sand, fontSize: 44, fontFamily: F.title },
  catBox: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, marginTop: 12 },
  catText: { fontSize: 14, fontFamily: F.h, textTransform: 'uppercase' },
  tableTitle: { color: C.sand, fontSize: 16, fontFamily: F.h, textTransform: 'uppercase', marginTop: 30, marginBottom: 10 },
  limitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  limitJ: { color: C.sand, fontSize: 15, fontFamily: F.h, width: 70 },
  limitLabel: { color: C.text, fontSize: 14, fontFamily: F.mono },
});
