import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { C, F } from '../theme';

export default function NameModal({
  visible, onCancel, onSubmit, initial = '',
  title = 'Как вас представить?',
  hint = 'Имя увидят другие участники в списке «Пойдут».',
  placeholder = 'Например: Илья / Старый',
  maxLength = 40,
  allowEmpty = false,
}) {
  const [name, setName] = useState(initial);
  useEffect(() => { setName(initial); }, [initial, visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.hint}>{hint}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={placeholder}
            placeholderTextColor={C.textDim}
            maxLength={maxLength}
            autoFocus
          />
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.primary]} onPress={() => (allowEmpty || name.trim()) && onSubmit(name.trim())}>
              <Text style={styles.primaryText}>Сохранить</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.outline]} onPress={onCancel}>
              <Text style={styles.outlineText}>Отмена</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: C.bg2, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 20 },
  title: { color: C.sand, fontSize: 19, fontFamily: F.title, textTransform: 'uppercase' },
  hint: { color: C.textDim, fontSize: 13, fontFamily: F.mono, marginTop: 6, marginBottom: 14 },
  input: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 8, color: C.text, fontSize: 16, fontFamily: F.mono, paddingHorizontal: 14, paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primary: { backgroundColor: C.olive },
  primaryText: { color: C.white, fontFamily: F.h, textTransform: 'uppercase' },
  outline: { borderWidth: 1, borderColor: C.border },
  outlineText: { color: C.textDim, fontFamily: F.h, textTransform: 'uppercase' },
});
