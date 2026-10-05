import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { loadRefReviews, reviewsForSubject, reviewStats, submitReview, reportReview, reviewAuthorId } from '../api';
import { isBlocked, blockUser, subscribeBlocks } from '../blocks';
import { getUser, setUserName } from '../identity';
import { requestAchievementCheck } from '../achievements';
import NameModal from './NameModal';

const GOLD = '#d8b45a';

function Stars({ value, size = 14 }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons key={i} name={i <= Math.round(value) ? 'star' : 'star-outline'} size={size} color={i <= Math.round(value) ? GOLD : C.textDim} />
      ))}
    </View>
  );
}

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { return ''; }
}

export default function ReviewsBlock({ subjectKey, onStatsChange }) {
  const [reviews, setReviews] = useState(null);
  const [user, setUser] = useState(null);
  const [pick, setPick] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [nameModal, setNameModal] = useState(false);
  const [, bump] = useState(0);
  useEffect(() => subscribeBlocks(() => bump(v => v + 1)), []);

  const refresh = useCallback(async () => {
    try {
      const all = await loadRefReviews();
      const list = reviewsForSubject(all, subjectKey);
      setReviews(list);
      if (onStatsChange) onStatsChange(reviewStats(list));
    } catch (e) { setReviews([]); }
  }, [subjectKey, onStatsChange]);

  useEffect(() => {
    let alive = true;
    refresh();
    getUser().then(u => { if (alive) setUser(u); });
    return () => { alive = false; };
  }, [refresh]);

  const visible = (reviews || []).filter(r => !isBlocked(reviewAuthorId(r, subjectKey)));
  const stats = reviewStats(reviews || []);
  const mine = user && reviews ? reviews.find(r => r.id === `${subjectKey}_${user.id}`) : null;

  const doSubmit = async (u) => {
    if (!pick) { Alert.alert('Поставьте оценку', 'Выберите от 1 до 5 звёзд.'); return; }
    setBusy(true);
    try {
      await submitReview(subjectKey, u, pick, text.trim());
      setText('');
      setPick(0);
      await refresh();
      requestAchievementCheck();
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось отправить отзыв. Проверьте интернет.');
    } finally { setBusy(false); }
  };

  const onSend = async () => {
    if (!pick) { Alert.alert('Поставьте оценку', 'Выберите от 1 до 5 звёзд.'); return; }
    if (!user) { setNameModal(true); return; }
    doSubmit(user);
  };

  // Модерация (требование App Store к пользовательскому контенту):
  // пожаловаться на отзыв или скрыть все отзывы автора на этом устройстве.
  const onReviewMenu = (r) => {
    const authorId = reviewAuthorId(r, subjectKey);
    Alert.alert(r.author || 'Отзыв', 'Что сделать с этим отзывом?', [
      { text: 'Пожаловаться', onPress: async () => {
        try { await reportReview(r); Alert.alert('Спасибо', 'Жалоба отправлена, модератор проверит отзыв.'); }
        catch (e) { Alert.alert('Ошибка', 'Не удалось отправить. Проверьте интернет.'); }
      } },
      ...(authorId ? [{ text: 'Скрыть отзывы автора', style: 'destructive', onPress: () => blockUser(authorId) }] : []),
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const onNameSubmit = async (name) => {
    const u = await setUserName(name);
    setUser(u);
    setNameModal(false);
    if (u) doSubmit(u);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Ionicons name="star" size={16} color={GOLD} />
        <Text style={styles.headText}>Отзывы</Text>
        {stats.count > 0 && (
          <Text style={styles.avg}>{stats.avg.toFixed(1)} · {stats.count}</Text>
        )}
      </View>

      {/* Форма нового отзыва */}
      <View style={styles.form}>
        <Text style={styles.formLabel}>{mine ? 'Ваша оценка (можно изменить)' : 'Оценить'}</Text>
        <View style={styles.pickRow}>
          {[1, 2, 3, 4, 5].map(i => (
            <Pressable key={i} onPress={() => setPick(i)} hitSlop={6}>
              <Ionicons name={i <= pick ? 'star' : 'star-outline'} size={30} color={i <= pick ? GOLD : C.textDim} />
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Пара слов (необязательно)"
          placeholderTextColor={C.textDim}
          multiline
          maxLength={500}
        />
        <Pressable style={[styles.send, busy && { opacity: 0.6 }]} onPress={onSend} disabled={busy}>
          {busy ? <ActivityIndicator size="small" color={C.white} /> : <Ionicons name="paper-plane" size={15} color={C.white} />}
          <Text style={styles.sendText}>{mine ? 'Обновить отзыв' : 'Отправить отзыв'}</Text>
        </Pressable>
      </View>

      {/* Список отзывов */}
      {reviews === null ? (
        <ActivityIndicator size="small" color={C.oliveLt} style={{ marginTop: 14 }} />
      ) : visible.length === 0 ? (
        <Text style={styles.empty}>Отзывов ещё нет. Будьте первым!</Text>
      ) : (
        visible.map(r => (
          <View key={r.id} style={styles.item}>
            <View style={styles.itemHead}>
              <Text style={styles.author}>{r.author || 'Боец'}</Text>
              <Stars value={r.stars || 0} />
              {r !== mine && (
                <Pressable hitSlop={10} onPress={() => onReviewMenu(r)} style={styles.menu}>
                  <Ionicons name="ellipsis-horizontal" size={16} color={C.textDim} />
                </Pressable>
              )}
            </View>
            {!!r.text && <Text style={styles.itemText}>{r.text}</Text>}
            <Text style={styles.itemDate}>{fmtDate(r.createdAt)}</Text>
          </View>
        ))
      )}

      <NameModal
        visible={nameModal}
        initial={user?.name || ''}
        onCancel={() => setNameModal(false)}
        onSubmit={onNameSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headText: { color: C.sand, fontSize: 16, fontFamily: F.title, textTransform: 'uppercase', letterSpacing: 0.5 },
  avg: { marginLeft: 'auto', color: GOLD, fontFamily: F.mono, fontSize: 14 },
  form: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginTop: 12 },
  formLabel: { color: C.oliveLt, fontSize: 11, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickRow: { flexDirection: 'row', gap: 6, marginTop: 8, marginBottom: 12 },
  input: { backgroundColor: C.bg2, borderWidth: 1, borderColor: C.border, borderRadius: 8, color: C.text, fontSize: 15, fontFamily: F.mono, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, textAlignVertical: 'top' },
  send: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: C.olive, borderRadius: 9, paddingVertical: 11, marginTop: 12 },
  sendText: { color: C.white, fontFamily: F.h, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { color: C.textDim, fontSize: 13, fontFamily: F.mono, marginTop: 14 },
  item: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginTop: 10 },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  author: { color: C.sand, fontSize: 14, fontFamily: F.h, textTransform: 'uppercase', flex: 1, marginRight: 8 },
  menu: { marginLeft: 10 },
  itemText: { color: C.text, fontSize: 14, fontFamily: F.mono, lineHeight: 20, marginTop: 8 },
  itemDate: { color: C.textDim, fontSize: 11, fontFamily: F.mono, marginTop: 8 },
});
