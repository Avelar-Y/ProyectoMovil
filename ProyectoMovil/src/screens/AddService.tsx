import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, Button, Alert, ScrollView } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { saveService } from '../services/firestoreService';

const AddService: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [icon, setIcon] = useState('');
  const [key, setKey] = useState('');
  const [tags, setTags] = useState(''); // comma separated
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrice('');
    setDuration('');
    setIcon('');
    setKey('');
    setTags('');
    setActive(true);
  };

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert('Validación', 'El título es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const service = {
        title: title.trim(),
        description: description.trim() || undefined,
        price: price ? Number(price) : undefined,
        duration: duration ? Number(duration) : undefined,
        icon: icon.trim() || undefined,
        key: key.trim() || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
        active: !!active,
      };
      const id = await saveService(service as any);
      Alert.alert('Éxito', `Servicio guardado con id: ${id}`);
      resetForm();
    } catch (err: any) {
      console.error('AddService save error', err);
      Alert.alert('Error', 'No se pudo guardar el servicio. Revisa la consola.');
    } finally {
      setSaving(false);
    }
  };

  const { colors } = useTheme();

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Agregar Servicio</Text>

      <Text style={styles.label}>Título *</Text>
  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={title} onChangeText={setTitle} placeholder="Tipo de servicio" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Descripción</Text>
  <TextInput style={[styles.input, styles.multiline, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={description} onChangeText={setDescription} placeholder="Descripción" multiline numberOfLines={3} placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Precio</Text>
  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={price} onChangeText={setPrice} placeholder="1000" keyboardType="numeric" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Duración (minutos)</Text>
  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={duration} onChangeText={setDuration} placeholder="5" keyboardType="numeric" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Icono (URL)</Text>
  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={icon} onChangeText={setIcon} placeholder="https://..." placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Key (id elegible)</Text>
  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={key} onChangeText={setKey} placeholder="id-elegible" placeholderTextColor={colors.muted} />

      <Text style={styles.label}>Tags (separados por coma)</Text>
  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={tags} onChangeText={setTags} placeholder="tag1, tag2" placeholderTextColor={colors.muted} />

      <View style={styles.row}>
        <Text style={styles.label}>Activo</Text>
        <Switch value={active} onValueChange={setActive} />
      </View>

      <View style={styles.button}>
        <Button title={saving ? 'Guardando...' : 'Guardar Servicio'} onPress={onSave} disabled={saving} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  button: {
    marginTop: 20,
  },
});

export default AddService;
