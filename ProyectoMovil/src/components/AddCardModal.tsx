import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { parseCard, parseExpiry, detectBrand } from '../services/payments/cardUtils';
import CustomButton from './CustomButton';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { number: string; holder: string; expiry: string; brand: string; last4: string; expMonth: number; expYear: number }) => Promise<void> | void;
}

export default function AddCardModal({ visible, onClose, onSave }: Props) {
  const { colors } = useTheme();
  const [holder, setHolder] = useState('');
  const [number, setNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ holder?: string; number?: string; expiry?: string }>({});

  useEffect(() => {
    if (!visible) {
      setHolder(''); setNumber(''); setExpiry(''); setErrors({}); setSaving(false);
    }
  }, [visible]);

  const formatNumber = (val: string) => {
    const digits = val.replace(/\D/g, '');
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0,4);
    if (d.length <= 2) return d;
    return d.slice(0,2) + '/' + d.slice(2);
  };

  const validate = () => {
    const errs: typeof errors = {};
    if (!holder.trim()) errs.holder = 'Nombre requerido';
    const parsed = parseCard(number, expiry);
    if (!parsed) errs.number = 'Número o expiración inválidos';
    else if (!parsed.validLuhn) errs.number = 'No pasa validación Luhn';
    const exp = parseExpiry(expiry);
    if (!exp) errs.expiry = 'Expiración inválida';
    else {
      const now = new Date();
      if (exp.year < now.getFullYear() || (exp.year === now.getFullYear() && exp.month < (now.getMonth()+1))) {
        errs.expiry = 'Tarjeta expirada';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const parsed = parseCard(number, expiry)!;
    try {
      setSaving(true);
      await onSave({
        number: number.replace(/\s/g,''),
        holder: holder.trim(),
        expiry,
        brand: parsed.brand,
        last4: parsed.last4,
        expMonth: parsed.expMonth,
        expYear: parsed.expYear,
      });
      onClose();
    } catch (e:any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={[styles.backdrop]}>
          <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}> 
            <Text style={[styles.title, { color: colors.text }]}>Agregar tarjeta</Text>
            <Text style={[styles.label, { color: colors.muted }]}>Titular</Text>
            <TextInput
              value={holder}
              onChangeText={setHolder}
              placeholder="Nombre del titular"
              placeholderTextColor={colors.muted}
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: errors.holder ? '#d00' : colors.border }]} />
            {errors.holder && <Text style={styles.error}>{errors.holder}</Text>}
            <Text style={[styles.label, { color: colors.muted }]}>Número</Text>
            <TextInput
              value={number}
              onChangeText={v => setNumber(formatNumber(v))}
              keyboardType="number-pad"
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={colors.muted}
              maxLength={23}
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: errors.number ? '#d00' : colors.border }]} />
            {errors.number && <Text style={styles.error}>{errors.number}</Text>}
            <Text style={[styles.label, { color: colors.muted }]}>Expiración (MM/AA)</Text>
            <TextInput
              value={expiry}
              onChangeText={v => setExpiry(formatExpiry(v))}
              keyboardType="number-pad"
              placeholder="MM/AA"
              placeholderTextColor={colors.muted}
              maxLength={5}
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: errors.expiry ? '#d00' : colors.border }]} />
            {errors.expiry && <Text style={styles.error}>{errors.expiry}</Text>}

            <View style={styles.actions}>
              <CustomButton title="Cancelar" onPress={onClose} variant="tertiary" />
              <CustomButton title={saving ? 'Guardando...' : 'Guardar'} onPress={handleSave} disabled={saving} />
            </View>
            {saving && <ActivityIndicator style={{ marginTop: 8 }} />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'flex-end' },
  sheet: { padding:16, borderTopLeftRadius:20, borderTopRightRadius:20, borderWidth:1 },
  title: { fontSize:18, fontWeight:'700', marginBottom:12 },
  label: { fontSize:12, marginTop:8 },
  input: { padding:10, borderWidth:1, borderRadius:8, marginTop:4 },
  actions: { flexDirection:'row', justifyContent:'flex-end', marginTop:16 },
  error: { color:'#d00', fontSize:11, marginTop:4 }
});
