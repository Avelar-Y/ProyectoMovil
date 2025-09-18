import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { updateUserProfile } from '../services/firestoreService';

// Pantalla de términos para activar modo proveedor
export default function ProviderTerms({ navigation }: any) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    // Si viene alguien que ya aceptó, redirigir directo al dashboard
    (async ()=>{
      try {
        // se podría cargar perfil nuevamente, pero asumimos navegación sólo sucede si aún no era provider
      } catch {}
    })();
  },[]);

  const onAccept = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await updateUserProfile((user as any).uid, {
        role: 'provider',
        providerTermsAcceptedAt: new Date().toISOString(), // también se guarda serverTimestamp en merge posterior si se desea
      });
      navigation.replace('ProviderDashboard');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar aceptación');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
  <Text style={[styles.title, { color: colors.text }]}>Términos para Proveedores</Text>
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Uso Responsable</Text>
        <Text style={[styles.paragraph, { color: colors.muted }]}>Te comprometes a ofrecer servicios reales, a comunicar tiempos y costos con transparencia y a respetar la privacidad de los usuarios.</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Contenido y Datos</Text>
        <Text style={[styles.paragraph, { color: colors.muted }]}>No publiques información falsa, ofensiva o que infrinja derechos de terceros. Los datos de contacto se usarán únicamente para coordinar servicios.</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Cancelaciones y Calidad</Text>
        <Text style={[styles.paragraph, { color: colors.muted }]}>Evita cancelaciones injustificadas. Un alto índice de cancelaciones podría implicar suspensión temporal.</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Pagos / Responsabilidad</Text>
        <Text style={[styles.paragraph, { color: colors.muted }]}>Esta versión no gestiona pagos en línea. Cualquier acuerdo económico se realiza fuera de la plataforma. Actúa siempre de forma legal y ética.</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Privacidad</Text>
        <Text style={[styles.paragraph, { color: colors.muted }]}>No compartas datos personales de usuarios. El mal uso de la información puede provocar eliminación de la cuenta.</Text>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>6. Revisión y Cambios</Text>
        <Text style={[styles.paragraph, { color: colors.muted }]}>Estos términos pueden actualizarse; se te notificará si ocurre un cambio relevante.</Text>
        <TouchableOpacity onPress={() => setAccepted(a => !a)} style={[styles.checkboxRow]}> 
          <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: accepted ? colors.primary : 'transparent' }]} />
          <Text style={{ color: colors.text, flex:1, fontSize:13 }}>He leído y acepto los términos para actuar como proveedor.</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={styles.actionsRow}>
        <TouchableOpacity disabled={saving} onPress={() => navigation.goBack()} style={[styles.btn, { backgroundColor: colors.highlight }]}> 
          <Text style={[styles.btnText, { color: colors.text }]}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity disabled={!accepted || saving} onPress={onAccept} style={[styles.btn, { backgroundColor: !accepted ? colors.border : colors.primary, opacity: saving ? 0.6 : 1 }]}> 
          <Text style={[styles.btnText, { color: !accepted ? colors.muted : '#fff' }]}>{saving ? 'Guardando...' : 'Aceptar'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, paddingHorizontal:20, paddingTop:26 },
  title: { fontSize:20, fontWeight:'700', marginBottom:12 },
  scroll: { flex:1 },
  sectionTitle: { fontSize:15, fontWeight:'600', marginTop:18, marginBottom:4 },
  paragraph: { fontSize:13, lineHeight:19 },
  checkboxRow: { flexDirection:'row', alignItems:'center', marginTop:24, gap:12 },
  checkbox: { width:20, height:20, borderWidth:2, borderRadius:6 },
  actionsRow: { flexDirection:'row', gap:12, paddingVertical:16 },
  btn: { flex:1, paddingVertical:12, borderRadius:10, alignItems:'center' },
  btnText: { fontSize:14, fontWeight:'600' }
});
