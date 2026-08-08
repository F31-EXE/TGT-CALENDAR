import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F, TAG_COLORS } from '../theme';
import { ekbDateKey, fmtDayFull, fmtTime, parseTags } from '../api';
import { Tag } from '../ui';

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export default function CalendarView({ games, onSelectGame }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selDay, setSelDay] = useState(null);

  const byDay = useMemo(() => {
    const map = {};
    for (const g of games) {
      const k = ekbDateKey(g.startDate || g.date);
      if (!k) continue;
      (map[k] = map[k] || []).push(g);
    }
    return map;
  }, [games]);

  const y = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Пн-первый
  const daysIn = new Date(y, m + 1, 0).getDate();
  const todayKey = ekbDateKey(new Date().toISOString());

  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ d, key, has: !!byDay[key], today: key === todayKey });
  }

  const shift = (delta) => { setMonth(new Date(y, m + delta, 1)); setSelDay(null); };
  const dayGames = selDay ? (byDay[selDay] || []) : [];

  return (
    <View>
      <View style={styles.head}>
        <Pressable onPress={() => shift(-1)} hitSlop={10}><Ionicons name="chevron-back" size={22} color={C.oliveLt} /></Pressable>
        <Text style={styles.title}>{MONTHS[m]} {y}</Text>
        <Pressable onPress={() => shift(1)} hitSlop={10}><Ionicons name="chevron-forward" size={22} color={C.oliveLt} /></Pressable>
      </View>

      <View style={styles.grid}>
        {WD.map(w => <Text key={w} style={styles.wd}>{w}</Text>)}
        {cells.map((c, i) => {
          if (!c) return <View key={'e' + i} style={styles.cell} />;
          const sel = selDay === c.key;
          return (
            <Pressable key={c.key} style={styles.cell} onPress={() => c.has && setSelDay(sel ? null : c.key)}>
              <View style={[styles.day, c.today && styles.today, sel && styles.sel]}>
                <Text style={[styles.dayNum, (c.today || sel) && styles.dayNumOn]}>{c.d}</Text>
              </View>
              {c.has ? <View style={styles.dot} /> : <View style={styles.dotEmpty} />}
            </Pressable>
          );
        })}
      </View>

      {selDay && (
        <View style={styles.dayList}>
          <Text style={styles.dayTitle}>{fmtDayFull(selDay)}</Text>
          {dayGames.map(g => (
            <Pressable key={g.id} style={styles.gameRow} onPress={() => onSelectGame(g)}>
              <Text style={styles.gameTime}>{fmtTime(g.startDate || g.date)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.gameName}>{g.title}</Text>
                {!!g.location && <Text style={styles.gameLoc}>{g.location}</Text>}
                <View style={styles.tags}>{parseTags(g.tags).map(t => <Tag key={t} label={t} color={TAG_COLORS[t]} />)}</View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textDim} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 6 },
  title: { color: C.sand, fontSize: 19, fontFamily: F.title, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', color: C.textDim, fontSize: 11, fontFamily: F.mono, marginBottom: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 },
  day: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1, borderColor: C.oliveLt },
  sel: { backgroundColor: C.olive },
  dayNum: { color: C.text, fontSize: 15, fontFamily: F.med },
  dayNumOn: { color: C.white },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.oliveLt, marginTop: 3 },
  dotEmpty: { height: 6, marginTop: 3 },
  dayList: { marginTop: 14, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  dayTitle: { color: C.sand, fontSize: 15, fontFamily: F.h, marginBottom: 10, textTransform: 'uppercase' },
  gameRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8, gap: 10 },
  gameTime: { color: C.oliveLt, fontSize: 14, fontFamily: F.mono, width: 44 },
  gameName: { color: C.sand, fontSize: 15, fontFamily: F.h, textTransform: 'uppercase' },
  gameLoc: { color: C.textDim, fontSize: 12, fontFamily: F.mono, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
});
