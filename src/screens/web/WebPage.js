import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme';

// Wide page body for the laptop-only screens.
export default function WebPage({ title, subtitle, actions, children, wide }) {
  return (
    <ScrollView contentContainerStyle={[styles.container, wide && styles.wide]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingBottom: 40, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  wide: { maxWidth: 1400 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, gap: 16 },
  headerText: { flex: 1 },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
