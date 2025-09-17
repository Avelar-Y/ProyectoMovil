import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
  small?: boolean; // deprecated (usar variant)
  iconLeft?: React.ReactNode;
  variant?: 'sm' | 'md';
  maxWidth?: number;
}

export const Chip: React.FC<ChipProps> = ({ label, active, onPress, style, disabled, small, iconLeft, variant = 'md', maxWidth }) => {
  const { colors } = useTheme();
  const bg = active ? colors.primary : colors.highlight;
  const txt = active ? '#fff' : colors.text;
  const isSmall = small || variant === 'sm';
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        isSmall && styles.small,
        { backgroundColor: bg, opacity: disabled ? 0.5 : 1, maxWidth: maxWidth || 200 },
        style
      ]}
      activeOpacity={0.85}
    >
      {iconLeft}
      <Text style={[styles.label, { color: txt, fontSize: isSmall ? 11 : 12 }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
    minHeight: 32,
  },
  label: {
    fontWeight: '600'
  },
  small: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    minHeight: 28,
  }
});

export default Chip;
