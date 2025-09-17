import React from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface CategoryTabsSingleProps {
  categories: string[];
  value: string;                 // modo single
  onChange: (c: string) => void;
  values?: undefined;
  onToggle?: undefined;
}

interface CategoryTabsMultiProps {
  categories: string[];
  value?: undefined;
  onChange?: undefined;
  values: string[];              // modo multi
  onToggle: (c: string) => void; // toggle individual
}

interface CommonProps {
  allowDeselect?: boolean;
  scrollEnabled?: boolean;
  uppercase?: boolean;
}

type CategoryTabsProps = (CategoryTabsSingleProps | CategoryTabsMultiProps) & CommonProps;

const CategoryTabs: React.FC<CategoryTabsProps> = ({ categories, value, onChange, allowDeselect, scrollEnabled = true, uppercase, values, onToggle }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        contentContainerStyle={[styles.row, { paddingHorizontal: 20 }]}
      >
        {categories.map(cat => {
          const active = values ? values.includes(cat) : value === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={styles.tabBtn}
              activeOpacity={0.75}
              onPress={() => {
                if (values && onToggle) {
                  onToggle(cat);
                } else if (onChange) {
                  if (active && allowDeselect) onChange(''); else onChange(cat);
                }
              }}
            >
              <View style={styles.labelWrapper}>
                <Text
                  style={[
                    styles.label,
                    { color: active ? colors.text : colors.muted },
                    uppercase && { textTransform: 'uppercase' }
                  ]}
                  numberOfLines={1}
                >
                  {cat}
                </Text>
                <View style={[styles.underline, { opacity: active ? 1 : 0, backgroundColor: colors.primary }]} />
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  tabBtn: { marginRight: 20, paddingVertical: 6 },
  labelWrapper: { alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  underline: { marginTop: 4, height: 3, borderRadius: 2, alignSelf: 'stretch', width: '100%' },
});

export default CategoryTabs;
