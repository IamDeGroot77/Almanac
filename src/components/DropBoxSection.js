import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { colors, shared } from '../theme';
import { SmallButton } from './Buttons';
import { getValidAccessToken } from '../google/auth';
import { makeDropBox, describeSize } from '../drive/filesApi';

// Phone side of the drop box: see what the laptop sent and open it in
// Drive. Sending from the phone arrives with the next build (file picker).
export default function DropBoxSection({ google }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!google.account) return;
    setStatus('loading');
    setError(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Reconnect Google to see the drop box.');
      setFiles(await makeDropBox(token).list());
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }, [google.account]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!google.account) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title}>From the laptop</Text>
        <SmallButton label={status === 'loading' ? 'Loading…' : 'Refresh'} onPress={refresh} />
      </View>
      <Text style={shared.muted}>Files dropped into Almanac on the laptop. Tap one to open it in Drive.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {files.length === 0 && status === 'idle' ? <Text style={styles.meta}>Nothing waiting.</Text> : null}
      {files.map((f) => (
        <View key={f.id} style={[styles.row, shared.hairline]}>
          <View style={styles.body}>
            <Text style={styles.name} onPress={() => f.webViewLink && Linking.openURL(f.webViewLink)}>
              {f.name}
            </Text>
            <Text style={styles.meta}>
              {describeSize(f.size)} · {new Date(f.modifiedTime).toLocaleDateString()}
              {f.appProperties?.from ? ` · from ${f.appProperties.from}` : ''}
            </Text>
          </View>
          <SmallButton label="Open" onPress={() => f.webViewLink && Linking.openURL(f.webViewLink)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 36, paddingTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: colors.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  body: { flex: 1 },
  name: { fontSize: 15, color: colors.accent },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  error: { color: colors.danger, fontSize: 13, marginTop: 6 },
});
