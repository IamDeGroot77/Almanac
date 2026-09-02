import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { colors, shared } from '../theme';
import Screen from '../components/Screen';
import GoogleSection from '../components/GoogleSection';
import DevSection from '../components/DevSection';
import PersonChips from '../components/PersonChips';
import { reminderMessage } from '../notifications';

export default function SettingsScreen({ google, sync, reminderStatus, people, onAddPerson, onStageReview }) {
  const version = Constants.expoConfig?.version || '';
  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily brief</Text>
        <Text style={shared.muted}>{reminderMessage(reminderStatus) || 'Setting up the 6:30 AM reminder…'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>People</Text>
        <Text style={shared.muted}>Tasks and lists can be tagged for any of these.</Text>
        <PersonChips people={people} selected={null} onSelect={() => {}} onAdd={onAddPerson} compact />
      </View>

      <GoogleSection auth={google} sync={sync} />

      {__DEV__ && <DevSection onStageReview={onStageReview} />}

      <Text style={styles.footer}>Almanac {version}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  section: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  footer: { marginTop: 32, fontSize: 13, color: colors.muted, textAlign: 'center' },
});
