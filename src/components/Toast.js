import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

// A brief line that fades in above the tab bar and drifts away.
export default function Toast({ toast }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    rise.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }, 1800);
    return () => clearTimeout(t);
  }, [toast, opacity, rise]);

  if (!toast) return null;
  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY: rise }] }]} pointerEvents="none">
      <Text style={styles.text}>{toast.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 130,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 4,
  },
  text: { color: colors.onAccent, fontWeight: '700', fontSize: 14 },
});
