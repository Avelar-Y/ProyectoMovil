import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const conversations = [
    { id: '1', name: 'Proveedor A', last: '¿A qué hora llegas?' },
    { id: '2', name: 'Proveedor B', last: 'Confirmado, estoy en camino.' },
    { id: '3', name: 'Soporte', last: '¿En qué podemos ayudarte?' },
];

export default function Chat({ navigation }: any) {
    const { colors } = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <Text style={[styles.title, { color: colors.text }]}>Chats</Text>
            <FlatList
                data={conversations}
                keyExtractor={(i) => i.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.row, { backgroundColor: colors.surface }]}
                        onPress={() => navigation.navigate('ServiceDetail', { providerId: item.id })}
                    >
                        <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.last, { color: colors.muted }]}>{item.last}</Text>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    title: { fontSize: 24, fontWeight: '600', marginBottom: 12 },
    row: { padding: 14, borderRadius: 12, marginBottom: 10 },
    name: { fontSize: 16, fontWeight: '600' },
    last: { fontSize: 13, marginTop: 6 },
});
