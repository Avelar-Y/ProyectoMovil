import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
// firestore namespaced import removed; use centralized service helpers instead
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { getReservationsForUser, getUserProfile, getReservationsByProvider } from '../services/firestoreService';
import { useRefresh } from '../contexts/RefreshContext';


export default function History({ navigation }: any) {
    const { user } = useAuth();
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isProvider, setIsProvider] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!user) {
                if (mounted) setLoading(false);
                return;
            }
            try {
                const uid = (user as any).uid;
                const profile = await getUserProfile(uid);
                if (!mounted) return;
                const provider = profile?.role === 'provider';
                setIsProvider(provider);

                let unsub = () => {};
                if (provider) {
                    // provider: load once on mount (no realtime) via service helper
                    try {
                        const items = await getReservationsByProvider(uid);
                        setReservations(items);
                        setLoading(false);
                    } catch (e) {
                        console.warn('provider reservations load failed', e);
                        setLoading(false);
                    }
                } else {
                    // regular user: existing behavior
                    try {
                        const res = await getReservationsForUser(user.email!);
                        setReservations(res);
                        setLoading(false);
                    } catch (err) {
                        console.warn('Fallback getReservationsForUser failed', err);
                        setLoading(false);
                    }
                }

                // cleanup will be handled by the return below
                return () => { try { if (typeof unsub === 'function') unsub(); } catch(_){} };
            } catch (e) {
                console.warn('History useEffect error', e);
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false };
    }, [user]);

    // register global refresh handler
    const refreshCtx = useRefresh();
    const historyRefreshHandler = React.useCallback(async () => {
        try {
            if (!user) return;
            const uid = (user as any).uid;
            const profile = await getUserProfile(uid);
            const provider = profile?.role === 'provider';
            setIsProvider(provider);
            if (provider) {
                const items = await getReservationsByProvider(uid);
                setReservations(items);
            } else {
                const res = await getReservationsForUser(user.email!);
                setReservations(res);
            }
        } catch (e) { console.warn('History global refresh failed', e); }
    }, [user]);
    React.useEffect(() => {
        const id = 'History';
        refreshCtx.register(id, historyRefreshHandler);
        return () => refreshCtx.unregister(id);
    }, [historyRefreshHandler]);

    useFocusEffect(
        useCallback(() => {
            let mounted = true;
            const load = async () => {
                if (!user?.email) return;
                try {
                    const res = await getReservationsForUser(user.email);
                    if (mounted) setReservations(res);
                } catch (err) {
                    console.warn('getReservationsForUser error on focus', err);
                }
            };
            load();
            return () => { mounted = false; };
        }, [user])
    );

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{isProvider ? 'Historial de servicios' : 'Historial de reservas'}</Text>
            {loading ? <Text>Cargando...</Text> : (
                <FlatList
                    data={reservations}
                    keyExtractor={item => item.id}
                    refreshing={refreshing}
                    onRefresh={async () => {
                        setRefreshing(true);
                        try {
                            if (isProvider) {
                                const uid = (user as any)?.uid;
                                if (uid) {
                                    // fallback: query provider reservations once via service helper
                                    const docs = await getReservationsByProvider(uid);
                                    setReservations(docs);
                                }
                            } else {
                                if (!user?.email) return;
                                const res = await getReservationsForUser(user.email);
                                setReservations(res);
                            }
                        } catch (err) {
                            console.warn('refresh error', err);
                        } finally {
                            setRefreshing(false);
                        }
                    }}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.item} onPress={() => navigation.navigate('ServiceDetail', { reservationId: item.id, service: item.serviceSnapshot || item.service })}>
                            <Text style={styles.itemTitle}>{item.serviceSnapshot?.title || item.service}</Text>
                            <Text>{item.name} - {item.date}</Text>
                            <Text style={styles.note}>{item.note}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#f5f6fa' },
    title: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
    item: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8 },
    itemTitle: { fontWeight: '700' },
    note: { marginTop: 6, color: '#555' }
});
