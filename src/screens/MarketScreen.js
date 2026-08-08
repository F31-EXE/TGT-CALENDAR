import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Image, Pressable, StyleSheet, RefreshControl, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, MARKET_CATS, marketCatName } from '../theme';
import { loadMarket, priceLabel, parsePhotos } from '../api';
import { isFav, toggleFav, subscribeFavs } from '../favorites';
import { Loading, Empty, ErrorState, Badge } from '../ui';

function Card({ m, fav, onPress }) {
  const photos = parsePhotos(m);
  const cover = photos[0];
  return (
    <Pressable style={[styles.card, m.sold && { opacity: 0.6 }]} onPress={onPress}>
      {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : <View style={[styles.cover, styles.noCover]}><Ionicons name="image" size={30} color={C.oliveDim} /></View>}
      {photos.length > 1 ? <View style={styles.count}><Ionicons name="images" size={12} color={C.white} /><Text style={styles.countText}>{photos.length}</Text></View> : null}
      <Pressable style={styles.favBtn} hitSlop={8} onPress={() => toggleFav(m.id)}>
        <Ionicons name={fav ? 'heart' : 'heart-outline'} size={20} color={fav ? C.danger : C.white} />
      </Pressable>
      <View style={styles.body}>
        <Text style={styles.price}>{m.sold ? 'ПРОДАНО' : priceLabel(m.price)}</Text>
        <Text style={styles.title}>{m.title}</Text>
        <View style={styles.badges}>
          {!!m.category && <Badge label={marketCatName(m.category)} tone="olive" />}
          {(m.dealType === 'exchange' || m.dealType === 'both') && <Badge label="Обмен" icon="swap-horizontal" tone="blue" />}
          {!!m.bargain && <Badge label="Торг" icon="chatbubbles" tone="gold" />}
          {!!m.shipping && <Badge label="Пересыл" icon="cube" tone="green" />}
        </View>
        {!!m.city && <View style={styles.metaRow}><Ionicons name="location" size={12} color={C.oliveLt} /><Text style={styles.city}>{m.city}</Text></View>}
        {(m.dealType && m.dealType !== 'sell' && m.exchangeFor) ? <Text style={styles.exchange}>Меняю на: {m.exchangeFor}</Text> : null}
        {!!m.desc && <Text style={styles.desc} numberOfLines={3}>{m.desc}</Text>}
        <View style={styles.sellerRow}>
          {m.authorAvatar ? <Image source={{ uri: m.authorAvatar }} style={styles.avatar} /> : null}
          <Text style={styles.seller}>{m.authorName || 'Аноним'}</Text>
          <Text style={styles.more}>Подробнее →</Text>
        </View>
      </View>
    </Pressable>
  );
}

const SORTS = [
  { key: 'new', label: 'Новые' },
  { key: 'cheap', label: 'Дешевле' },
  { key: 'exp', label: 'Дороже' },
];

