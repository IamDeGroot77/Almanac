import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

// The phone keeps four tabs. The laptop adds the planning views that want a
// big screen and a keyboard.
const PHONE_TABS = [
  { id: 'today', label: 'Today', icon: '☀' },
  { id: 'lists', label: 'Lists', icon: '☰' },
  { id: 'journal', label: 'Journal', icon: '✎' },
  { id: 'insights', label: 'Insights', icon: '◑' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

const WEB_TABS = [
  { id: 'today', label: 'Today', icon: '☀' },
  { id: 'planner', label: 'Week', icon: '▦' },
  { id: 'calendar', label: 'Calendar', icon: '▤' },
  { id: 'semester', label: 'Semester', icon: '▥' },
  { id: 'lists', label: 'Lists', icon: '☰' },
  { id: 'journal', label: 'Journal', icon: '✎' },
  { id: 'insights', label: 'Dashboard', icon: '◑' },
  { id: 'files', label: 'Files', icon: '⇅' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export const TABS = Platform.OS === 'web' ? WEB_TABS : PHONE_TABS;

export default function TabBar({ active, onSelect }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.inner}>
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onSelect(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Text style={[styles.icon, isActive && styles.active]}>{tab.icon}</Text>
              <Text style={[styles.label, isActive && styles.active]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
    paddingTop: 8,
  },
  inner: {
    flexDirection: 'row',
    flex: 1,
    ...(Platform.OS === 'web' ? { maxWidth: 1100, alignSelf: 'center', width: '100%' } : {}),
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  icon: { fontSize: 20, color: colors.muted, lineHeight: 24 },
  label: { fontSize: 11, fontWeight: '600', color: colors.muted, marginTop: 2 },
  active: { color: colors.accent },
});
