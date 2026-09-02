import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import Ionicons from '@expo/vector-icons/Ionicons';

// The phone keeps its tabs short. On the laptop, Today, Week, Month, and
// Semester live inside one Calendar tab with a view switch.
const PHONE_TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'today', label: 'Today', icon: 'sunny' },
  { id: 'lists', label: 'Lists', icon: 'list' },
  { id: 'journal', label: 'Journal', icon: 'book' },
  { id: 'insights', label: 'Insights', icon: 'stats-chart' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const WEB_TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'lists', label: 'Lists', icon: 'list' },
  { id: 'journal', label: 'Journal', icon: 'book' },
  { id: 'insights', label: 'Dashboard', icon: 'stats-chart' },
  { id: 'files', label: 'Files', icon: 'swap-vertical' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
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
              <Ionicons name={isActive ? tab.icon : `${tab.icon}-outline`} size={22} color={isActive ? colors.accent : colors.muted} />
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
