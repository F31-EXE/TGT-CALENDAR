import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, Animated, Easing, StyleSheet, AccessibilityInfo } from 'react-native';
import { C, F } from '../theme';
import { loadGames } from '../api';

// Заставка при запуске: логотип и ползунок в сигнальную полоску на том же фоне,
// что и нативная заставка (#191c13), — переход незаметен. Держится не меньше
// MIN_MS, исчезает после загрузки игр; страховка — MAX_MS.
const MIN_MS = 1800;

// Другие окна (приветствие, вход через ВК) ждут, пока заставка уйдёт.
let resolveDone;
export const splashDone = new Promise(r => { resolveDone = r; });
const MAX_MS = 8000;
const BAR_W = 220;
const STRIPE = 14;

export default function LoadingSplash() {
  const [gone, setGone] = useState(false);
  const fill = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let done = false;
    const t0 = Date.now();
    const loop = Animated.loop(Animated.timing(shift, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true }));
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => { if (!reduce) loop.start(); }).catch(() => loop.start());
    Animated.timing(fill, { toValue: 0.85, duration: MIN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();

    const finish = () => {
      if (done) return; done = true;
      const wait = Math.max(0, MIN_MS - (Date.now() - t0));
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(fill, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(fade, { toValue: 0, duration: 450, useNativeDriver: true }),
        ]).start(() => { loop.stop(); setGone(true); resolveDone(); });
      }, wait);
    };
    loadGames().then(finish, finish);
    const safety = setTimeout(finish, MAX_MS);
    return () => { clearTimeout(safety); loop.stop(); resolveDone(); };
  }, [fill, shift, fade]);

  if (gone) return null;

  const stripes = Array.from({ length: Math.ceil(BAR_W / STRIPE) + 4 });
  return (
    <Animated.View style={[styles.wrap, { opacity: fade }]} pointerEvents="none">
      <Image source={require('../../assets/logo-splash.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>THE GRIM <Text style={{ color: C.oliveLt }}>TEAM</Text></Text>
      <Text style={styles.sub}>КАЛЕНДАРЬ ИГР</Text>
      <View style={styles.bar}>
        <Animated.View style={[styles.fill, { transform: [{ translateX: -BAR_W / 2 }, { scaleX: fill }, { translateX: BAR_W / 2 }] }]}>
          <Animated.View style={[styles.stripes, { transform: [{ translateX: shift.interpolate({ inputRange: [0, 1], outputRange: [-STRIPE * 2, 0] }) }, { skewX: '-45deg' }] }]}>
            {stripes.map((_, i) => <View key={i} style={[styles.stripe, i % 2 ? styles.dark : styles.yellow]} />)}
          </Animated.View>
        </Animated.View>
      </View>
      <Text style={styles.status}>ЗАГРУЗКА ДАННЫХ</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, zIndex: 2000, backgroundColor: '#191c13', alignItems: 'center', justifyContent: 'center' },
  logo: { width: 150, height: 132, marginBottom: 18 },
  title: { color: C.white, fontFamily: F.title, fontSize: 28, letterSpacing: 3 },
  sub: { color: C.textDim, fontFamily: F.mono, fontSize: 12, letterSpacing: 4, marginTop: 4 },
  bar: { width: BAR_W, height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 28, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  fill: { width: BAR_W, height: '100%', overflow: 'hidden' },
  stripes: { flexDirection: 'row', height: '100%', marginLeft: -STRIPE },
  stripe: { width: STRIPE, height: '100%' },
  yellow: { backgroundColor: '#f6c500' },
  dark: { backgroundColor: '#1a1a1a' },
  status: { color: C.oliveLt, fontFamily: F.mono, fontSize: 11, letterSpacing: 2, marginTop: 12 },
});
