import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import firestore from '@react-native-firebase/firestore';
import { getReservationsForUser } from '../services/firestoreService';

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

            // Query reservations where userId == uid and providerId == uid (two queries) and combine
            const userSnap = await firestore().collection('reservations').where('userId', '==', uid).get();
            const provSnap = await firestore().collection('reservations').where('providerId', '==', uid).get();
            const docs = [...userSnap.docs, ...provSnap.docs];
            const map: Record<string, any> = {};
            for (const d of docs) {
                const data = d.data() as any;
                map[d.id] = { id: d.id, ...data };
            }
            const list = Object.values(map) as any[];

            // For each reservation fetch the last message (if any)
            const conversationsWithLast = await Promise.all(list.map(async (r) => {
                try {
                    const msgs = await firestore().collection('reservations').doc(r.id).collection('messages').orderBy('createdAtClient', 'desc').limit(1).get();
                    const last = msgs.empty ? null : { id: msgs.docs[0].id, ...(msgs.docs[0].data() as any) };
                    return { reservationId: r.id, name: r.providerDisplayName || r.name || r.userEmail || 'Contacto', lastMessage: last, status: r.status };
                } catch (e) {
                    return { reservationId: r.id, name: r.providerDisplayName || r.name || r.userEmail || 'Contacto', lastMessage: null, status: r.status };
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

    useEffect(() => {
        loadConversations();
        const uid = (user as any)?.uid;
        if (!uid) return;
        // realtime: listen for reservation changes where user is participant
        const unsub1 = firestore().collection('reservations').where('userId', '==', uid).onSnapshot(() => loadConversations(), () => {});
        const unsub2 = firestore().collection('reservations').where('providerId', '==', uid).onSnapshot(() => loadConversations(), () => {});
        return () => { unsub1(); unsub2(); };
    }, [user]);

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
                        onPress={() => navigation.navigate('Chat', { reservationId: item.reservationId })}
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
