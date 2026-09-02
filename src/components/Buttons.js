import { Text, TouchableOpacity } from 'react-native';
import { shared } from '../theme';

export function SmallButton({ label, onPress, style }) {
  return (
    <TouchableOpacity
      style={[shared.smallButton, style]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={shared.smallButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function PrimaryButton({ label, onPress, style }) {
  return (
    <TouchableOpacity
      style={[shared.primaryButton, style]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={shared.primaryButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}
