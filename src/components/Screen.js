import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Scrollable page body shared by every tab. On the web the content sits in
// a centred column so a wide laptop window reads like a page, not a banner.
export const CONTENT_MAX_WIDTH = 760;

export default function Screen({ children, refreshing, onRefresh }) {
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: 20,
    paddingBottom: 32,
    ...(Platform.OS === 'web' ? { maxWidth: CONTENT_MAX_WIDTH, width: '100%', alignSelf: 'center' } : {}),
  },
});
