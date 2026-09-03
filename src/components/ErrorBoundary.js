import { Component } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

// Catches a render error in one tab so the rest of the app stays up, and
// sends the stack to the dev server so it can be fixed.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`Render error in ${this.props.name || 'a screen'}:`, error?.message || error, info?.componentStack || '');
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>This screen hit an error.</Text>
        <Text style={styles.body}>{String(this.state.error?.message || this.state.error)}</Text>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ error: null })} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  body: { fontSize: 13, color: colors.muted, marginTop: 8 },
  button: { alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.accent },
  buttonText: { color: colors.onAccent, fontWeight: '600' },
});
