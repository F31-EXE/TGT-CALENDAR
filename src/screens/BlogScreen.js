import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Image, Pressable, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { loadBlog, fmtDate, blogExcerpt } from '../api';
import { Loading, Empty, ErrorState } from '../ui';

export default function BlogScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, error: false, items: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');

  const fetch = useCallback(async () => {
    try { setState({ loading: false, error: false, items: await loadBlog() }); }
    catch (e) { setState(s => ({ ...s, loading: false, error: true })); }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState onRetry={() => { setState(s => ({ ...s, loading: true, error: false })); fetch(); }} />;

  const query = q.trim().toLowerCase();
  const items = query
    ? state.items.filter(a => (a.title || '').toLowerCase().includes(query) || (a.body || '').toLowerCase().includes(query))
    : state.items;

  const header = (
    <View style={styles.search}>
      <Ionicons name="search" size={16} color={C.textDim} />
      <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Поиск по статьям" placeholderTextColor={C.textDim} />
      {!!q && <Ionicons name="close-circle" size={18} color={C.textDim} onPress={() => setQ('')} />}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={items}
      keyExtractor={a => a.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      renderItem={({ item }) => (
        <Pressable style={styles.card} onPress={() => navigation.navigate('Article', { article: item })}>
          {item.image ? <Image source={{ uri: item.image }} style={styles.cover} /> : null}
          <View style={styles.body}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.date}>{fmtDate(item.createdAt)}</Text>
            <Text style={styles.excerpt} numberOfLines={3}>{blogExcerpt(item)}</Text>
          </View>
        </Pressable>
      )}
      ListEmptyComponent={<Empty icon="newspaper-outline" title={query ? 'Ничего не найдено' : 'Статей пока нет'} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.oliveLt} />}
    />
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 12 },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontFamily: F.mono, paddingVertical: 10 },
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden' },
  cover: { width: '100%', height: 160, backgroundColor: C.bg2 },
  body: { padding: 14 },
  title: { color: C.sand, fontSize: 18, fontFamily: F.title, textTransform: 'uppercase', letterSpacing: 0.3 },
  date: { color: C.oliveLt, fontSize: 11, fontFamily: F.mono, marginTop: 4, marginBottom: 6 },
  excerpt: { color: C.textDim, fontSize: 13, fontFamily: F.mono, lineHeight: 19 },
});
