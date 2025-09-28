import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { shouldShowHint, markHintSeen } from '../services/hints';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  try { UIManager.setLayoutAnimationEnabledExperimental(true); } catch(e) {}
}

interface Props {
  id: string;              // clave única del hint
  title?: string;          // título opcional
  text: string;            // mensaje principal
  onDismissed?: () => void; // callback al cerrar
  auto?: boolean;          // si true se consulta shouldShowHint automáticamente
}

export default function FeatureHint({ id, title, text, onDismissed, auto = true }: Props) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(!auto); // si auto, esperamos verificación asincrónica

  useEffect(() => {
    let mounted = true;
    if (auto) {
      shouldShowHint(id).then(show => {
        if (mounted) setVisible(show);
      });
    }
    return () => { mounted = false; };
  }, [id, auto]);

  if (!visible) return null;

  const close = async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setVisible(false);
    await markHintSeen(id);
    onDismissed && onDismissed();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.highlight || colors.card, borderColor: colors.border }]}> 
      <View style={{ flex:1 }}>
        {title && <Text style={[styles.title, { color: colors.primary }]}>{title}</Text>}
        <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
        <Pressable onPress={close} style={({pressed})=>[{ alignSelf:'flex-start', marginTop:8, paddingVertical:4, paddingHorizontal:10, borderRadius:8, backgroundColor: colors.primary, opacity: pressed?0.85:1 }]}> 
          <Text style={{ color:'#fff', fontSize:12, fontWeight:'600' }}>Entendido</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth:1, borderRadius:14, padding:14, marginBottom:14 },
  title: { fontSize:13, fontWeight:'700', marginBottom:4, letterSpacing:0.5 },
  text: { fontSize:12, lineHeight:17, fontWeight:'500' }
});
