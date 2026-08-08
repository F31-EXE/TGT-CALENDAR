import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, Linking, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, TAG_COLORS } from '../theme';
import { fmtDateTime, parseTags, yandexMapsUrl, loadRsvpsForGame, setRsvp, rsvpDocId, gameShareUrl } from '../api';
import { Tag } from '../ui';
import { scheduleGameReminder, cancelGameReminder, isReminderSet } from '../notify';
import { getUser, setUserName } from '../identity';
import { recordFlag, requestAchievementCheck } from '../achievements';
import NameModal from '../components/NameModal';
import LinkText from '../components/LinkText';

const RSVP_OPTIONS = [
  { key: 'going', label: 'Пойду', icon: 'checkmark-circle' },
  { key: 'maybe', label: 'Думаю', icon: 'help-circle' },
  { key: 'declined', label: 'Не пойду', icon: 'close-circle' },
];

export default function GameDetailScreen({ route }) {
  const { game } = route.params;
  const tags = parseTags(game.tags);
  const isPast = new Date(game.startDate || game.date) < new Date();
  const hasPt = typeof game.lat === 'number' && typeof game.lng === 'number' && !isNaN(game.lat) && !isNaN(game.lng);
  const [reminding, setReminding] = useState(false);
  const [reminderOn, setReminderOn] = useState(false);
  const [rsvps, setRsvps] = useState(null);
  const [user, setUser] = useState(null);
  const [nameModal, setNameModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setRsvps(await loadRsvpsForGame(game.id)); } catch (e) { setRsvps([]); }
  }, [game.id]);

  useEffect(() => {
    let alive = true;
    refresh();
    getUser().then(u => { if (alive) setUser(u); });
    isReminderSet(game.id).then(on => { if (alive) setReminderOn(on); });
    return () => { alive = false; };
  }, [refresh, game.id]);

  const going = (rsvps || []).filter(r => r.status === 'going');
  const myStatus = user && rsvps ? (rsvps.find(r => r.id === rsvpDocId(game.id, user.id))?.status || null) : null;

  const doRsvp = async (status, u) => {
    setBusy(true);
    try {
      await setRsvp(game.id, u, status);
      await refresh();
      if (status === 'going') requestAchievementCheck();
    } catch (e) {
      Alert.alert('Ошибка', 'Не удалось сохранить. Проверьте интернет и попробуйте ещё раз.');
    } finally { setBusy(false); }
  };

  const onPickStatus = async (status) => {
    let u = user;
    if (!u) { setPendingStatus(status); setNameModal(true); return; }
    doRsvp(status, u);
  };

  const onNameSubmit = async (name) => {
    const u = await setUserName(name);
    setUser(u);
    setNameModal(false);
    if (u && pendingStatus) { doRsvp(pendingStatus, u); setPendingStatus(null); }
  };

  const toggleRemind = async () => {
    setReminding(true);
    if (reminderOn) {
      await cancelGameReminder(game.id);
      setReminderOn(false);
      setReminding(false);
      return;
    }
    const r = await scheduleGameReminder(game);
    setReminding(false);
    if (r.ok) {
      setReminderOn(true);
      recordFlag('reminder').then(requestAchievementCheck); // ачивка «На стрёме»
      const when = r.fireDate.toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
      Alert.alert('Напоминание включено', 'Пришлём уведомление ' + when);
    } else if (r.reason === 'denied') {
      Alert.alert('Нет разрешения', 'Разрешите уведомления в настройках, чтобы получать напоминания об играх.');
    } else {
      Alert.alert('Не получилось', 'До игры слишком мало времени для напоминания.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      {game.image ? <Image source={{ uri: game.image }} style={styles.cover} /> : null}
      <View style={styles.pad}>
        <Text style={styles.title}>{game.title}</Text>
        {tags.length > 0 && (
          <View style={styles.tags}>{tags.map(t => <Tag key={t} label={t} color={TAG_COLORS[t]} />)}</View>
        )}

        <Row icon="calendar" label="Когда" value={fmtDateTime(game.startDate || game.date) + (game.endDate ? ' (многодневная)' : '')} />
        {!!game.location && <Row icon="location" label="Где" value={game.location} />}

        {!!game.description && <LinkText text={game.description} style={styles.desc} />}

        {!isPast && (
          <View style={styles.rsvpBox}>
            <Text style={styles.rsvpTitle}>Участие</Text>
            <View style={styles.rsvpRow}>
              {RSVP_OPTIONS.map(o => {
                const on = myStatus === o.key;
                return (
                  <Pressable key={o.key} style={[styles.rsvpBtn, on && styles.rsvpBtnOn]} disabled={busy} onPress={() => onPickStatus(o.key)}>
                    <Ionicons name={o.icon} size={16} color={on ? C.white : C.oliveLt} />
                    <Text style={[styles.rsvpText, on && styles.rsvpTextOn]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {going.length > 0 && (
          <View style={styles.going}>
            <View style={styles.goingHead}>
              <Ionicons name="people" size={16} color={C.oliveLt} />
              <Text style={styles.goingCount}>Пойдут: {going.length}</Text>
            </View>
            <Text style={styles.goingNames}>{going.map(g => g.name).filter(Boolean).join(', ')}</Text>
          </View>
        )}

        {!isPast && (
          <Pressable style={[styles.btn, reminderOn ? styles.btnReminderOn : styles.btnPrimary]} onPress={toggleRemind} disabled={reminding}>
            <Ionicons name={reminderOn ? 'notifications' : 'notifications-outline'} size={16} color={reminderOn ? C.oliveLt : C.white} />
            <Text style={[styles.btnText, reminderOn && styles.btnTextOn]}>
              {reminding ? '…' : (reminderOn ? 'Напоминание включено · убрать' : 'Напомнить об игре')}
            </Text>
          </Pressable>
        )}

        {hasPt && (
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => Linking.openURL(yandexMapsUrl(game.lat, game.lng))}>
            <Ionicons name="map" size={16} color={C.oliveLt} />
            <Text style={styles.btnOutlineText}>Открыть на Яндекс.Картах</Text>
          </Pressable>
        )}

        {/^https?:\/\//i.test(game.announceUrl || '') && (
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => Linking.openURL(game.announceUrl)}>
            <Ionicons name="logo-vk" size={16} color={C.oliveLt} />
            <Text style={styles.btnOutlineText}>Читать анонс ВКонтакте</Text>
          </Pressable>
        )}

        <Pressable style={[styles.btn, styles.btnOutline]} onPress={() => Share.share({ message: `${game.title} — ${fmtDateTime(game.startDate || game.date)}\n${gameShareUrl(game)}` })}>
          <Ionicons name="share-social" size={16} color={C.oliveLt} />
          <Text style={styles.btnOutlineText}>Поделиться игрой</Text>
        </Pressable>
      </View>

      <NameModal
        visible={nameModal}
        initial={user?.name || ''}
        onCancel={() => { setNameModal(false); setPendingStatus(null); }}
        onSubmit={onNameSubmit}
      />
    </ScrollView>
  );
}

function Row({ icon, label, value }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={C.oliveLt} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  cover: { width: '100%', height: 220, backgroundColor: C.bg2 },
  pad: { padding: 16 },
  title: { color: C.sand, fontSize: 25, fontFamily: F.title, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 12 },
  rowLabel: { color: C.oliveLt, fontSize: 11, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 0.5 },
  rowValue: { color: C.text, fontSize: 15, fontFamily: F.mono, marginTop: 2 },
  desc: { color: C.text, fontSize: 14, fontFamily: F.mono, lineHeight: 22, marginVertical: 8 },
  rsvpBox: { marginTop: 12 },
  rsvpTitle: { color: C.oliveLt, fontSize: 11, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderRadius: 9, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface },
  rsvpBtnOn: { backgroundColor: C.olive, borderColor: C.oliveLt },
  rsvpText: { color: C.oliveLt, fontFamily: F.med, fontSize: 13, textTransform: 'uppercase' },
  rsvpTextOn: { color: C.white },
  going: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginTop: 12 },
  goingHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  goingCount: { color: C.oliveLt, fontSize: 14, fontFamily: F.h, textTransform: 'uppercase' },
  goingNames: { color: C.text, fontSize: 13, fontFamily: F.mono, lineHeight: 19, marginTop: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10, marginTop: 12 },
  btnPrimary: { backgroundColor: C.olive },
  btnReminderOn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.oliveLt },
  btnText: { color: C.white, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnTextOn: { color: C.oliveLt },
  btnOutline: { borderWidth: 1, borderColor: C.oliveLt },
  btnOutlineText: { color: C.oliveLt, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
});
