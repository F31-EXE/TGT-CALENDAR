import React, { useEffect } from 'react';
import { Text, Image, ScrollView, View, StyleSheet, Pressable, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { fmtDate, articleSegments, blogShareUrl } from '../api';
import { recordFlag, requestAchievementCheck } from '../achievements';

// Текст с кликабельными ссылками
function RichText({ text, style }) {
  const parts = String(text).split(/(https?:\/\/[^\s)]+)/g);
  return (
    <Text style={style}>
      {parts.map((p, i) => /^https?:\/\//.test(p)
        ? <Text key={i} style={styles.link} onPress={() => Linking.openURL(p).catch(() => {})}>{p}</Text>
        : p)}
    </Text>
  );
}

export default function ArticleScreen({ route }) {
  const { article } = route.params;
  const segs = articleSegments(article);

  useEffect(() => { recordFlag('article').then(requestAchievementCheck); }, []); // ачивка «Читатель»

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {article.image ? <Image source={{ uri: article.image }} style={styles.cover} /> : null}
      <View style={styles.pad}>
        <Text style={styles.title}>{article.title}</Text>
        <Text style={styles.date}>{fmtDate(article.createdAt)}</Text>
        {segs.map((s, i) => {
          if (s.type === 'image') return <Image key={i} source={{ uri: s.uri }} style={styles.inlineImg} />;
          if (s.type === 'h2') return <Text key={i} style={styles.h2}>{s.text}</Text>;
          if (s.type === 'h3') return <Text key={i} style={styles.h3}>{s.text}</Text>;
          if (s.type === 'li') return (
            <View key={i} style={styles.liRow}><Text style={styles.bullet}>•</Text><RichText text={s.text} style={styles.li} /></View>
          );
          if (s.type === 'quote') return <RichText key={i} text={s.text} style={styles.quote} />;
          return <RichText key={i} text={s.text} style={styles.p} />;
        })}
        <Pressable style={styles.share} onPress={() => Share.share({ message: `${article.title}\n${blogShareUrl(article)}` })}>
          <Ionicons name="share-social" size={16} color={C.oliveLt} />
          <Text style={styles.shareText}>Поделиться статьёй</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  cover: { width: '100%', height: 210, backgroundColor: C.bg2 },
  pad: { padding: 16 },
  title: { color: C.sand, fontSize: 25, fontFamily: F.title, textTransform: 'uppercase', lineHeight: 30 },
  date: { color: C.oliveLt, fontSize: 12, fontFamily: F.mono, marginTop: 6, marginBottom: 14 },
  p: { color: C.text, fontSize: 14, fontFamily: F.mono, lineHeight: 23, marginBottom: 14 },
  link: { color: C.oliveLt, textDecorationLine: 'underline' },
  h2: { color: C.sand, fontSize: 20, fontFamily: F.title, textTransform: 'uppercase', marginTop: 12, marginBottom: 8 },
  h3: { color: C.sand, fontSize: 17, fontFamily: F.h, textTransform: 'uppercase', marginTop: 10, marginBottom: 6 },
  liRow: { flexDirection: 'row', marginBottom: 6, paddingLeft: 4 },
  bullet: { color: C.oliveLt, fontSize: 16, marginRight: 8 },
  li: { color: C.text, fontSize: 14, fontFamily: F.mono, lineHeight: 22, flex: 1 },
  quote: { color: C.textDim, fontStyle: 'italic', fontSize: 14, fontFamily: F.mono, lineHeight: 22, borderLeftWidth: 3, borderLeftColor: C.olive, paddingLeft: 12, marginBottom: 14 },
  inlineImg: { width: '100%', height: 220, borderRadius: 10, marginBottom: 16, backgroundColor: C.bg2 },
  share: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: C.oliveLt, borderRadius: 10, paddingVertical: 12, marginTop: 16 },
  shareText: { color: C.oliveLt, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
});
