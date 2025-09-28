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
  compactHorizontal?: boolean; // quita marginBottom cuando está en scroll horizontal
}

export const Chip: React.FC<ChipProps> = ({ label, active, onPress, style, disabled, small, iconLeft, variant = 'md', maxWidth, compactHorizontal }) => {
  const { colors } = useTheme();
  // Solo cambiamos el color de fondo al estar activo; el texto permanece igual para evitar saltos visuales.
  const bg = active ? colors.primary : colors.highlight;
  const txt = colors.text;
  const isSmall = small || variant === 'sm';
  const baseHeight = isSmall ? 28 : 32;
return (
    <TouchableOpacity
        disabled={disabled}
        onPress={onPress}
        style={[
          styles.base,
          isSmall && styles.small,
          {
            backgroundColor: bg,
            opacity: disabled ? 0.5 : 1,
            maxWidth: maxWidth || 160,
            height: baseHeight,
            // Si es un scroll horizontal queremos evitar el margen inferior para que no se vea un "salto" visual al presionar
            marginBottom: compactHorizontal ? 0 : styles.base.marginBottom,
          },
          style,
        ]}
        activeOpacity={0.85}
    >
        {iconLeft}
        <Text
            style={[
                styles.label,
                {
                    color: txt,
                    fontSize: isSmall ? 11 : 12,
                    lineHeight: (isSmall ? 11 : 12) + 2,
                    letterSpacing: 0.2,
                    paddingTop: 0,
                    paddingBottom: 0
                }
            ]}
            numberOfLines={1}
            allowFontScaling={false}
        >
            {label}
        </Text>
    </TouchableOpacity>
);
};

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
    marginBottom: 0,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600'
  },
  small: {
    paddingHorizontal: 10,
    paddingVertical: 0,
    borderRadius: 14,
  }
});

export default Chip;
