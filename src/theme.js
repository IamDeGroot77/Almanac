import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#FFFFFF',
  ink: '#1B1F24',
  muted: '#6B7280',
  line: '#E5E7EB',
  accent: '#1F5FA8',
  accentSoft: '#E6F4FE',
  warnSoft: '#FFF7E6',
  warn: '#B45309',
  danger: '#B91C1C',
};

export const shared = StyleSheet.create({
  muted: { color: colors.muted, fontSize: 15, marginBottom: 8 },
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
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
});
