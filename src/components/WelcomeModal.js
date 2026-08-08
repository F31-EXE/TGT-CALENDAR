import React, { useState, useEffect } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';

const KEY = 'seen_welcome';

export default function WelcomeModal({ onOpenGuide }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => { if (!v) setShow(true); }).catch(() => {});
  }, []);

  const dismiss = () => {
    AsyncStorage.setItem(KEY, '1').catch(() => {});
    setShow(false);
  };
  const openGuide = () => { dismiss(); onOpenGuide && onOpenGuide(); };

  if (!show) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badge}><Ionicons name="skull" size={30} color={C.oliveLt} /></View>
          <Text style={styles.brand}>THE GRIM TEAM</Text>
          <Text style={styles.title}>Календарь страйкбола Урала</Text>
          <Text style={styles.text}>Игры, полигоны, барахолка и справочники в одном месте. Впервые в страйкболе? Мы собрали короткий гайд, как приехать на первую игру.</Text>
          <Pressable style={[styles.btn, styles.primary]} onPress={openGuide}>
            <Ionicons name="walk" size={16} color={C.white} />
            <Text style={styles.primaryText}>Я новичок — открыть гайд</Text>
          </Pressable>
          <Pressable style={[styles.btn, styles.ghost]} onPress={dismiss}>
            <Text style={styles.ghostText}>Уже в теме</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: { width: '100%', maxWidth: 360, backgroundColor: C.bg2, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 24, alignItems: 'center' },
  badge: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: C.olive, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brand: { color: C.sand, fontSize: 20, fontFamily: F.title, textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: C.oliveLt, fontSize: 13, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  text: { color: C.text, fontSize: 14, fontFamily: F.mono, textAlign: 'center', lineHeight: 20, marginTop: 14 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 10, paddingVertical: 13, width: '100%', marginTop: 12 },
  primary: { backgroundColor: C.olive },
  primaryText: { color: C.white, fontFamily: F.h, fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  ghost: { paddingVertical: 8 },
  ghostText: { color: C.textDim, fontFamily: F.mono, fontSize: 13 },
});
