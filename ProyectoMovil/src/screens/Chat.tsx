import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useRefresh } from '../contexts/RefreshContext';
import { useAuth } from '../contexts/AuthContext';
// removed direct firestore import; using service helpers instead
import { getReservationsForUser } from '../services/firestoreService';
import { useFocusEffect } from '@react-navigation/native';

export default function Chat({ navigation }: any) {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadConversations = async () => {
        setLoading(true);
        try {
            const uid = (user as any)?.uid;
            if (!uid) {
                setConversations([]);
                setLoading(false);
                return;
            }

            // Combine reservations where user is client or provider (todas las relevantes para chat)
            const svc = await import('../services/firestoreService');
            const userReservations = await svc.getReservationsForUser((user as any).email || '');
            // Pendientes disponibles para proveedor
            const providerPending = await svc.getPendingReservationsForProvider(uid).catch(() => []);
            // Activas (confirmadas / en progreso) y completadas recientes del proveedor
            let providerActive: any[] = [];
            try { providerActive = await svc.getReservationsByProvider(uid); } catch { providerActive = []; }
            // Filtramos completadas a las últimas 30 (si hay muchas) para no inflar la lista
            const completed = providerActive.filter(r => r.status === 'completed').sort((a:any,b:any)=>(b.createdAtClient||0)-(a.createdAtClient||0)).slice(0,30);
            const activeNotCompleted = providerActive.filter(r => r.status !== 'completed');
            const providerAll = [...providerPending, ...activeNotCompleted, ...completed];
            const combined = [...(userReservations || []), ...providerAll];
            const map: Record<string, any> = {};
            for (const r of combined) map[r.id || ''] = r;
            const list = Object.values(map) as any[];

            // For each reservation fetch the last message (one-time, paginated)
            const conversationsWithLast = await Promise.all(list.map(async (r) => {
                try {
                    const page = await (await import('../services/firestoreService')).loadMessagesPage(r.id, 1);
                    const last = page.messages.length ? page.messages[page.messages.length - 1] : null;
                    const counterpartName = r.providerId === uid ? (r.name || r.userEmail) : (r.providerDisplayName || r.name || r.userEmail);
                    return { reservationId: r.id, name: counterpartName || 'Contacto', lastMessage: last, status: r.status };
                } catch (e) {
                    const counterpartName = r.providerId === uid ? (r.name || r.userEmail) : (r.providerDisplayName || r.name || r.userEmail);
                    return { reservationId: r.id, name: counterpartName || 'Contacto', lastMessage: null, status: r.status };
                }
            }));

            // sort by last message time or createdAtClient
            conversationsWithLast.sort((a: any, b: any) => {
                const ta = (a.lastMessage && a.lastMessage.createdAtClient) || 0;
                const tb = (b.lastMessage && b.lastMessage.createdAtClient) || 0;
                return tb - ta;
            });

            setConversations(conversationsWithLast);
        } catch (e) {
            console.warn('loadConversations error', e);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    };

    // load on focus (one-time) instead of realtime listeners
    useFocusEffect(
        useCallback(() => {
            loadConversations();
            // no realtime listeners: avoid continuous updates and extra Firestore calls
            return () => {};
        }, [user])
    );

    // register global refresh
    const refreshCtx = useRefresh();
    const refreshHandler = useCallback(async () => { await loadConversations(); }, [user]);
    React.useEffect(() => {
        const id = 'Chat';
        refreshCtx.register(id, refreshHandler);
        return () => refreshCtx.unregister(id);
    }, [refreshHandler]);

    if (loading) return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator /></View>;

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}> 
            <Text style={[styles.title, { color: colors.text }]}>Chats</Text>
            <FlatList
                data={conversations}
                keyExtractor={(i) => i.reservationId}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.row, { backgroundColor: colors.surface }]}
                        onPress={() => navigation.navigate('ChatRoom', { reservationId: item.reservationId })}
                    >
                        <Text style={[styles.name, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.last, { color: colors.muted }]}>{item.lastMessage?.text || item.status || 'Sin mensajes'}</Text>
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
