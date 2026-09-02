import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, shared } from '../../theme';
import WebPage from './WebPage';
import { SmallButton } from '../../components/Buttons';
import { getValidAccessToken } from '../../google/auth';
import { makeDropBox, describeSize } from '../../drive/filesApi';

// Drop files here for the phone; files the phone sends appear in the list.
export default function FilesScreen({ google }) {
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [over, setOver] = useState(false);

  const refresh = useCallback(async () => {
    if (!google.account) return;
    setStatus('loading');
    setError(null);
    try {
      const token = await getValidAccessToken();
      if (!token) throw new Error('Sign in again to see the drop box.');
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

  const send = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    setStatus('uploading');
    try {
      const token = await getValidAccessToken();
      const box = makeDropBox(token);
      for (const f of list) await box.upload(f, 'laptop');
      await refresh();
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  };

  const open = async (f) => {
    try {
      const token = await getValidAccessToken();
      const blob = await makeDropBox(token).download(f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (f) => {
    try {
      const token = await getValidAccessToken();
      await makeDropBox(token).remove(f.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!google.account) {
    return (
      <WebPage title="Files">
        <Text style={shared.muted}>Sign in with Google in Settings to use the drop box.</Text>
      </WebPage>
    );
  }

  return (
    <WebPage
      title="Files"
      subtitle='A folder called "Almanac Drop" in your Drive. Drop files here for the phone; the phone sends things back the same way.'
      actions={<SmallButton label={status === 'loading' ? 'Loading…' : 'Refresh'} onPress={refresh} />}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          send(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${over ? colors.accent : colors.line}`,
          background: over ? colors.accentSoft : 'transparent',
          borderRadius: 12,
          padding: 28,
          textAlign: 'center',
          color: colors.muted,
          marginBottom: 16,
        }}
      >
        {status === 'uploading' ? 'Uploading…' : 'Drop files here, or '}
        {status !== 'uploading' ? (
          <label style={{ color: colors.accent, cursor: 'pointer', fontWeight: 600 }}>
            choose files
            <input type="file" multiple style={{ display: 'none' }} onChange={(e) => send(e.target.files)} />
          </label>
        ) : null}
      </div>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {files.length === 0 && status === 'idle' ? <Text style={shared.muted}>Nothing in the drop box yet.</Text> : null}

      {files.map((f) => (
        <View key={f.id} style={[styles.row, shared.hairline]}>
          <View style={styles.body}>
            <Text style={styles.name}>{f.name}</Text>
            <Text style={styles.meta}>
              {describeSize(f.size)} · {new Date(f.modifiedTime).toLocaleString()}
              {f.appProperties?.from ? ` · from ${f.appProperties.from}` : ''}
            </Text>
          </View>
          <SmallButton label="Download" onPress={() => open(f)} />
          <SmallButton label="Delete" onPress={() => remove(f)} />
        </View>
      ))}
    </WebPage>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  body: { flex: 1 },
  name: { fontSize: 15, color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  error: { color: colors.danger, marginBottom: 8 },
});
