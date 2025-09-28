import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';
import { useAuth } from '../contexts/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { listThreadsForUser, Thread } from '../services/firestoreService';

// Nueva versión: muestra threads unificados (1 hilo por par de usuarios) estilo WhatsApp.
// Cada item muestra el nombre del otro participante y el último mensaje o evento.

export default function Chat({ navigation }: any) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [threads, setThreads] = useState<Thread[]>([]);
    const [loading, setLoading] = useState(true);

    const loadThreads = async () => {
        setLoading(true);
        try {
            const uid = (user as any)?.uid;
            if (!uid) {
                setThreads([]);
                setLoading(false);
                return;
            }
            const list = await listThreadsForUser(uid);
            setThreads(list);
        } catch (e) {
            console.warn('loadThreads error', e);
            setThreads([]);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadThreads(); return () => {}; }, [user]));

    // Registrar en refresh global
    const refreshCtx = useRefresh();
    const refreshHandler = useCallback(async () => { await loadThreads(); }, [user]);
    React.useEffect(() => {
        const id = 'Chat';
        refreshCtx.register(id, refreshHandler);
        return () => refreshCtx.unregister(id);
    }, [refreshHandler]);

    const renderItem = ({ item }: { item: Thread }) => {
        const uid = (user as any)?.uid;
        const counterpartId = (item.participants || []).find(p => p !== uid) || 'desconocido';
        const info = item.participantInfo?.[counterpartId];
        const name = info?.displayName || counterpartId.slice(0, 10) || 'Contacto';
        const last = item.lastMessage;
        let preview = 'Sin mensajes';
        if (last) {
            if (last.type === 'reservation_event') preview = last.text || 'Nueva reserva';
            else preview = last.text || 'Mensaje';
        }
        return (
            <TouchableOpacity
                style={[styles.row, { backgroundColor: colors.surface }]}
                onPress={() => navigation.navigate('ChatRoom', { threadId: item.id, lastReservationId: (last as any)?.reservationId })}
            >
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                <Text style={[styles.last, { color: colors.muted }]} numberOfLines={2}>{preview}</Text>
            </TouchableOpacity>
        );
    };

    if (loading) return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator /></View>;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}> 
            <Text style={[styles.title, { color: colors.text }]}>Chats</Text>
            <FlatList
                data={threads}
                keyExtractor={(i) => i.id || Math.random().toString()}
                renderItem={renderItem}
                ListEmptyComponent={<Text style={{ color: colors.muted, marginTop: 30, textAlign: 'center' }}>Aún no tienes conversaciones</Text>}
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
