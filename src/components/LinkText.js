import React from 'react';
import { Text, Linking } from 'react-native';
import { C } from '../theme';

// Текст с кликабельными ссылками (http/https). Переносы строк сохраняются.
export default function LinkText({ text, style, linkStyle }) {
  const parts = String(text || '').split(/(https?:\/\/[^\s)]+)/g);
  return (
    <Text style={style}>
      {parts.map((p, i) => /^https?:\/\//.test(p)
        ? <Text key={i} style={linkStyle || { color: C.oliveLt, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(p).catch(() => {})}>{p}</Text>
        : p)}
    </Text>
  );
}
