import { useState } from 'react';
import { Modal, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { colors } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';
import { formatDuration, useNow } from '../durations';
import { APP_CATALOG } from '../apps';

// One task, full screen. Opens when you Start something. Everything else is
// out of sight, the timer is big, and for a phone-free task it offers to
// hand off to a focus or timer app.
export default function FocusModal({ task, prefs, onFinish, onPhoneFree, onClose }) {
  const [handoffNote, setHandoffNote] = useState('');
  const now = useNow(!!task, 1000);
  if (!task) return null;

  const elapsed = task.startedAt ? now - task.startedAt : 0;
  const est = task.estimateMs || 0;
  const pct = est ? Math.min(1, elapsed / est) : 0;
  const over = est && elapsed > est;

  const focusApp = APP_CATALOG.find((a) => a.id === prefs.focusApp) || null;
  const timerApp = APP_CATALOG.find((a) => a.id === prefs.timerApp) || null;

  const open = (app) => {
    try {
      IntentLauncher.openApplication(app.package);
      setHandoffNote(`Opening ${app.name}. The timer here keeps running.`);
    } catch (err) {
      setHandoffNote(`${app.name} isn't installed on this phone.`);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <TouchableOpacity onPress={onClose} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>‹ Back to the list</Text>
        </TouchableOpacity>

        <View style={styles.center}>
          <Text style={styles.kicker}>Right now</Text>
          <Text style={styles.task}>{task.text}</Text>
          <Text style={[styles.timer, over && styles.timerOver]}>{formatDuration(elapsed) || '0m'}</Text>
          {est ? (
            <View style={styles.estimate}>
              <View style={styles.track}>
                <View style={[styles.fill, over && styles.fillOver, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
              <Text style={styles.estimateText}>
                {over ? `Past the ~${formatDuration(est)} estimate` : `of ~${formatDuration(est)} estimated`}
              </Text>
            </View>
          ) : (
            <Text style={styles.estimateText}>No estimate. Long-press the task later to add one.</Text>
          )}
        </View>

        <View style={styles.phoneFree}>
          <View style={styles.phoneFreeRow}>
            <Text style={styles.phoneFreeLabel}>Phone-free task</Text>
            <Switch value={!!task.phoneFree} onValueChange={(v) => onPhoneFree(task.id, v)} />
          </View>
          {task.phoneFree ? (
            <View>
              <Text style={styles.phoneFreeHint}>
                Hand the timing off and put the phone down. Almanac keeps counting.
              </Text>
              <View style={styles.apps}>
                {focusApp && <SmallButton label={`Open ${focusApp.name}`} onPress={() => open(focusApp)} />}
                {timerApp && <SmallButton label={`Open ${timerApp.name}`} onPress={() => open(timerApp)} />}
                {!focusApp && !timerApp && (
                  <Text style={styles.phoneFreeHint}>Pick a focus or timer app in Settings.</Text>
                )}
              </View>
              {handoffNote ? <Text style={styles.note}>{handoffNote}</Text> : null}
            </View>
          ) : (
            <Text style={styles.phoneFreeHint}>Turn on for tasks where the phone is only a distraction.</Text>
          )}
        </View>

        <PrimaryButton label="Finish" onPress={() => onFinish(task.id)} style={styles.finish} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 48 },
  back: { alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: colors.accent, fontWeight: '600', fontSize: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  task: { fontSize: 24, fontWeight: '700', color: colors.ink, textAlign: 'center', marginTop: 8 },
  timer: { fontSize: 64, fontWeight: '800', color: colors.accent, marginTop: 24, fontVariant: ['tabular-nums'] },
  timerOver: { color: colors.warn },
  estimate: { width: '80%', marginTop: 12, alignItems: 'center' },
  track: { width: '100%', height: 6, borderRadius: 3, backgroundColor: colors.line },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  fillOver: { backgroundColor: colors.warn },
  estimateText: { fontSize: 13, color: colors.muted, marginTop: 8, textAlign: 'center' },
  phoneFree: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 16, marginBottom: 16 },
  phoneFreeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phoneFreeLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
  phoneFreeHint: { fontSize: 13, color: colors.muted, marginTop: 6 },
  apps: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  note: { fontSize: 13, color: colors.accent, marginTop: 8 },
  finish: { alignSelf: 'stretch', paddingVertical: 14 },
});
