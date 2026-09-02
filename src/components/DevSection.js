import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SmallButton } from './Buttons';
import { colors, shared } from '../theme';
import { sendTestReminder } from '../notifications';

// Only rendered when running from the dev server (__DEV__). Lets you poke at
// things that otherwise need the clock to move.
export default function DevSection({ onStageReview }) {
  const [note, setNote] = useState('');

  const stageReview = () => {
    onStageReview();
    setNote("Today's open tasks moved to yesterday. Scroll up for the review card.");
  };

  const fireReminder = async () => {
    try {
      const result = await sendTestReminder();
      setNote(
        result === 'sent'
          ? 'Reminder sent. Check the notification shade.'
          : 'Notifications are turned off for Almanac.'
      );
    } catch (err) {
      setNote(`Reminder failed: ${err.message}`);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Developer</Text>
      <View style={shared.row}>
        <SmallButton label="Stage start-of-day review" onPress={stageReview} />
        <SmallButton label="Send reminder now" onPress={fireReminder} />
      </View>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 6 },
  note: { marginTop: 8, fontSize: 13, color: colors.muted },
});
