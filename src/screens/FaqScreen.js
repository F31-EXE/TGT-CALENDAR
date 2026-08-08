import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, RefreshControl, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { loadFaq } from '../api';
import { Loading, Empty, ErrorState } from '../ui';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function FaqScreen() {
  const [state, setState] = useState({ loading: true, error: false, items: [] });
  const [open, setOpen] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try { setState({ loading: false, error: false, items: await loadFaq() }); }
    catch (e) { setState(s => ({ ...s, loading: false, error: true })); }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  const onRefresh = async () => { setRefreshing(true); await fetch(); setRefreshing(false); };

  const toggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(o => (o === id ? null : id));
  };

  if (state.loading) return <Loading />;
  if (state.error) return <ErrorState onRetry={() => { setState(s => ({ ...s, loading: true, error: false })); fetch(); }} />;

  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={state.items}
      keyExtractor={i => i.id}
      contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
      renderItem={({ item }) => {
        const isOpen = open === item.id;
        return (
          <Pressable style={styles.card} onPress={() => toggle(item.id)}>
            <View style={styles.qRow}>
              <Text style={styles.q}>{item.question}</Text>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.oliveLt} />
            </View>
            {isOpen && <Text style={styles.a}>{item.answer}</Text>}
          </Pressable>
        );
      }}
      ListEmptyComponent={<Empty icon="help-circle-outline" title="Вопросов пока нет" />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.oliveLt} />}
    />
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 10, padding: 14 },
  qRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  q: { color: C.sand, fontSize: 15, fontFamily: F.h, textTransform: 'uppercase', flex: 1 },
  a: { color: C.text, fontSize: 14, fontFamily: F.mono, lineHeight: 21, marginTop: 10 },
});
