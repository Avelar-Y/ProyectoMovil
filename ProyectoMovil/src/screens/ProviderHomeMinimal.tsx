import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getServicesForProvider } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

export default function ProviderHomeMinimal({ navigation }: any) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [services, setServices] = React.useState<any[]>([]);

  const loadOnce = async () => {
    setLoading(true);
    try {
      const uid = (user as any)?.uid;
      if (!uid) {
        setServices([]);
        return;
      }
      const sv = await getServicesForProvider(uid);
      setServices(sv || []);
    } catch (e) {
      console.warn('ProviderHomeMinimal load error', e);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Panel de proveedor (minimal)</Text>
      <TouchableOpacity onPress={loadOnce} style={[styles.button, { backgroundColor: colors.primary }]}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Cargar servicios (manual)</Text>
      </TouchableOpacity>

      {loading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}

      <FlatList
        data={services}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('AddService', { service: item })} style={[styles.row, { backgroundColor: colors.card }]}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title || item.key}</Text>
            <Text style={{ color: colors.muted }}>{item.price ? String(item.price) : 'Sin precio'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  button: { padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 12 },
  row: { padding: 12, borderRadius: 8, marginBottom: 8 }
});
