import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, Share, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { evaluateAchievements } from '../achievements';
import { SITE_ORIGIN } from '../api';
import * as AppleAuthentication from 'expo-apple-authentication';
import { setUserName, getTeam, setTeam, getUser, setVkUser, setAppleUser, logout, isVkUser, isAppleUser, isLinked } from '../identity';
import { loginWithVk } from '../vkAuth';
import { loginWithApple, appleAvailable } from '../appleAuth';
import { deleteMyAccount } from '../account';
import { Loading } from '../ui';
import NameModal from '../components/NameModal';

const VK_ERRORS = {
  not_configured: 'ВК-вход ещё не настроен (нет client_id).',
  cancel: 'Вход отменён.',
  state: 'Ошибка безопасности (state). Попробуйте ещё раз.',
  no_code: 'ВК не вернул код авторизации.',
  no_token: 'Не удалось получить токен.',
  no_user: 'Не удалось получить профиль.',
};

export default function ProfileScreen() {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nameModal, setNameModal] = useState(false);
  const [teamModal, setTeamModal] = useState(false);
  const [team, setTeamState] = useState('');
  const [account, setAccount] = useState(null);
  const [vkBusy, setVkBusy] = useState(false);
  const [hasApple, setHasApple] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { appleAvailable().then(setHasApple); }, []);

  const load = useCallback(async () => {
    try { setData(await evaluateAchievements()); } catch (e) { setData(null); }
    getTeam().then(setTeamState);
    getUser().then(setAccount);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const onNameSubmit = async (name) => { await setUserName(name); setNameModal(false); load(); };
  const onTeamSubmit = async (name) => { const t = await setTeam(name); setTeamState(t); setTeamModal(false); };

  const onVkLogin = async () => {
    setVkBusy(true);
    const r = await loginWithVk();
    setVkBusy(false);
    if (r.ok) { await setVkUser(r.profile); load(); }
    else Alert.alert('Вход через ВК', VK_ERRORS[r.reason] || ('Не получилось: ' + r.reason));
  };
  const onAppleLogin = async () => {
    const r = await loginWithApple();
    if (r.ok) { await setAppleUser(r.profile); load(); }
    else if (r.reason !== 'cancel') Alert.alert('Вход через Apple', 'Не получилось войти. Попробуйте ещё раз.');
  };
  const onDeleteAccount = () => {
    const how = isVkUser(account) ? ' Для подтверждения войдите через ВК ещё раз.'
      : isAppleUser(account) ? ' Для подтверждения войдите через Apple ещё раз.' : '';
    Alert.alert(
      'Удалить аккаунт?',
      'Удалятся ваши отметки на играх, отзывы, оценки, объявления и жалобы, а также все данные на этом устройстве. Отменить нельзя.' + how,
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить', style: 'destructive', onPress: async () => {
          setDeleting(true);
          const r = await deleteMyAccount();
          setDeleting(false);
          if (r.ok) { Alert.alert('Аккаунт удалён', 'Ваши данные удалены.'); load(); }
          else if (r.reason === 'mismatch') Alert.alert('Не тот аккаунт', 'Вход выполнен в другой аккаунт. Данные не удалены.');
          else if (r.reason !== 'cancel') Alert.alert('Не получилось', 'Не удалось удалить данные. Проверьте интернет и попробуйте ещё раз.');
        } },
      ]
    );
  };
  const onVkLogout = () => {
    Alert.alert(isAppleUser(account) ? 'Выйти из Apple ID?' : 'Выйти из ВК?', 'Профиль отвяжется, останется локальное имя.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => { await logout(); load(); } },
    ]);
  };

  if (!data) return <Loading />;

  const { rank, next, xp, stats, userName, total } = data;
  const span = next ? next.min - rank.min : 1;
  const into = next ? xp - rank.min : 1;
  const pct = next ? Math.max(4, Math.round((into / span) * 100)) : 100;

  const share = async () => {
    const lines = [
      `⚔️ ${userName || 'Боец'}${team ? ' [' + team + ']' : ''} · ${rank.name}`,
      `Игр: ${stats.going} · Отзывов: ${stats.reviews} · Наград: ${stats.achievements}/${total}`,
      stats.favPolygon ? `Любимый полигон: ${stats.favPolygon}` : '',
      '',
      'THE GRIM TEAM — календарь страйкбола Урала',
      SITE_ORIGIN,
    ].filter(Boolean);
    try { await Share.share({ message: lines.join('\n') }); } catch (e) {}
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.oliveLt} />}
    >
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardKicker}>Военный билет</Text>
          <Pressable style={styles.teamRow} onPress={() => setTeamModal(true)}>
            <Ionicons name="people" size={13} color={team ? C.oliveLt : C.textDim} />
            <Text style={[styles.cardTeam, !team && { color: C.textDim }]} numberOfLines={1}>{team || 'Указать команду'}</Text>
            <Ionicons name="pencil" size={12} color={C.textDim} />
          </Pressable>
        </View>

        <View style={styles.idRow}>
          <View style={[styles.rankMedal, { borderColor: rank.color, shadowColor: rank.color }]}>
            <MaterialCommunityIcons name={rank.icon} size={34} color={rank.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Pressable style={styles.nameRow} onPress={() => setNameModal(true)}>
              <Text style={styles.name} numberOfLines={1}>{userName || 'Задать имя'}</Text>
              <Ionicons name="pencil" size={14} color={C.textDim} />
            </Pressable>
            <Text style={[styles.rankName, { color: rank.color }]}>{rank.name}</Text>
            <Text style={styles.xp}>{xp} XP</Text>
          </View>
        </View>

        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: pct + '%', backgroundColor: rank.color }]} />
        </View>
        <Text style={styles.xpHint}>
          {next ? `До звания «${next.name}»: ${next.min - xp} XP` : 'Максимальное звание достигнуто'}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <Stat icon="flag" label="Игр (Пойду)" value={stats.going} />
        <Stat icon="star" label="Отзывов" value={stats.reviews} />
        <Stat icon="trophy" label="Наград" value={`${stats.achievements}/${total}`} />
        <Stat icon="flame" label="Дней в строю" value={stats.days} />
      </View>

      {(stats.favTag || stats.favPolygon) && (
        <View style={styles.favBox}>
          {!!stats.favTag && <FavRow icon="pricetag" label="Любимый формат" value={stats.favTag} />}
          {!!stats.favPolygon && <FavRow icon="location" label="Любимый полигон" value={stats.favPolygon} />}
        </View>
      )}

      <Pressable style={styles.shareBtn} onPress={share}>
        <Ionicons name="share-social" size={17} color={C.white} />
        <Text style={styles.shareText}>Поделиться в ВК</Text>
      </Pressable>

      {isLinked(account) ? (
        <View style={styles.vkCard}>
          {account.avatar ? <Image source={{ uri: account.avatar }} style={styles.vkAvatar} />
            : <Ionicons name={isAppleUser(account) ? 'logo-apple' : 'logo-vk'} size={30} color={isAppleUser(account) ? C.sand : '#4a76a8'} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.vkName} numberOfLines={1}>{account.name}</Text>
            <Text style={[styles.vkNote, isAppleUser(account) && { color: C.textDim }]}>{isAppleUser(account) ? 'Вход через Apple' : 'Вход через ВКонтакте'}</Text>
          </View>
          <Pressable hitSlop={8} onPress={onVkLogout}><Text style={styles.vkLogout}>Выйти</Text></Pressable>
        </View>
      ) : (
        <>
          {hasApple && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={10}
              style={styles.appleBtn}
              onPress={onAppleLogin}
            />
          )}
          <Pressable style={[styles.vkBtn, vkBusy && { opacity: 0.6 }]} onPress={onVkLogin} disabled={vkBusy}>
            {vkBusy ? <ActivityIndicator size="small" color={C.white} /> : <Ionicons name="logo-vk" size={18} color={C.white} />}
            <Text style={styles.vkBtnText}>Войти через ВК</Text>
          </Pressable>
        </>
      )}

      {!data.hasUser && (
        <View style={styles.note}>
          <Ionicons name="information-circle" size={16} color={C.oliveLt} />
          <Text style={styles.noteText}>Задайте имя и отмечайтесь на играх («Пойду») — так копятся опыт, звания и награды.</Text>
        </View>
      )}

      <Pressable style={styles.deleteRow} onPress={onDeleteAccount} disabled={deleting}>
        {deleting ? <ActivityIndicator size="small" color={C.danger} /> : <Ionicons name="trash-outline" size={15} color={C.danger} />}
        <Text style={styles.deleteText}>Удалить аккаунт и данные</Text>
      </Pressable>

      <NameModal visible={nameModal} initial={userName || ''} onCancel={() => setNameModal(false)} onSubmit={onNameSubmit} />
      <NameModal
        visible={teamModal}
        initial={team}
        onCancel={() => setTeamModal(false)}
        onSubmit={onTeamSubmit}
        title="Название команды"
        hint="Ваша команда/позывной подразделения. Можно оставить пустым."
        placeholder="Например: GRIM TEAM"
        allowEmpty
      />
    </ScrollView>
  );
}

