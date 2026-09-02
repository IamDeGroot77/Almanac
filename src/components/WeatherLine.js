import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { describeCode } from '../weather';
import { formatTime } from '../dates';

// One line under the date: temperature, sky, rain chance, sunrise and sunset
// for the day being shown.
export default function WeatherLine({ forecast, dayKey, isToday }) {
  if (!forecast) return null;
  const day = forecast.days.find((d) => d.date === dayKey);
  if (!day) return null;
  const parts = [];
  if (isToday && forecast.current) parts.push(`${forecast.current.temp}° now`);
  parts.push(`${day.high}° / ${day.low}°`);
  const sky = describeCode(isToday && forecast.current ? forecast.current.code : day.code);
  if (sky) parts.push(sky);
  if (day.rain != null && day.rain >= 20) parts.push(`${day.rain}% rain`);
  const sun = day.sunrise && day.sunset ? `☀ ${formatTime(day.sunrise)} – ${formatTime(day.sunset)}` : null;
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{parts.join(' · ')}</Text>
      {sun ? <Text style={styles.sun}>{sun}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  text: { fontSize: 13, color: colors.muted },
  sun: { fontSize: 13, color: colors.muted },
});
