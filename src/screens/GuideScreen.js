import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';

const SECTIONS = [
  {
    icon: 'help-buoy',
    title: 'Что такое страйкбол',
    body: 'Военно-тактическая командная игра: воспроизводят боевые действия с приводами, которые стреляют пластиковыми шарами 6 мм. Дульная энергия ниже 3 Дж — по закону это не оружие. Главное — честность (сам себя «убил» при попадании) и безопасность.',
  },
  {
    icon: 'walk',
    title: 'С чего начать',
    body: '1. Не спеши покупать. Приди на игру гостем или возьми привод в аренду — многие организаторы дают.\n2. Выбери ближайшую игру во вкладке «Игры», нажми «Пойду».\n3. Напиши организатору (кнопка в игре / раздел «Организаторы») — уточни, нужна ли аренда и что взять.\n4. Приезжай, слушай брифинг, играй.',
  },
  {
    icon: 'shield-checkmark',
    title: 'Минимальный набор',
    body: '• Защита глаз — очки или маска (ОБЯЗАТЕЛЬНО, весь полигон).\n• Привод + шары + заряженный аккумулятор/газ.\n• Красная тряпка/повязка 50×50 см — обозначить, что ты «убит».\n• Удобная одежда по погоде и крепкая обувь.\n• Вода и перекус.\nОстальное (разгрузка, форма, рация) — по мере втягивания.',
  },
  {
    icon: 'warning',
    title: 'Безопасность',
    body: '• Очки/маску не снимать на игровой зоне никогда.\n• В «мертвяке» и вне игры — привод на предохранитель, магазин отсоединён.\n• Стреляй по правилам полигона по дистанции и лимиту скорости.\n• Попал — подними руку, надень красную повязку, спокойно иди в мертвяк.\n• Алкоголь и игра несовместимы.',
  },
  {
    icon: 'speedometer',
    title: 'Скорость и лимиты',
    body: 'Мощность считают в джоулях. Открой раздел «Хронограф» в приложении — введи скорость и вес шара, увидишь энергию и к какой категории относится привод (CQB, штурм, DMR, снайпер). На игре привод замеряют перед выходом.',
  },
];

export default function GuideScreen({ navigation }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.h}>Новичку — с чего начать</Text>
      <Text style={styles.sub}>Короткий гайд, чтобы уверенно приехать на первую игру.</Text>

      {SECTIONS.map(s => (
        <View key={s.title} style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name={s.icon} size={18} color={C.oliveLt} />
            <Text style={styles.cardTitle}>{s.title}</Text>
          </View>
          <Text style={styles.body}>{s.body}</Text>
        </View>
      ))}

      <Pressable style={styles.cta} onPress={() => navigation.navigate('Checklist')}>
        <Ionicons name="checkbox" size={17} color={C.white} />
        <Text style={styles.ctaText}>Открыть чек-лист снаряжения</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  h: { color: C.sand, fontSize: 23, fontFamily: F.title, textTransform: 'uppercase' },
  sub: { color: C.textDim, fontSize: 13, fontFamily: F.mono, marginTop: 6, marginBottom: 16, lineHeight: 19 },
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { color: C.sand, fontSize: 15, fontFamily: F.h, textTransform: 'uppercase', letterSpacing: 0.3, flex: 1 },
  body: { color: C.text, fontSize: 14, fontFamily: F.mono, lineHeight: 21 },
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.olive, borderRadius: 10, paddingVertical: 14, marginTop: 6 },
  ctaText: { color: C.white, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
});
