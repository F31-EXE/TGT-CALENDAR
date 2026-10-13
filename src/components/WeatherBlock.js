import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, F } from '../theme';
import { loadGameWeather, weatherLabel, weatherTip } from '../weather';

// Прогноз погоды на время начала игры (Open-Meteo).
export default function WeatherBlock({ game }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    loadGameWeather(game)
      .then(r => { if (alive) setState({ loading: false, ...r }); })
      .catch(() => { if (alive) setState({ loading: false, status: 'error' }); });
    return () => { alive = false; };
  }, [game]);

  if (state.loading) {
    return <View style={styles.box}><ActivityIndicator size="small" color={C.oliveLt} /></View>;
  }
  if (state.status === 'past' || state.status === 'error') return null;
  if (state.status === 'far') {
    return (
      <View style={styles.box}>
        <Ionicons name="partly-sunny-outline" size={18} color={C.textDim} />
        <Text style={styles.far}>Прогноз погоды появится за 2 недели до игры</Text>
      </View>
    );
  }

  const w = state.weather;
  const label = weatherLabel(w.code);
  const tip = weatherTip(w);
  return (
    <View style={styles.box}>
      <View style={styles.main}>
        <Ionicons name={label.icon} size={34} color={C.sand} />
        <View style={{ flex: 1 }}>
          <Text style={styles.temp}>{w.temp > 0 ? '+' : ''}{w.temp}°</Text>
          <Text style={styles.label}>{label.text}</Text>
        </View>
        {w.tmin != null && w.tmax != null && (
          <Text style={styles.range}>днём {w.tmin}…{w.tmax}°</Text>
        )}
      </View>
      <View style={styles.stats}>
        <Stat icon="umbrella" text={`Осадки ${w.precipProb}%`} />
        <Stat icon="flag" text={`Ветер ${w.wind} м/с${w.gust && w.gust > w.wind + 2 ? `, порывы ${w.gust}` : ''}`} />
      </View>
      {!!tip && <Text style={styles.tip}>{tip}</Text>}
      <Text style={styles.note}>
        {state.approx ? 'Прогноз на начало игры для Екатеринбурга — координаты полигона не указаны' : 'Прогноз на начало игры для места проведения'}
      </Text>
    </View>
  );
}

function Stat({ icon, text }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={13} color={C.oliveLt} />
      <Text style={styles.statText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginTop: 4, marginBottom: 12, flexDirection: 'column', gap: 8 },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  temp: { color: C.sand, fontSize: 26, fontFamily: F.title, lineHeight: 30 },
  label: { color: C.text, fontSize: 13, fontFamily: F.mono },
  range: { color: C.textDim, fontSize: 12, fontFamily: F.mono },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { color: C.text, fontSize: 13, fontFamily: F.mono },
  tip: { color: C.oliveLt, fontSize: 12, fontFamily: F.mono, lineHeight: 17 },
  note: { color: C.textDim, fontSize: 11, fontFamily: F.mono },
  far: { color: C.textDim, fontSize: 13, fontFamily: F.mono, flex: 1 },
});
