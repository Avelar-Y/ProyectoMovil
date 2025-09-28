import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

type Props = {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'tertiary';
    disabled?: boolean;
}
// componente con props
export default function CustomButton ({title, onPress, variant='primary', disabled=false}: Props){
    const { colors } = useTheme();
    const styles = getStyles(variant, colors);

    return( 
    <TouchableOpacity  style={[styles.button, disabled ? { opacity: 0.6 } : null]} onPress={disabled ? undefined : onPress} disabled={disabled} >
        <Text style={styles.text}>{title}</Text>
    </TouchableOpacity>
    );
}
// funcion con parametros para generar estilos
const getStyles = (variant: 'primary' | 'secondary' | 'tertiary', colors: any) => {
     const bg = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.muted : 'transparent';
     const textColor = variant === 'primary' || variant === 'secondary' ? colors.text : colors.text;
     return StyleSheet.create({
         button: {
          height: 45,
          paddingHorizontal: 12,
          marginVertical: 8,
          borderRadius: 8,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
         }, 
         text: {
          color: textColor,
          fontWeight: '700',
          fontSize: 15,
         },

     })
}