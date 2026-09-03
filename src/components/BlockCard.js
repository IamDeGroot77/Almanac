import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { SmallButton } from './Buttons';
import { describeBlockTime } from '../blocks';
import { useNow } from '../durations';

// The block you're in right now: "Work time until 4 PM", with the three tasks
// most worth starting from any list in that category.
export default function BlockCard({ block, next, category, nextCategory, color, picks, contextFor, onStart, onOpen, onJustOneThing }) {
  const now = useNow(true, 60000);
  if (!block && !next) return null;

  if (!block) {
    return (
      <Text style={styles.upNext}>
        Next block: {nextCategory?.name || 'a category'} time, {describeBlockTime(next)}
        {next.dayKey !== localDayKey(now) ? ' tomorrow' : ''}.
      </Text>
    );
  }

  const left = Math.max(0, Math.round((block.endMs - now) / 60000));
  const leftText = left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m left` : `${left}m left`;

  return (
    <View style={[styles.card, { borderColor: color }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[styles.kicker, { color }]}>{category?.name || 'Block'} time</Text>
          <Text style={styles.time}>
            {describeBlockTime(block)} · {leftText}
          </Text>
        </View>
        <SmallButton label="Just one thing" onPress={onJustOneThing} />
      </View>
      {picks.length === 0 ? (
        <Text style={styles.empty}>Nothing open on the {category?.name || ''} lists. Enjoy the quiet, or add something.</Text>
      ) : (
        picks.map((t) => (
          <View key={t.id} style={styles.row}>
            <TouchableOpacity style={styles.body} onPress={() => onOpen(t)} accessibilityRole="button">
              <Text style={styles.text}>{t.text}</Text>
              <Text style={styles.meta}>{contextFor(t)}</Text>
            </TouchableOpacity>
            <SmallButton label="Start" onPress={() => onStart(t.id)} />
          </View>
        ))
      )}
    </View>
  );
}

function localDayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: { marginTop: 20, padding: 14, borderRadius: 14, borderWidth: 2, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerText: { flex: 1, marginRight: 8 },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  time: { fontSize: 14, color: colors.muted, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
  body: { flex: 1 },
  text: { fontSize: 15, color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { fontSize: 14, color: colors.muted, paddingVertical: 6 },
  upNext: { marginTop: 14, fontSize: 13, color: colors.muted },
});
