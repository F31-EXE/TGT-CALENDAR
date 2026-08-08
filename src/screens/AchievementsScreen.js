import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { evaluateAchievements, TIER_COLORS } from '../achievements';
import { Loading } from '../ui';

function Glyph({ lib, name, size, color }) {
  const Set = lib === 'mci' ? MaterialCommunityIcons : Ionicons;
  return <Set name={name} size={size} color={color} />;
}

function Medallion({ a }) {
  const tc = TIER_COLORS[a.tier] || TIER_COLORS.special;
  const ring = a.unlocked ? tc.ring : C.border;
  const iconColor = a.unlocked ? tc.ring : C.textDim;
  const showBar = a.target > 1;
  const pct = Math.round((a.value / a.target) * 100);

  return (
    <View style={styles.cell}>
      <View style={[
        styles.ringOuter,
        { borderColor: ring },
        a.unlocked && { shadowColor: tc.ring, shadowOpacity: 0.6, shadowRadius: 9, shadowOffset: { width: 0, height: 0 }, elevation: 7 },
        !a.unlocked && { opacity: 0.55 },
      ]}>
        <View style={styles.ringInner}>
          <Glyph lib={a.lib} name={a.icon} size={34} color={iconColor} />
        </View>
        {a.unlocked ? (
          <View style={[styles.corner, { backgroundColor: tc.ring }]}>
            <Ionicons name="checkmark" size={13} color={C.bg2} />
          </View>
        ) : (
          <View style={styles.cornerLock}>
            <Ionicons name="lock-closed" size={11} color={C.textDim} />
          </View>
        )}
      </View>

      <Text style={[styles.title, !a.unlocked && { color: C.textDim }]} numberOfLines={1}>{a.title}</Text>
      <Text style={styles.desc} numberOfLines={2}>{a.desc}</Text>

      {showBar && (
        <View style={styles.barWrap}>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: pct + '%', backgroundColor: a.unlocked ? tc.ring : C.oliveDim }]} />
          </View>
          <Text style={styles.barText}>{a.value}/{a.target}</Text>
        </View>
      )}
    </View>
  );
}

export default function AchievementsScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await evaluateAchievements()); }
    catch (e) { setData({ list: [], unlockedCount: 0, total: 0, hasUser: false }); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!data) return <Loading />;

  const pct = data.total ? Math.round((data.unlockedCount / data.total) * 100) : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.oliveLt} />}
    >
      <View style={styles.hero}>
        {!!data.rank && (
          <View style={styles.rankChip}>
            <MaterialCommunityIcons name={data.rank.icon} size={16} color={data.rank.color} />
            <Text style={[styles.rankChipText, { color: data.rank.color }]}>{data.rank.name}</Text>
            <Text style={styles.rankChipXp}>· {data.xp} XP</Text>
          </View>
        )}
        <Text style={styles.heroNum}>{data.unlockedCount}<Text style={styles.heroTotal}> / {data.total}</Text></Text>
        <Text style={styles.heroLabel}>наград получено</Text>
        <View style={styles.heroTrack}>
          <View style={[styles.heroFill, { width: pct + '%' }]} />
        </View>
      </View>

      {!data.hasUser && (
        <View style={styles.note}>
          <Ionicons name="information-circle" size={16} color={C.oliveLt} />
          <Text style={styles.noteText}>Отметьтесь на игре («Пойду»), чтобы начать открывать награды — имя спросят один раз.</Text>
        </View>
      )}

      <View style={styles.grid}>
        {data.list.map(a => <Medallion key={a.id} a={a} />)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  hero: { alignItems: 'center', marginBottom: 18 },
  rankChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  rankChipText: { fontSize: 13, fontFamily: F.h, textTransform: 'uppercase', letterSpacing: 0.5 },
  rankChipXp: { color: C.textDim, fontSize: 12, fontFamily: F.mono },
  heroNum: { color: C.sand, fontSize: 46, fontFamily: F.title },
  heroTotal: { color: C.textDim, fontSize: 26, fontFamily: F.title },
  heroLabel: { color: C.oliveLt, fontSize: 12, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  heroTrack: { width: '70%', height: 6, borderRadius: 3, backgroundColor: C.surface, marginTop: 12, overflow: 'hidden' },
  heroFill: { height: '100%', backgroundColor: C.oliveLt },
  note: { flexDirection: 'row', gap: 8, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 16 },
  noteText: { color: C.textDim, fontSize: 12, fontFamily: F.mono, lineHeight: 17, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  cell: { width: '31%', alignItems: 'center', marginBottom: 22 },
  ringOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 2.5, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center' },
  ringInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  cornerLock: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  title: { color: C.sand, fontSize: 12, fontFamily: F.h, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 10, textAlign: 'center' },
  desc: { color: C.textDim, fontSize: 10, fontFamily: F.mono, lineHeight: 13, textAlign: 'center', marginTop: 3, minHeight: 26 },
  barWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, width: '100%', justifyContent: 'center' },
  barTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.surface, overflow: 'hidden', maxWidth: 60 },
  barFill: { height: '100%' },
  barText: { color: C.textDim, fontSize: 9, fontFamily: F.mono },
});
