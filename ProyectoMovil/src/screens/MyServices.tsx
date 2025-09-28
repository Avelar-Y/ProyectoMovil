import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Temporal stub: deshabilitado para diagnosticar bucle de actualizaciones.
// Este componente no registra handlers ni listeners. Restaurar después de la prueba.
export default function MyServicesDisabled() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MyServices temporalmente deshabilitado</Text>
      <Text style={styles.note}>Si esto evita el error, restaura `MyServices.tsx` y revisa los handlers registrados.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  note: { color: '#666', textAlign: 'center' }
});
