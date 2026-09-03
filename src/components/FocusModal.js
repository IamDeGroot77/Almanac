import { useState } from 'react';
import { Modal, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import { colors } from '../theme';
import { PrimaryButton, SmallButton } from './Buttons';
import { formatDuration, useNow, elapsedFor } from '../durations';
import { APP_CATALOG } from '../apps';
import { isWeb } from '../platform';

// One task, full screen. Opens when you Start something. Everything else is
// out of sight, the timer is big, and for a phone-free task it offers to
// hand off to a focus or timer app.
export default function FocusModal({ task, nextStep, stepsSummary, prefs, session, onStartSession, onEndSession, onFocusmate, onPause, onFinish, onFinishStep, onPhoneFree, onClose }) {
  const [handoffNote, setHandoffNote] = useState('');
  const now = useNow(!!task, 1000);
  if (!task) return null;

  const elapsed = elapsedFor(task, now) || 0;
  const est = task.estimateMs || 0;
  const pct = est ? Math.min(1, elapsed / est) : 0;
  const over = est && elapsed > est;

  const focusApp = APP_CATALOG.find((a) => a.id === prefs.focusApp) || null;
  const timerApp = APP_CATALOG.find((a) => a.id === prefs.timerApp) || null;

  const open = (app) => {
    if (isWeb) {
      setHandoffNote('Hand-off to apps works on the phone.');
      return;
    }
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
          <Text style={styles.kicker}>{nextStep ? 'Next smallest step' : 'Right now'}</Text>
          {nextStep ? (
            <View style={styles.stepBlock}>
              <Text style={styles.task}>{nextStep.text}</Text>
              <Text style={styles.parent}>
                {task.text}
                {stepsSummary ? ` · ${stepsSummary}` : ''}
              </Text>
              <TouchableOpacity style={styles.stepDone} onPress={() => onFinishStep(nextStep.id)} accessibilityRole="button">
                <Text style={styles.stepDoneText}>Step done ✓</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.task}>{task.text}</Text>
          )}
          <Text style={[styles.timer, over && styles.timerOver]}>{est ? (over ? `+${formatDuration(elapsed - est) || '0m'}` : `${formatDuration(est - elapsed) || '<1m'}`) : formatDuration(elapsed) || '0m'}</Text>
          {est ? <Text style={styles.timerLabel}>{over ? 'over the estimate' : 'left'}</Text> : null}
          {est ? (
            <View style={styles.estimate}>
              <View style={styles.track}>
                <View style={[styles.fill, over && styles.fillOver, { width: `${Math.round((over ? 1 : 1 - pct) * 100)}%` }]} />
              </View>
              <Text style={styles.estimateText}>
                {over ? `Past the ~${formatDuration(est)} estimate. Stop, or go again.` : `${formatDuration(elapsed) || '0m'} in, of ~${formatDuration(est)}. The bar shrinks.`}
              </Text>
            </View>
          ) : (
            <Text style={styles.estimateText}>No estimate. Long-press the task later to add one.</Text>
          )}
        </View>

        {task.plan ? <Text style={styles.plan}>📍 {task.plan}</Text> : null}

        <View style={styles.sessionRow}>
          {session && session.taskId === task.id ? (
            <View style={styles.sessionLive}>
              <Text style={styles.sessionText}>
                {session.ended
                  ? session.minutes + '-minute block done. Again, or finish?'
                  : 'Block ends ' +
                    new Date(session.endsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) +
                    ' · ' +
                    Math.max(0, Math.ceil((session.endsAt - now) / 60000)) +
                    ' min left'}
              </Text>
              <SmallButton label={session.ended ? 'Clear' : 'Stop block'} onPress={onEndSession} />
            </View>
          ) : (
            <View style={styles.sessionPick}>
              <Text style={styles.sessionLabel}>Work in a block</Text>
              <SmallButton label="25 min" onPress={() => onStartSession(task, 25)} />
              <SmallButton label="50 min" onPress={() => onStartSession(task, 50)} />
              <SmallButton label="Focusmate" onPress={onFocusmate} />
            </View>
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

        <View style={styles.buttons}>
          <SmallButton label="Pause" onPress={() => onPause(task.id)} style={styles.pause} />
          <PrimaryButton label="Finish" onPress={() => onFinish(task.id)} style={styles.finish} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  timerLabel: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: -6, marginBottom: 8 },
  screen: { flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 48 },
  back: { alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: colors.accent, fontWeight: '600', fontSize: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  kicker: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  task: { fontSize: 24, fontWeight: '700', color: colors.ink, textAlign: 'center', marginTop: 8 },
  stepBlock: { alignItems: 'center' },
  parent: { fontSize: 14, color: colors.muted, marginTop: 6, textAlign: 'center' },
  stepDone: { marginTop: 10, borderWidth: 1, borderColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  stepDoneText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  timer: { fontSize: 64, fontWeight: '800', color: colors.accent, marginTop: 24, fontVariant: ['tabular-nums'] },
  timerOver: { color: colors.warn },
  estimate: { width: '80%', marginTop: 12, alignItems: 'center' },
  track: { width: '100%', height: 6, borderRadius: 3, backgroundColor: colors.line },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  fillOver: { backgroundColor: colors.warn },
  estimateText: { fontSize: 13, color: colors.muted, marginTop: 8, textAlign: 'center' },
  plan: { fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: 10 },
  sessionRow: { marginBottom: 14 },
  sessionPick: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  sessionLabel: { fontSize: 13, color: colors.muted, marginRight: 4 },
  sessionLive: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sessionText: { flex: 1, fontSize: 13, color: colors.accent, fontWeight: '600' },
  phoneFree: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 16, marginBottom: 16 },
  phoneFreeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phoneFreeLabel: { fontSize: 16, fontWeight: '600', color: colors.ink },
  phoneFreeHint: { fontSize: 13, color: colors.muted, marginTop: 6 },
  apps: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  note: { fontSize: 13, color: colors.accent, marginTop: 8 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pause: { paddingVertical: 12, paddingHorizontal: 18 },
  finish: { flex: 1, paddingVertical: 14 },
});
