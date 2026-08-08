import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';

const ITEMS = [
  { icon: 'person-circle', label: 'Мой профиль', screen: 'Profile', params: {} },
  { icon: 'walk', label: 'Новичку: с чего начать', screen: 'Guide', params: {} },
  { icon: 'checkbox', label: 'Чек-лист снаряжения', screen: 'Checklist', params: {} },
  { icon: 'people', label: 'Команды', screen: 'Ref', params: { collection: 'polygons', title: 'Команды', emptyText: 'Команд пока нет' } },
  { icon: 'construct', label: 'Мастера по ремонту', screen: 'Ref', params: { collection: 'masters', title: 'Мастера', emptyText: 'Мастеров пока нет' } },
  { icon: 'storefront', label: 'Организаторы игр', screen: 'Ref', params: { collection: 'workshops', title: 'Организаторы', emptyText: 'Организаторов пока нет' } },
  { icon: 'shield', label: 'Клубы', screen: 'Ref', params: { collection: 'clubs', title: 'Клубы', emptyText: 'Клубов пока нет' } },
  { icon: 'trophy', label: 'Достижения', screen: 'Achievements', params: {} },
  { icon: 'help-circle', label: 'Вопросы и правила', screen: 'Faq', params: {} },
  { icon: 'speedometer', label: 'Хронограф', screen: 'Chrono', params: {} },
  { icon: 'notifications', label: 'Настройки уведомлений', screen: 'Settings', params: {} },
];

export default function MoreScreen({ navigation }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
      {ITEMS.map(it => (
        <Pressable key={it.label} style={styles.row} onPress={() => navigation.navigate(it.screen, { ...it.params, title: it.params.title || it.label })}>
          <Ionicons name={it.icon} size={20} color={C.oliveLt} />
          <Text style={styles.label}>{it.label}</Text>
          <Ionicons name="chevron-forward" size={18} color={C.textDim} />
        </Pressable>
      ))}

      <Text style={styles.section}>Сообщество</Text>
      <Pressable style={styles.row} onPress={() => Linking.openURL('https://airsoft-calendar-tgt.ru/')}>
        <Ionicons name="globe" size={20} color={C.oliveLt} />
        <Text style={styles.label}>Открыть сайт</Text>
        <Ionicons name="open-outline" size={18} color={C.textDim} />
      </Pressable>
      <Pressable style={styles.row} onPress={() => Linking.openURL('https://vk.ru/saik196')}>
        <Ionicons name="logo-vk" size={20} color={C.oliveLt} />
        <Text style={styles.label}>Написать администратору</Text>
        <Ionicons name="open-outline" size={18} color={C.textDim} />
      </Pressable>

      <Text style={styles.section}>Документы</Text>
      <Pressable style={styles.row} onPress={() => Linking.openURL('https://airsoft-calendar-tgt.ru/support.html')}>
        <Ionicons name="help-buoy" size={20} color={C.oliveLt} />
        <Text style={styles.label}>Поддержка</Text>
        <Ionicons name="open-outline" size={18} color={C.textDim} />
      </Pressable>
      <Pressable style={styles.row} onPress={() => Linking.openURL('https://airsoft-calendar-tgt.ru/privacy.html')}>
        <Ionicons name="shield-checkmark" size={20} color={C.oliveLt} />
        <Text style={styles.label}>Политика конфиденциальности</Text>
        <Ionicons name="open-outline" size={18} color={C.textDim} />
      </Pressable>

      <Text style={styles.foot}>THE GRIM TEAM · Страйкбол Урала</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 10 },
  label: { color: C.sand, fontSize: 15, fontFamily: F.h, textTransform: 'uppercase', letterSpacing: 0.3, flex: 1 },
  section: { color: C.textDim, fontSize: 12, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 1, marginTop: 18, marginBottom: 10, marginLeft: 4 },
  foot: { color: C.textDim, fontSize: 12, fontFamily: F.mono, textAlign: 'center', marginTop: 24 },
});
