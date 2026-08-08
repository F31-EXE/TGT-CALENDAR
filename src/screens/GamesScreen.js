import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Image, Pressable, StyleSheet, RefreshControl, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, TAG_COLORS } from '../theme';
import { loadGames, splitGames, fmtDateTime, parseTags } from '../api';
import { Loading, Empty, ErrorState, Tag } from '../ui';
import CalendarView from '../components/CalendarView';

function GameCard({ game, onPress }) {
  const tags = parseTags(game.tags);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {game.image ? <Image source={{ uri: game.image }} style={styles.cover} /> : null}
      <View style={styles.body}>
        <Text style={styles.title}>{game.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="calendar" size={13} color={C.oliveLt} />
          <Text style={styles.meta}>{fmtDateTime(game.startDate || game.date)}</Text>
        </View>
        {!!game.location && (
          <View style={styles.metaRow}>
            <Ionicons name="location" size={13} color={C.oliveLt} />
            <Text style={styles.meta}>{game.location}</Text>
          </View>
        )}
        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map(t => <Tag key={t} label={t} color={TAG_COLORS[t]} />)}
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function GamesScreen({ navigation }) {
  const [state, setState] = useState({ loading: true, error: false, all: [], upcoming: [], past: [] });
  const [tab, setTab] = useState('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const games = await loadGames();
      const { upcoming, past } = splitGames(games);
      setState({ loading: false, error: false, all: games, upcoming, past });
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: true }));
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState onRetry={() => { setState(s => ({ ...s, loading: true, error: false })); fetch(); }} />;

  const seg = (
    <View style={styles.seg}>
      {[['upcoming', 'Список'], ['calendar', 'Календарь'], ['past', 'Архив']].map(([k, label]) => (
        <Pressable key={k} style={[styles.segBtn, tab === k && styles.segBtnOn]} onPress={() => setTab(k)}>
          <Text style={[styles.segText, tab === k && styles.segTextOn]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (tab === 'calendar') {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.oliveLt} />}
      >
        {seg}
        <CalendarView games={state.all} onSelectGame={g => navigation.navigate('GameDetail', { game: g })} />
      </ScrollView>
    );
  }

  const data = tab === 'upcoming' ? state.upcoming : state.past;
  return (
    <View style={styles.screen}>
      {seg}
      <FlatList
        data={data}
        keyExtractor={g => g.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
        renderItem={({ item }) => <GameCard game={item} onPress={() => navigation.navigate('GameDetail', { game: item })} />}
        ListEmptyComponent={<Empty icon="calendar-outline" title={tab === 'upcoming' ? 'Ближайших игр нет' : 'Архив пуст'} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.oliveLt} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  seg: { flexDirection: 'row', padding: 12, gap: 8 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  segBtnOn: { backgroundColor: C.olive, borderColor: C.oliveLt },
  segText: { color: C.textDim, fontFamily: F.med, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.3 },
  segTextOn: { color: C.white },
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: 'hidden' },
  cover: { width: '100%', height: 170, backgroundColor: C.bg2 },
  body: { padding: 14 },
  title: { color: C.sand, fontSize: 19, fontFamily: F.title, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  meta: { color: C.text, fontSize: 13, fontFamily: F.mono, flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
});
