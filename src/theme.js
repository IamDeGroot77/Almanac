import { StyleSheet, Appearance } from 'react-native';

// Two palettes. Which one is active is decided once, before any component's
// StyleSheet is created (see index.js), because StyleSheet.create bakes the
// values in. Changing the theme therefore takes effect on the next launch.

const LIGHT = {
  bg: '#FFFFFF',
  ink: '#1B1F24',
  muted: '#6B7280',
  line: '#E5E7EB',
  accent: '#1F5FA8',
  accentSoft: '#E6F4FE',
  warnSoft: '#FFF7E6',
  warn: '#B45309',
  danger: '#B91C1C',
  onAccent: '#FFFFFF',
  scheme: 'light',
};

const DARK = {
  bg: '#0F141A',
  ink: '#ECEFF3',
  muted: '#9AA3AF',
  line: '#2A3340',
  accent: '#6FB1FF',
  accentSoft: '#173052',
  warnSoft: '#3A2A10',
  warn: '#F4B860',
  danger: '#FF7B7B',
  onAccent: '#0F141A',
  scheme: 'dark',
};

// Mutable in place so every module that imported `colors` sees the palette.
export const colors = { ...LIGHT };

export function applyTheme(preference) {
  const scheme = preference === 'dark' || preference === 'light' ? preference : Appearance.getColorScheme() || 'light';
  Object.assign(colors, scheme === 'dark' ? DARK : LIGHT);
  return scheme;
}

export const shared = StyleSheet.create({
  muted: { color: colors.muted, fontSize: 15, marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.bg, padding: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, letterSpacing: -0.2 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  hairline: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.ink,
  },
  smallButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallButtonText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.onAccent, fontWeight: '600', fontSize: 15 },
});
