import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

// A settings group: one line closed, everything inside when open.
export default function Collapsible({ title, summary, children, open: initialOpen = false, alert = false }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <View style={styles.group}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {summary && !open ? <Text style={[styles.summary, alert && styles.alert]}>{summary}</Text> : null}
        </View>
        <Text style={styles.chev}>{open ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  headerText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: colors.ink },
  summary: { fontSize: 13, color: colors.muted, marginTop: 2 },
  alert: { color: colors.danger },
  chev: { fontSize: 18, color: colors.muted, marginLeft: 10 },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
});
