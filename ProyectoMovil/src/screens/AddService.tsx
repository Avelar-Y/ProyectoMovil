import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Switch, Alert, ScrollView, Image } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { saveService, getUserProfile } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import CustomButton from '../components/CustomButton';
import { useRefresh } from '../contexts/RefreshContext';

const AddService: React.FC = () => {
  const { user } = useAuth();
  const [isProvider, setIsProvider] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [icon, setIcon] = useState('');
  const [tags, setTags] = useState(''); // comma separated
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uid = (user as any)?.uid;
        if (!uid) { if (mounted) setIsProvider(false); return; }
        const p = await getUserProfile(uid);
        if (mounted) setIsProvider(p?.role === 'provider');
      } catch (e) {
        console.warn('AddService getUserProfile', e);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  const refreshCtx = useRefresh();
  const addServiceHandler = React.useCallback(async () => {
    try {
      const uid = (user as any)?.uid;
      if (!uid) return;
      const p = await getUserProfile(uid);
      setIsProvider(p?.role === 'provider');
    } catch (e) { console.warn('AddService refresh failed', e); }
  }, [user]);
  React.useEffect(() => {
    const id = 'AddService';
    refreshCtx.register(id, addServiceHandler);
    return () => refreshCtx.unregister(id);
  }, [addServiceHandler]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPrice('');
    setDuration('');
    setIcon('');
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
      const uid = (user as any)?.uid;
      let ownerDisplayName: string | undefined = undefined;
      let ownerPhone: string | undefined = undefined;
      let ownerId: string | undefined = undefined;
      if (uid) {
        ownerId = uid;
        const profile = await getUserProfile(uid);
        ownerDisplayName = profile?.displayName;
        ownerPhone = profile?.phone;
      }

      const service: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        price: price ? Number(price) : undefined,
        duration: duration ? Number(duration) : undefined,
        icon: icon.trim() || undefined,
        tags: tags ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined,
        active: !!active,
        ownerId: ownerId,
        ownerPhone: ownerPhone,
        ownerDisplayName: ownerDisplayName,
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

  if (!isProvider) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Acceso restringido</Text>
        <Text style={{ color: colors.muted }}>Solo las cuentas de proveedor pueden crear servicios. Ve a tu perfil para cambiar tu tipo de cuenta o solicita acceso.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: colors.card }] }>
        <Text style={[styles.title, { color: colors.text }]}>Agregar Servicio</Text>

        <Text style={[styles.label, { color: colors.muted }]}>Título *</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={title} onChangeText={setTitle} placeholder="Título" placeholderTextColor={colors.muted} />

        <Text style={[styles.label, { color: colors.muted }]}>Descripción</Text>
        <TextInput style={[styles.input, styles.multiline, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={description} onChangeText={setDescription} placeholder="Descripción" multiline numberOfLines={3} placeholderTextColor={colors.muted} />

        <View style={styles.rowInline}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={[styles.label, { color: colors.muted }]}>Precio</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={price} onChangeText={setPrice} placeholder="1000" keyboardType="numeric" placeholderTextColor={colors.muted} />
          </View>
          <View style={{ width: 120 }}>
            <Text style={[styles.label, { color: colors.muted }]}>Duración (min)</Text>
            <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={duration} onChangeText={setDuration} placeholder="5" keyboardType="numeric" placeholderTextColor={colors.muted} />
          </View>
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>Icono (URL)</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={icon} onChangeText={setIcon} placeholder="https://..." placeholderTextColor={colors.muted} />
        {icon ? <Image source={{ uri: icon }} style={styles.iconPreview} /> : null}

        <Text style={[styles.label, { color: colors.muted }]}>Tags (separados por coma)</Text>
        <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={tags} onChangeText={setTags} placeholder="tag1, tag2" placeholderTextColor={colors.muted} />

        <View style={[styles.row, { marginTop: 12 }] }>
          <Text style={[styles.label, { color: colors.muted }]}>Activo</Text>
          <Switch value={active} onValueChange={setActive} />
        </View>

        <View style={{ marginTop: 18 }}>
          <CustomButton title={saving ? 'Guardando...' : 'Guardar Servicio'} onPress={onSave} disabled={saving} />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  card: {
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  rowInline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconPreview: {
    width: 80,
    height: 80,
    marginTop: 8,
    borderRadius: 8,
  },
});

export default AddService;
