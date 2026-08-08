import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Share, AppState } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { onAchievementCheck, pullNewlyUnlocked, TIER_COLORS } from '../achievements';
import { SITE_ORIGIN } from '../api';

function Glyph({ lib, name, size, color }) {
  const Set = lib === 'mci' ? MaterialCommunityIcons : Ionicons;
  return <Set name={name} size={size} color={color} />;
}

export default function AchievementUnlockToast() {
  const [queue, setQueue] = useState([]);
  const timer = useRef(null);
  const running = useRef(false);

  const runCheck = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (running.current) return;
      running.current = true;
      try {
        const fresh = await pullNewlyUnlocked();
        if (fresh.length) setQueue(q => [...q, ...fresh]);
      } catch (e) {} finally { running.current = false; }
    }, 700);
  };

  useEffect(() => {
    const off = onAchievementCheck(runCheck);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') runCheck(); });
    const t = setTimeout(runCheck, 1500); // первичная проверка при запуске
    return () => { off(); sub.remove(); clearTimeout(t); if (timer.current) clearTimeout(timer.current); };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const tc = TIER_COLORS[current.tier] || TIER_COLORS.special;
  const next = () => setQueue(q => q.slice(1));
  const share = async () => {
    try {
      await Share.share({ message: `🏅 Открыл награду «${current.title}» в THE GRIM TEAM!\nСтрайкбол Урала → ${SITE_ORIGIN}` });
    } catch (e) {}
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={next}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>Награда получена</Text>
          <View style={[styles.medal, { borderColor: tc.ring, shadowColor: tc.ring }]}>
            <Glyph lib={current.lib} name={current.icon} size={46} color={tc.ring} />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.desc}>{current.desc}</Text>
          {queue.length > 1 && <Text style={styles.more}>Ещё наград: {queue.length - 1}</Text>}
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.share]} onPress={share}>
              <Ionicons name="share-social" size={16} color={C.white} />
              <Text style={styles.shareText}>В ВК</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.ok]} onPress={next}>
              <Text style={styles.okText}>Круто!</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 340, backgroundColor: C.bg2, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: 'center' },
  kicker: { color: C.oliveLt, fontSize: 12, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 18 },
  medal: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.7, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  title: { color: C.sand, fontSize: 22, fontFamily: F.title, textTransform: 'uppercase', textAlign: 'center', marginTop: 18 },
  desc: { color: C.textDim, fontSize: 13, fontFamily: F.mono, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  more: { color: C.oliveLt, fontSize: 11, fontFamily: F.mono, marginTop: 12 },
  row: { flexDirection: 'row', gap: 10, marginTop: 22, width: '100%' },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 10 },
  share: { backgroundColor: '#4a76a8' },
  shareText: { color: C.white, fontFamily: F.h, fontSize: 14, textTransform: 'uppercase' },
  ok: { backgroundColor: C.olive },
  okText: { color: C.white, fontFamily: F.h, fontSize: 14, textTransform: 'uppercase' },
});