export default function MarketScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, error: false, items: [] });
  const [cat, setCat] = useState('');
  const [shipOnly, setShipOnly] = useState(false);
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState('new');
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [, bump] = useState(0);

  const fetch = useCallback(async () => {
    try { setState({ loading: false, error: false, items: await loadMarket() }); }
    catch (e) { setState(s => ({ ...s, loading: false, error: true })); }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => subscribeFavs(() => bump(v => v + 1)), []);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState onRetry={() => { setState(s => ({ ...s, loading: true, error: false })); fetch(); }} />;

  const query = q.trim().toLowerCase();
  let items = state.items.filter(m => {
    if (favOnly && !isFav(m.id)) return false;
    if (cat && (m.category || '') !== cat) return false;
    if (shipOnly && !m.shipping) return false;
    if (query && !((m.title || '').toLowerCase().includes(query) || (m.desc || '').toLowerCase().includes(query))) return false;
    return true;
  });
  const priceOf = m => (m.price == null || m.price === '') ? null : Number(m.price);
  if (sort === 'cheap') items = [...items].sort((a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity));
  else if (sort === 'exp') items = [...items].sort((a, b) => (priceOf(b) ?? -Infinity) - (priceOf(a) ?? -Infinity));

  const header = (
    <View style={styles.filters}>
      <View style={styles.search}>
        <Ionicons name="search" size={16} color={C.textDim} />
        <TextInput style={styles.searchInput} value={q} onChangeText={setQ} placeholder="Поиск по объявлениям" placeholderTextColor={C.textDim} />
        {!!q && <Ionicons name="close-circle" size={18} color={C.textDim} onPress={() => setQ('')} />}
      </View>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ key: '', name: 'Все' }, ...MARKET_CATS]}
        keyExtractor={c => c.key || 'all'}
        contentContainerStyle={{ gap: 6, paddingRight: 12 }}
        renderItem={({ item }) => (
          <Pressable style={[styles.chip, cat === item.key && styles.chipOn]} onPress={() => setCat(item.key)}>
            <Text style={[styles.chipText, cat === item.key && styles.chipTextOn]}>{item.name}</Text>
          </Pressable>
        )}
      />
      <View style={styles.sortRow}>
        {SORTS.map(s => (
          <Pressable key={s.key} style={[styles.sortChip, sort === s.key && styles.sortChipOn]} onPress={() => setSort(s.key)}>
            <Text style={[styles.sortText, sort === s.key && styles.sortTextOn]}>{s.label}</Text>
          </Pressable>
        ))}
        <Pressable style={styles.shipToggle} onPress={() => setFavOnly(s => !s)}>
          <Ionicons name={favOnly ? 'heart' : 'heart-outline'} size={17} color={favOnly ? C.danger : C.textDim} />
          <Text style={[styles.shipText, favOnly && { color: C.danger }]}>Избранное</Text>
        </Pressable>
        <Pressable style={[styles.shipToggle, { marginLeft: 12 }]} onPress={() => setShipOnly(s => !s)}>
          <Ionicons name={shipOnly ? 'checkbox' : 'square-outline'} size={18} color={shipOnly ? C.oliveLt : C.textDim} />
          <Text style={styles.shipText}>Пересыл</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={items}
      keyExtractor={m => m.id}
      ListHeaderComponent={header}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      renderItem={({ item }) => <Card m={item} fav={isFav(item.id)} onPress={() => navigation.navigate('MarketDetail', { item })} />}
      ListEmptyComponent={<Empty icon={favOnly ? 'heart-outline' : 'pricetags-outline'} title={favOnly ? 'В избранном пусто' : 'Объявлений нет'} text={favOnly ? 'Добавляйте объявления сердечком' : (cat || shipOnly || query ? 'Смягчите фильтры' : '')} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.oliveLt} />}
    />
  );
}

const styles = StyleSheet.create({
  filters: { marginBottom: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, marginBottom: 10 },
  searchInput: { flex: 1, color: C.text, fontSize: 14, fontFamily: F.mono, paddingVertical: 10 },
  chip: { borderWidth: 1, borderColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.surface },
  chipOn: { backgroundColor: C.olive, borderColor: C.oliveLt },
  chipText: { color: C.textDim, fontSize: 12, fontFamily: F.mono },
  chipTextOn: { color: C.white },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  sortChip: { borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4 },
  sortChipOn: { backgroundColor: C.oliveDim, borderColor: C.oliveLt },
  sortText: { color: C.textDim, fontSize: 11, fontFamily: F.mono },
  sortTextOn: { color: C.sand },
  shipToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: 'auto' },
  shipText: { color: C.textDim, fontSize: 12, fontFamily: F.mono },
  count: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, paddingHorizontal: 7, paddingVertical: 2 },
  favBtn: { position: 'absolute', top: 6, left: 6, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  countText: { color: C.white, fontSize: 11, fontFamily: F.mono },
  more: { color: C.oliveLt, fontSize: 12, fontFamily: F.mono, marginLeft: 'auto' },
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden' },
  cover: { width: '100%', height: 180, backgroundColor: C.bg2 },
  noCover: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: 14 },
  price: { color: C.oliveLt, fontSize: 19, fontFamily: F.title },
  title: { color: C.sand, fontSize: 16, fontFamily: F.h, textTransform: 'uppercase', marginTop: 2, marginBottom: 6 },
  badges: { flexDirection: 'row', flexWrap: 'wrap' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  city: { color: C.textDim, fontSize: 12, fontFamily: F.mono },
  exchange: { color: '#8fb0e0', fontSize: 12, fontFamily: F.mono, marginTop: 6, backgroundColor: 'rgba(80,120,200,0.1)', borderRadius: 6, padding: 8 },
  desc: { color: C.text, fontSize: 13, fontFamily: F.mono, lineHeight: 19, marginTop: 6 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  seller: { color: C.textDim, fontSize: 13, fontFamily: F.mono },
  write: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.olive, borderRadius: 8, paddingVertical: 10, marginTop: 12 },
  writeText: { color: C.white, fontFamily: F.h, fontSize: 14, textTransform: 'uppercase' },
});
