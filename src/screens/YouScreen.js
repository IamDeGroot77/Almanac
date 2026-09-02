import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import Screen from '../components/Screen';
import InsightsScreen from './InsightsScreen';
import SettingsScreen from './SettingsScreen';

// Phone: Insights and Settings share one tab called You.
export default function YouScreen({ initial = 'insights', insightsProps, settingsProps }) {
  const [view, setView] = useState(initial);
  return (
    <Screen>
      <View style={styles.switch}>
        {[
          { id: 'insights', label: 'Insights' },
          { id: 'settings', label: 'Settings' },
        ].map((v) => (
          <TouchableOpacity key={v.id} style={[styles.item, view === v.id && styles.itemOn]} onPress={() => setView(v.id)} accessibilityRole="tab" accessibilityState={{ selected: view === v.id }}>
            <Text style={[styles.text, view === v.id && styles.textOn]}>{v.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {view === 'insights' ? <InsightsScreen {...insightsProps} embedded /> : <SettingsScreen {...settingsProps} embedded />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', alignSelf: 'flex-start', gap: 4, padding: 3, borderRadius: 999, backgroundColor: colors.accentSoft, marginBottom: 6 },
  item: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  itemOn: { backgroundColor: colors.bg },
  text: { fontSize: 14, fontWeight: '600', color: colors.muted },
  textOn: { color: colors.ink },
});
