import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';

export default function SearchResults({ route, navigation }: any) {
  const { query } = route.params || { query: '' };
  const { colors } = useTheme();
  const [results, setResults] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }

    const q = firestore()
      .collection('services')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc');

    const unsubscribe = q.onSnapshot(snapshot => {
      const items: any[] = [];
      snapshot.forEach(doc => {
        const data: any = doc.data();
        const title = (data.title || data.key || '').toLowerCase();
        const desc = (data.description || data.desc || '').toLowerCase();
        if (title.includes(query.toLowerCase()) || desc.includes(query.toLowerCase())) {
          items.push({ id: doc.id, ...data });
        }
      });
      setResults(items);
      setLoading(false);
    }, err => {
      console.warn('search onSnapshot error', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [query]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }] }>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <Text style={[styles.title, { color: colors.text }]}>Resultados para "{query}"</Text>
      {results.length === 0 ? (
        <Text style={{ color: colors.muted, marginTop: 12, paddingHorizontal: 20 }}>No se encontraron servicios relacionados.</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.row, { backgroundColor: colors.card }]} onPress={() => navigation.navigate('ServiceDetail', { service: item })}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={{ uri: item.icon || item.img }} style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{item.title || item.key}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{item.description}</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  title: { padding: 20, fontSize: 18, fontWeight: '700' },
  row: { padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 10 }
});
