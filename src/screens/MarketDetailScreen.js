import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, Linking, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, marketCatName } from '../theme';
import { priceLabel, parsePhotos, marketWriteLink, reportMarket } from '../api';
import { Badge } from '../ui';
import { recordFlag, requestAchievementCheck } from '../achievements';
import { isFav, toggleFav, subscribeFavs } from '../favorites';

const W = Dimensions.get('window').width;

export default function MarketDetailScreen({ route }) {
  const { item: m } = route.params;
  const photos = parsePhotos(m);
  const link = marketWriteLink(m);
  const [fav, setFav] = useState(isFav(m.id));
  const [reported, setReported] = useState(false);

  useEffect(() => { recordFlag('market').then(requestAchievementCheck); }, []); // ачивка «Барахольщик»
  useEffect(() => subscribeFavs(() => setFav(isFav(m.id))), [m.id]);

  const openSeller = async () => {
    if (!link) { Alert.alert('Нет контакта', 'У этого объявления не указан профиль продавца.'); return; }
    try {
      const ok = await Linking.canOpenURL(link);
      if (!ok) throw new Error('cant open');
      await Linking.openURL(link);
    } catch (e) {
      Alert.alert('Не удалось открыть', 'Скопируйте ссылку вручную:\n' + link);
    }
  };

  const onReport = () => {
    Alert.alert(
      'Пожаловаться на объявление?',
      'Модератор проверит его. Спам, обман, запрещённые товары — жалуйтесь смело.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Пожаловаться', style: 'destructive', onPress: async () => {
          try { await reportMarket(m); setReported(true); Alert.alert('Спасибо', 'Жалоба отправлена.'); }
          catch (e) { Alert.alert('Ошибка', 'Не удалось отправить. Проверьте интернет.'); }
        } },
      ]
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      {photos.length > 0 && (
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ height: W * 0.75 }}>
          {photos.map((u, i) => <Image key={i} source={{ uri: u }} style={{ width: W, height: W * 0.75, backgroundColor: C.bg2 }} />)}
        </ScrollView>
      )}
      <View style={styles.pad}>
        <Text style={styles.price}>{m.sold ? 'ПРОДАНО' : priceLabel(m.price)}</Text>
        <Text style={styles.title}>{m.title}</Text>
        <View style={styles.badges}>
          {!!m.category && <Badge label={marketCatName(m.category)} tone="olive" />}
          {(m.dealType === 'exchange' || m.dealType === 'both') && <Badge label="Обмен" icon="swap-horizontal" tone="blue" />}
          {!!m.bargain && <Badge label="Торг" icon="chatbubbles" tone="gold" />}
          {!!m.shipping && <Badge label="Пересыл" icon="cube" tone="green" />}
        </View>

        {!!m.city && <View style={styles.metaRow}><Ionicons name="location" size={14} color={C.oliveLt} /><Text style={styles.city}>{m.city}</Text></View>}
        {(m.dealType && m.dealType !== 'sell' && m.exchangeFor) ? (
          <View style={styles.exchange}><Ionicons name="swap-horizontal" size={14} color="#8fb0e0" /><Text style={styles.exchangeText}> Меняю на: {m.exchangeFor}</Text></View>
        ) : null}

        {!!m.desc && <Text style={styles.desc}>{m.desc}</Text>}

        <View style={styles.sellerRow}>
          {m.authorAvatar ? <Image source={{ uri: m.authorAvatar }} style={styles.avatar} /> : <Ionicons name="person-circle" size={36} color={C.oliveDim} />}
          <Text style={styles.seller}>{m.authorName || 'Аноним'}</Text>
        </View>

        {!m.sold && m.bargain && !!link && (
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={openSeller}>
            <Ionicons name="chatbubbles" size={16} color={C.oliveLt} />
            <Text style={styles.btnOutlineText}>Предложить цену (в ВК)</Text>
          </Pressable>
        )}
        {!m.sold && !!link && (
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={openSeller}>
            <Ionicons name="logo-vk" size={16} color={C.white} />
            <Text style={styles.btnText}>Написать продавцу</Text>
          </Pressable>
        )}

        <Pressable style={[styles.btn, fav ? styles.favOn : styles.btnOutline]} onPress={() => toggleFav(m.id)}>
          <Ionicons name={fav ? 'heart' : 'heart-outline'} size={16} color={fav ? C.danger : C.oliveLt} />
          <Text style={[styles.btnOutlineText, fav && { color: C.danger }]}>{fav ? 'В избранном' : 'В избранное'}</Text>
        </Pressable>

        <Pressable style={styles.reportRow} onPress={onReport} disabled={reported}>
          <Ionicons name={reported ? 'checkmark-circle' : 'flag-outline'} size={14} color={C.textDim} />
          <Text style={styles.reportText}>{reported ? 'Жалоба отправлена' : 'Пожаловаться на объявление'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { padding: 16 },
  price: { color: C.oliveLt, fontSize: 28, fontFamily: F.title },
  title: { color: C.sand, fontSize: 21, fontFamily: F.h, textTransform: 'uppercase', marginTop: 4, marginBottom: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  city: { color: C.textDim, fontSize: 14, fontFamily: F.mono },
  exchange: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(80,120,200,0.1)', borderRadius: 8, padding: 10, marginTop: 10 },
  exchangeText: { color: '#8fb0e0', fontSize: 14, fontFamily: F.mono },
  desc: { color: C.text, fontSize: 14, fontFamily: F.mono, lineHeight: 22, marginTop: 12 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  seller: { color: C.sand, fontSize: 15, fontFamily: F.h, textTransform: 'uppercase' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10, marginTop: 12 },
  btnPrimary: { backgroundColor: C.olive },
  btnText: { color: C.white, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  btnOutline: { borderWidth: 1, borderColor: C.oliveLt },
  btnOutlineText: { color: C.oliveLt, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  favOn: { borderWidth: 1, borderColor: C.danger, backgroundColor: 'rgba(192,57,43,0.12)' },
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, paddingVertical: 8 },
  reportText: { color: C.textDim, fontSize: 12, fontFamily: F.mono },
});
