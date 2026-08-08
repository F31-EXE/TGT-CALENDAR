import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from './theme';

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={C.oliveLt} />
    </View>
  );
}

export function Empty({ icon = 'file-tray', title = 'Пусто', text = '' }) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={44} color={C.oliveDim} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

export function ErrorState({ onRetry }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline" size={44} color={C.danger} />
      <Text style={styles.emptyTitle}>Не удалось загрузить</Text>
      <Pressable style={styles.retry} onPress={onRetry}>
        <Text style={styles.retryText}>Повторить</Text>
      </Pressable>
    </View>
  );
}

export function Tag({ label, color }) {
  return (
    <View style={[styles.tag, color && { borderColor: color }]}>
      <Text style={[styles.tagText, color && { color }]}>{label}</Text>
    </View>
  );
}

export function Badge({ label, icon, tone = 'olive' }) {
  const tones = {
    olive: { bg: 'rgba(107,124,63,0.18)', fg: C.oliveLt },
    blue: { bg: 'rgba(80,120,200,0.15)', fg: '#8fb0e0' },
    gold: { bg: 'rgba(200,160,60,0.15)', fg: '#d8b45a' },
    green: { bg: 'rgba(90,150,90,0.15)', fg: '#8fc08f' },
  };
  const t = tones[tone] || tones.olive;
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={t.fg} style={{ marginRight: 3 }} /> : null}
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  emptyTitle: { color: C.sand, fontSize: 18, fontFamily: F.title, textTransform: 'uppercase', marginTop: 12 },
  emptyText: { color: C.textDim, fontSize: 13, fontFamily: F.mono, marginTop: 6, textAlign: 'center' },
  retry: { marginTop: 16, borderWidth: 1, borderColor: C.oliveLt, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18 },
  retryText: { color: C.oliveLt, fontFamily: F.med, textTransform: 'uppercase' },
  tag: { borderWidth: 1, borderColor: C.oliveDim, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, marginRight: 5, marginBottom: 5 },
  tagText: { color: C.oliveLt, fontSize: 10, fontFamily: F.mono, textTransform: 'uppercase' },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, marginRight: 4, marginBottom: 4 },
  badgeText: { fontSize: 10, fontFamily: F.mono },
});
