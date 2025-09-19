import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { APP_NAME, TAGLINE } from '../branding';

interface Props { 
  compact?: boolean; 
  variant?: 'full' | 'minimal'; // minimal: sólo logo + nombre en una fila muy reducida
  hideTagline?: boolean;       // fuerza ocultar tagline incluso en variant full
  logoSize?: number;           // override de tamaño
  showLogo?: boolean;          // si true muestra el placeholder/logo. Default: false hasta tener asset.
}

// Banner de marca reutilizable para reforzar identidad dentro de la app.
export default function BrandingBanner({ compact, variant='full', hideTagline=false, logoSize, showLogo=false }: Props) {
  const { colors } = useTheme();
  const effectiveCompact = compact || variant === 'minimal';
  const size = logoSize || (effectiveCompact ? 36 : 56);
  return (
    <View style={[styles.container, variant === 'minimal' && styles.minimalContainer, { backgroundColor: colors.highlight || colors.card, borderColor: colors.border, paddingVertical: effectiveCompact?10:14 }]}> 
      {showLogo && (
        <View style={styles.logoWrap}>
          <Image accessibilityLabel="Logo Solvi" source={{ uri:'https://via.placeholder.com/64x64.png?text=S' }} style={{ width: size, height: size, borderRadius: size*0.28 }} />
        </View>
      )}
      <View style={{ flex: variant==='full'?1: undefined }}>
        <Text style={[styles.appName, { color: colors.primary, fontSize: effectiveCompact?18:24 }]}>{APP_NAME}</Text>
        {variant === 'full' && !hideTagline && (
          <Text style={[styles.tagline, { color: colors.muted, fontSize: effectiveCompact?11:14 }]}>{TAGLINE}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{ flexDirection:'row', alignItems:'center', padding:14, borderRadius:20, borderWidth:1, marginBottom:16 },
  minimalContainer:{ paddingHorizontal:12, paddingVertical:8, borderRadius:16 },
  logoWrap:{ marginRight:14 },
  appName:{ fontWeight:'800', letterSpacing:0.5 },
  tagline:{ marginTop:2, fontWeight:'600' }
});
