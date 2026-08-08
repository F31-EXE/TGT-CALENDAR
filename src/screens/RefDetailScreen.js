import React from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { refSubjectKey } from '../api';
import ReviewsBlock from '../components/ReviewsBlock';

export default function RefDetailScreen({ route }) {
  const { item, collection } = route.params;
  const link = item.link || item.url || '';
  const subjectKey = refSubjectKey(collection, item.id);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 30 }}>
      {item.image ? <Image source={{ uri: item.image }} style={styles.cover} /> : null}
      <View style={styles.pad}>
        <Text style={styles.title}>{item.name}</Text>
        {!!item.city && (
          <View style={styles.metaRow}>
            <Ionicons name="location" size={13} color={C.oliveLt} />
            <Text style={styles.city}>{item.city}</Text>
          </View>
        )}
        {!!item.followers && <Text style={styles.followers}>Подписчиков: {item.followers}</Text>}
        {!!item.desc && <Text style={styles.desc}>{item.desc}</Text>}

        {/^https?:\/\//i.test(link) && (
          <Pressable style={styles.link} onPress={() => Linking.openURL(link)}>
            <Ionicons name="open-outline" size={15} color={C.oliveLt} />
            <Text style={styles.linkText}>Открыть профиль</Text>
          </Pressable>
        )}

        <ReviewsBlock subjectKey={subjectKey} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  cover: { width: '100%', height: 200, backgroundColor: C.bg2 },
  pad: { padding: 16 },
  title: { color: C.sand, fontSize: 24, fontFamily: F.title, textTransform: 'uppercase', letterSpacing: 0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  city: { color: C.textDim, fontSize: 13, fontFamily: F.mono },
  followers: { color: C.textDim, fontSize: 13, fontFamily: F.mono, marginTop: 6 },
  desc: { color: C.text, fontSize: 15, fontFamily: F.mono, lineHeight: 22, marginTop: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, borderWidth: 1, borderColor: C.oliveLt, borderRadius: 9, paddingVertical: 11, justifyContent: 'center' },
  linkText: { color: C.oliveLt, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
});