function Stat({ icon, label, value }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={C.oliveLt} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
function FavRow({ icon, label, value }) {
  return (
    <View style={styles.favRow}>
      <Ionicons name={icon} size={15} color={C.oliveLt} />
      <Text style={styles.favLabel}>{label}</Text>
      <Text style={styles.favValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  card: { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, borderLeftWidth: 4, borderLeftColor: C.olive },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  cardKicker: { color: C.textDim, fontSize: 11, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 2 },
  teamRow: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '55%' },
  cardTeam: { color: C.oliveLt, fontSize: 13, fontFamily: F.title, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 1 },
  idRow: { flexDirection: 'row', alignItems: 'center' },
  rankMedal: { width: 66, height: 66, borderRadius: 33, borderWidth: 2.5, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: C.sand, fontSize: 22, fontFamily: F.title, textTransform: 'uppercase', flexShrink: 1 },
  rankName: { fontSize: 15, fontFamily: F.h, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  xp: { color: C.textDim, fontSize: 12, fontFamily: F.mono, marginTop: 2 },
  xpTrack: { height: 8, borderRadius: 4, backgroundColor: C.surface, marginTop: 16, overflow: 'hidden' },
  xpFill: { height: '100%' },
  xpHint: { color: C.textDim, fontSize: 11, fontFamily: F.mono, marginTop: 6, textAlign: 'right' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 16 },
  stat: { width: '48%', backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center', paddingVertical: 16, marginBottom: 12 },
  statValue: { color: C.sand, fontSize: 26, fontFamily: F.title, marginTop: 6 },
  statLabel: { color: C.textDim, fontSize: 11, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 2 },
  favBox: { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 12 },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  favLabel: { color: C.textDim, fontSize: 12, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 0.3 },
  favValue: { color: C.sand, fontSize: 14, fontFamily: F.h, marginLeft: 'auto', maxWidth: '55%' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.olive, borderRadius: 10, paddingVertical: 14 },
  shareText: { color: C.white, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  vkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4a76a8', borderRadius: 10, paddingVertical: 14, marginTop: 10 },
  vkBtnText: { color: C.white, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  appleBtn: { height: 48, marginTop: 10 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 28, paddingVertical: 10 },
  deleteText: { color: C.danger, fontSize: 13, fontFamily: F.mono },
  vkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 12, marginTop: 10 },
  vkAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bg2 },
  vkName: { color: C.sand, fontSize: 15, fontFamily: F.h, textTransform: 'uppercase' },
  vkNote: { color: '#8fb0e0', fontSize: 12, fontFamily: F.mono, marginTop: 2 },
  vkLogout: { color: C.danger, fontSize: 13, fontFamily: F.mono },
  note: { flexDirection: 'row', gap: 8, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginTop: 16 },
  noteText: { color: C.textDim, fontSize: 12, fontFamily: F.mono, lineHeight: 17, flex: 1 },
});
