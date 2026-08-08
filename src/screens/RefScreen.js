import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Image, Pressable, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { loadRef, loadRefReviews, reviewsForSubject, reviewStats, refSubjectKey } from '../api';
import { Loading, Empty, ErrorState } from '../ui';

const GOLD = '#d8b45a';

function MiniStars({ value }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons key={i} name={i <= Math.round(value) ? 'star' : 'star-outline'} size={12} color={i <= Math.round(value) ? GOLD : C.textDim} />
      ))}
    </View>
  );
}

export default function RefScreen({ route, navigation }) {
  const { collection, emptyText } = route.params;
  const [state, setState] = useState({ loading: true, error: false, items: [], stats: {} });
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState('');

  const fetch = useCallback(async () => {
    try {
      const [items, allReviews] = await Promise.all([loadRef(collection), loadRefReviews()]);
      const stats = {};
      items.forEach(it => { stats[it.id] = reviewStats(reviewsForSubject(allReviews, refSubjectKey(collection, it.id))); });
      // Выше рейтинг → выше; при равенстве — больше отзывов; без отзывов — по имени
      const sorted = [...items].sort((a, b) => {
        const sa = stats[a.id], sb = stats[b.id];
        return (sb.avg - sa.avg) || (sb.count - sa.count) || String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      });
      setState({ loading: false, error: false, items: sorted, stats });
    } catch (e) { setState(s => ({ ...s, loading: false, error: true })); }
  }, [collection]);
  useEffect(() => { fetch(); }, [fetch]);
  // Пересчитать рейтинги при возврате с детальной карточки (мог появиться отзыв)
  useEffect(() => navigation.addListener('focus', () => { fetch(); }), [navigation, fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState onRetry={() => { setState(s => ({ ...s, loading: true, error: false })); fetch(); }} />;

  const cities = [...new Set(state.items.map(i => (i.city || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  const items = city ? state.items.filter(i => (i.city || '').trim() === city) : state.items;

  const header = cities.length > 1 ? (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={[{ k: '', name: 'Все города' }, ...cities.map(c => ({ k: c, name: c }))]}
      keyExtractor={c => c.k || 'all'}
      style={{ marginBottom: 10 }}
      contentContainerStyle={{ gap: 6 }}
      renderItem={({ item }) => (
        <Pressable style={[styles.chip, city === item.k && styles.chipOn]} onPress={() => setCity(item.k)}>
          <Text style={[styles.chipText, city === item.k && styles.chipTextOn]}>{item.name}</Text>
        </Pressable>
      )}
    />
  ) : null;

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={items}
      keyExtractor={i => i.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      renderItem={({ item }) => {
        const st = state.stats[item.id] || { avg: 0, count: 0 };
        return (
          <Pressable style={styles.card} onPress={() => navigation.navigate('RefDetail', { item, collection, title: item.name })}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.img} /> : null}
            <View style={styles.body}>
              <Text style={styles.name}>{item.name}</Text>
              {!!item.city && <View style={styles.metaRow}><Ionicons name="location" size={12} color={C.oliveLt} /><Text style={styles.city}>{item.city}</Text></View>}
              <View style={styles.ratingRow}>
                <MiniStars value={st.avg} />
                {st.count > 0
                  ? <Text style={styles.ratingText}>{st.avg.toFixed(1)} · {st.count} {plural(st.count, 'отзыв', 'отзыва', 'отзывов')}</Text>
                  : <Text style={styles.ratingNone}>нет отзывов</Text>}
              </View>
              {!!item.desc && <Text style={styles.desc} numberOfLines={3}>{item.desc}</Text>}
              <View style={styles.openHint}>
                <Ionicons name="chatbubbles-outline" size={13} color={C.oliveLt} />
                <Text style={styles.openHintText}>Открыть · отзывы</Text>
                <Ionicons name="chevron-forward" size={14} color={C.textDim} style={{ marginLeft: 'auto' }} />
              </View>
            </View>
          </Pressable>
        );
      }}
      ListEmptyComponent={<Empty icon="people-outline" title={city ? 'В этом городе пусто' : (emptyText || 'Пусто')} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.oliveLt} />}
    />
  );
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

const styles = StyleSheet.create({
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.surface },
  chipOn: { backgroundColor: C.olive, borderColor: C.oliveLt },
  chipText: { color: C.textDim, fontSize: 12, fontFamily: F.mono },
  chipTextOn: { color: C.white },
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden' },
  img: { width: '100%', height: 150, backgroundColor: C.bg2 },
  body: { padding: 14 },
  name: { color: C.sand, fontSize: 18, fontFamily: F.title, textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  city: { color: C.textDim, fontSize: 12, fontFamily: F.mono },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  ratingText: { color: C.sand, fontSize: 12, fontFamily: F.mono },
  ratingNone: { color: C.textDim, fontSize: 12, fontFamily: F.mono },
  desc: { color: C.text, fontSize: 14, fontFamily: F.mono, lineHeight: 20, marginTop: 8 },
  openHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  openHintText: { color: C.oliveLt, fontSize: 11, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 0.5 },
});
